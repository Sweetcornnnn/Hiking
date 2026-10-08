import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
import { useAuthStore } from '../store/authStore';
import { mountainService } from '../services/mountainService'; // ⚠️ adjust path if different in your project
import { getWeatherForecast } from '../services/weatherService';
import { Hike } from '../types';
import HikeFormModal from '../components/HikeFormModal';
import Toast, { ToastHandle } from '../components/Toast';
import { dateInRange, effectiveEnd, formatRangeShort } from '../utils/dateRange';
import { useHikePermit, buildPermitDetails } from '../components/HikePermitModal';

const SAKA_LOGO = require('../../assets/images/SakaLogo.png');

const COLUMNS = 2;
// Space between cards, both side to side and row to row. Set to 0 for flush cards.
const CARD_GAP = 8;
const OUTER_PADDING = 16;

// A tap and a hold start the exact same way (finger goes down), so the
// wipe animation doesn't begin the instant you touch the card — it waits
// this long first. A quick tap-to-edit releases well before this fires and
// never sees any delete visual at all; only a genuine hold crosses it.
const HOLD_ENGAGE_DELAY_MS = 180;

// Slow, resistant hold: Easing.out(cubic) means the wipe races ahead early
// then visibly fights back the closer it gets to the edge, like it's
// resisting being deleted.
const HOLD_TO_DELETE_MS = 3700;
const HOLD_EASING = Easing.out(Easing.cubic);
const MAX_SHAKE_PX = 3;

// The wipe doesn't stay one flat red — it travels through a little arc of
// its own, from a warning amber, through hot reds, and down into a
// smoldering near-black by the time it commits. The leading edge is always
// a shade or two brighter/hotter than the fill behind it, like the wipe is
// still "burning" forward.
const WIPE_STOPS = [0, 0.22, 0.45, 0.7, 1];
const WIPE_FILL_COLORS = ['#F2994A', '#EB5757', '#D64545', '#A5222B', '#4A0E0E'];
const WIPE_EDGE_COLORS = ['#FFD08A', '#FF8A65', '#FF5252', '#FF3B30', '#FF6B4A'];
const WIPE_BORDER_COLORS = ['rgba(255,255,255,0.07)', '#F2994A', '#EB5757', '#D64545', '#FF3B30'];

// Your own hikes keep the gold accent used throughout the app. Hikes other
// people put on the calendar get a distinct cool blue instead, so ownership
// reads at a glance from the icon badge, the left accent bar, and the
// "Shared" tag — not just a small eye icon buried in the corner.
const OWN_ACCENT = '#C9A96E';
const SHARED_ACCENT = '#7CA8FF';

const keyExtractor = (hike: Hike) => hike.id;

// ⚠️ Minimal local shape — swap for your real Mountain type if it already
// includes latitude/longitude/name.
interface Mountain {
  id: string;
  name?: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

interface DayWeather {
  icon: string;
  description: string;
  tempMin: number;
  tempMax: number;
}

const formatTimeShort = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'P' : 'A';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}${ampm}`;
};

// Same mapping Calendar.tsx uses, so the icon shown here always matches
// the one on the calendar day.
const getWeatherIconName = (iconCode?: string) => {
  if (!iconCode) return 'cloud-outline';
  if (iconCode.startsWith('01')) return iconCode.endsWith('n') ? 'moon-outline' : 'sunny-outline';
  if (iconCode.startsWith('02')) return iconCode.endsWith('n') ? 'cloudy-night-outline' : 'partly-sunny-outline';
  if (iconCode.startsWith('03')) return 'cloud-outline';
  if (iconCode.startsWith('04')) return 'cloudy-outline';
  if (iconCode.startsWith('09') || iconCode.startsWith('10')) return 'rainy-outline';
  if (iconCode.startsWith('11')) return 'thunderstorm-outline';
  if (iconCode.startsWith('13')) return 'snow-outline';
  if (iconCode.startsWith('50')) return 'cloud-outline';
  return 'cloud-outline';
};

const getWeatherIconColor = (iconCode?: string) => {
  if (!iconCode) return 'rgba(201,169,110,0.35)';
  if (iconCode.startsWith('01')) return '#F2C94C';
  if (iconCode.startsWith('02')) return '#F4D48F';
  if (iconCode.startsWith('03') || iconCode.startsWith('04')) return '#A1B0C4';
  if (iconCode.startsWith('09') || iconCode.startsWith('10')) return '#70B7FF';
  if (iconCode.startsWith('11')) return '#A86DFF';
  if (iconCode.startsWith('13')) return '#D8F0FF';
  if (iconCode.startsWith('50')) return '#B0B8C2';
  return '#C9A96E';
};

interface HikeCardProps {
  hike: Hike;
  displayDate: string;
  weather: DayWeather | null;
  canEdit: boolean;
  cardWidth: number;
  onEdit: (hike: Hike) => void;
  // Return false (or a promise of false) when the delete failed so the card resets.
  onDelete: (hike: Hike) => Promise<boolean> | boolean | void;
}

// Tap = edit. Hold = a wipe crawls left→right across the card, cycling
// through hotter and hotter colors as it goes (amber → red → smoldering
// near-black), slowing down (resistance) as it nears the right edge, while
// the card shakes harder and its border catches the same colors. Let go
// early and it snaps back — the wipe reaching the far edge IS the
// confirmation, no alert needed.
//
// A plain tap and the start of a hold both begin as "finger touches card",
// so the wipe doesn't fire on press-in. It waits HOLD_ENGAGE_DELAY_MS first;
// if you've released before that (a normal tap), nothing ever shows and the
// edit modal opens. Only once the delay is crossed does the gesture "engage"
// — at which point releasing snaps the wipe back and, since you clearly
// meant to hold rather than tap, does NOT also open the edit modal.
const HikeCard = React.memo(function HikeCard({
  hike,
  displayDate,
  weather,
  canEdit,
  cardWidth,
  onEdit,
  onDelete,
}: HikeCardProps) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fillAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const shakeLoop = useRef<Animated.CompositeAnimation | null>(null);
  const engageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdEngaged = useRef(false);
  const deletedRef = useRef(false);

  const beginWipe = () => {
    if (deletedRef.current) return;
    holdEngaged.current = true;

    fillAnim.setValue(0);
    fillAnimation.current = Animated.timing(fillAnim, {
      toValue: 1,
      duration: HOLD_TO_DELETE_MS,
      easing: HOLD_EASING,
      useNativeDriver: false,
    });
    fillAnimation.current.start(({ finished }) => {
      if (finished && !deletedRef.current) {
        deletedRef.current = true;
        shakeLoop.current?.stop();
        shakeAnim.setValue(0);
        Promise.resolve(onDelete(hike)).then((ok) => {
          // Delete failed: put the card back to normal so it can be used again
          if (ok === false) {
            deletedRef.current = false;
            holdEngaged.current = false;
            Animated.timing(fillAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start();
          }
        });
      }
    });

    shakeAnim.setValue(0);
    shakeLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: false }),
      ])
    );
    shakeLoop.current.start();
  };

  const startHold = () => {
    if (deletedRef.current) return;
    holdEngaged.current = false;
    engageTimeout.current = setTimeout(beginWipe, HOLD_ENGAGE_DELAY_MS);
  };

  const cancelHold = () => {
    if (engageTimeout.current) {
      clearTimeout(engageTimeout.current);
      engageTimeout.current = null;
    }
    if (deletedRef.current) return;
    fillAnimation.current?.stop();
    shakeLoop.current?.stop();
    Animated.parallel([
      Animated.timing(fillAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePress = () => {
    // The gesture engaged (crossed the delay) — this release is the end of
    // a hold, not a tap, so don't also pop the edit modal open.
    if (holdEngaged.current) {
      holdEngaged.current = false;
      return;
    }
    if (canEdit) onEdit(hike);
  };

  const wipeWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, cardWidth],
  });
  // The fill behind the wipe front, cycling amber → red → near-black.
  const wipeFillColor = fillAnim.interpolate({
    inputRange: WIPE_STOPS,
    outputRange: WIPE_FILL_COLORS,
  });
  // A brighter, hotter leading edge riding just ahead of the fill.
  const wipeEdgeColor = fillAnim.interpolate({
    inputRange: WIPE_STOPS,
    outputRange: WIPE_EDGE_COLORS,
  });
  // Card border catches the same heat as it commits.
  const cardBorderColor = fillAnim.interpolate({
    inputRange: WIPE_STOPS,
    outputRange: WIPE_BORDER_COLORS,
  });
  // Trash icon fades in on the right as a "you're about to lose this" cue.
  const trashOpacity = fillAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  // Shake amplitude grows with how far the wipe has crawled.
  const shakeAmplitude = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MAX_SHAKE_PX],
  });
  // Tiny inward squeeze as it nears commit, for tension.
  const cardScale = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });
  const translateX = Animated.multiply(shakeAnim, shakeAmplitude);
  const isMultiDay = !!(hike.end_date && hike.end_date !== hike.date);
  const isFirstDay = hike.date === displayDate;
  const isLastDay = effectiveEnd(hike.date, hike.end_date) === displayDate;
  const timeText = !isMultiDay
    ? `${formatTimeShort(hike.start_time)}–${formatTimeShort(hike.end_time)}`
    : isFirstDay && !isLastDay
      ? `Starts ${formatTimeShort(hike.start_time)}`
      : isLastDay && !isFirstDay
        ? `Ends ${formatTimeShort(hike.end_time)}`
        : `${formatTimeShort(hike.start_time)}–${formatTimeShort(hike.end_time)}`;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => canEdit && startHold()}
      onPressOut={() => canEdit && cancelHold()}
      style={styles.cardTouchable}
    >
      <Animated.View
        style={[
          styles.card,
          !canEdit && styles.cardShared,
          canEdit ? { borderColor: cardBorderColor } : null,
          { transform: [{ translateX }, { scale: cardScale }] },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: canEdit ? OWN_ACCENT : SHARED_ACCENT }]} />

        <View style={styles.cardTopRow}>
          <View style={[styles.cardIconWrap, !canEdit && styles.cardIconWrapShared]}>
            <Ionicons name="trail-sign" size={16} color={canEdit ? OWN_ACCENT : SHARED_ACCENT} />
          </View>
          <View style={styles.cardBadgeStack}>
            {weather ? (
              <Ionicons name={getWeatherIconName(weather.icon)} size={12} color={getWeatherIconColor(weather.icon)} />
            ) : null}
            {!canEdit ? (
              <View style={styles.sharedPill}>
                <Ionicons name="eye-outline" size={9} color={SHARED_ACCENT} />
                <Text style={styles.sharedPillText}>Shared</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.cardInfoBlock}>
          <Text style={styles.cardTime}>
            {timeText}
          </Text>
          <View style={styles.cardRow}>
            <Ionicons name="calendar-outline" size={10} color="rgba(201,169,110,0.7)" />
            <Text style={styles.cardRowText}>
              {formatRangeShort(hike.date, hike.end_date)}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="people-outline" size={10} color="rgba(255,255,255,0.5)" />
            <Text style={styles.cardRowText}>{hike.tagalongs}</Text>
          </View>
        </View>

        {canEdit ? (
          <>
            <Animated.View pointerEvents="none" style={[styles.deleteWipe, { width: wipeWidth, backgroundColor: wipeFillColor }]} />
            <Animated.View
              pointerEvents="none"
              style={[styles.deleteWipeEdge, { left: wipeWidth, backgroundColor: wipeEdgeColor, opacity: trashOpacity }]}
            />
            <Animated.View pointerEvents="none" style={[styles.deleteTrashWrap, { opacity: trashOpacity }]}>
              <Ionicons name="trash-outline" size={13} color="#FFF" />
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

export default function HikesScreen() {
  const router = useRouter();
  const { date, mountainId } = useLocalSearchParams<{ date: string; mountainId?: string }>();
  const { mountainHikes, deleteHike } = useHikesStore();
  const { user } = useAuthStore();
  const [editingHike, setEditingHike] = useState<Hike | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [resolvedMountain, setResolvedMountain] = useState<Mountain | null>(null);
  const [dayWeather, setDayWeather] = useState<DayWeather | null>(null);
  const toastRef = useRef<ToastHandle>(null);
  // Grid sizing: roomy side margins that scale with the screen, and cards that
  // are exactly (width - margins - gaps) / columns wide, so they never drift.
  // Sized from the screen's real measured width (not the window size), so it
  // stays centered even when the device has system bars or a cutout.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const screenWidth = measuredWidth || windowWidth;
  const sidePadding = Math.max(28, Math.round(screenWidth * 0.06));
  const cardWidth = Math.floor(
    (screenWidth - sidePadding * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS
  );
  // Hikes deleted this session: hidden immediately, even if the store hasn't caught up yet
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const permit = useHikePermit(SAKA_LOGO);

  const hikesOnDate = useMemo(
    () =>
      mountainHikes.filter(
        (h) => !deletedIds.includes(h.id) && dateInRange(date, h.date, h.end_date)
      ),
    [mountainHikes, deletedIds, date]
  );
  const mountainName = resolvedMountain?.name ?? hikesOnDate[0]?.mountain_name;

  // Resolve the mountain (for its name and lat/long) — cache first, same as
  // Calendar.tsx, then a network fetch as fallback.
  useEffect(() => {
    if (!mountainId) return;
    useHikesStore.getState().fetchMountainHikes(mountainId);
  }, [mountainId]);

  useEffect(() => {
    let cancelled = false;

    const resolveMountain = async () => {
      if (!mountainId) {
        setResolvedMountain(null);
        return;
      }
      const cached = mountainService.getCachedMountainById(mountainId);
      if (cached) {
        setResolvedMountain(cached);
        return;
      }
      try {
        const fetched = await mountainService.fetchMountainById(mountainId);
        if (!cancelled) {
          setResolvedMountain(fetched ?? null);
        }
      } catch (error) {
        console.warn('[Hikes] Failed to resolve mountain', error);
        if (!cancelled) {
          setResolvedMountain(null);
        }
      }
    };

    resolveMountain();
    return () => {
      cancelled = true;
    };
  }, [mountainId]);

  // Same weather source as the calendar grid, just narrowed to this one date.
  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      if (!resolvedMountain || !date) {
        setDayWeather(null);
        return;
      }
      try {
        const forecast = await getWeatherForecast(resolvedMountain.latitude, resolvedMountain.longitude);
        const match = forecast.find((d) => d.date === date);
        if (!cancelled) {
          setDayWeather(match ? { icon: match.icon, description: match.description, tempMin: match.tempMin, tempMax: match.tempMax } : null);
        }
      } catch (error) {
        console.warn('[Hikes] Failed to load weather forecast', error);
        if (!cancelled) {
          setDayWeather(null);
        }
      }
    };

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [resolvedMountain?.id, resolvedMountain?.latitude, resolvedMountain?.longitude, date]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: '/Calendar', params: { mountainId } });
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleEdit = useCallback((hike: Hike) => {
    setEditingHike(hike);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback(async (hike: Hike): Promise<boolean> => {
    const { error } = await deleteHike(hike.id);
    if (error) {
      toastRef.current?.show({ type: 'error', title: 'Could not delete hike', message: error });
      return false;
    }
    // Remove the card right away, then re-sync the list from the server
    setDeletedIds((ids) => [...ids, hike.id]);
    if (mountainId) {
      useHikesStore.getState().fetchMountainHikes(mountainId);
    }
    // The permit gets ripped in half instead of the old "Hike deleted" toast
    permit.show('cancelled', buildPermitDetails(hike, mountainName));
    return true;
  }, [deleteHike, mountainId, mountainName, permit.show]);

  const renderHike = useCallback(
    ({ item }: { item: Hike }) => (
      <View style={{ width: cardWidth }}>
        <HikeCard
          hike={item}
          displayDate={date}
          weather={dayWeather}
          canEdit={item.user_id === user?.id}
          cardWidth={cardWidth}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </View>
    ),
    [date, dayWeather, user?.id, cardWidth, handleEdit, handleDelete]
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setMeasuredWidth((prev) => (prev === w ? prev : w));
      }}
    >
      <View style={[styles.header, { paddingHorizontal: sidePadding }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBackPress}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back-outline" size={16} color="#C9A96E" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerMountain} numberOfLines={1}>{mountainName ?? 'Hikes'}</Text>

          <View style={styles.headerMetaRow}>
            <View style={styles.headerPill}>
              <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.55)" />
              <Text style={styles.headerPillText}>{date ? formatDate(date) : ''}</Text>
            </View>
            <View style={styles.headerPill}>
              <Ionicons name="trail-sign-outline" size={10} color="rgba(201,169,110,0.9)" />
              <Text style={styles.headerPillText}>
                {hikesOnDate.length} hike{hikesOnDate.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {hikesOnDate.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="map-outline" size={26} color="rgba(201,169,110,0.6)" />
          </View>
          <Text style={styles.emptyText}>No hikes scheduled on this day</Text>
        </View>
      ) : (
        <FlatList
          key={`hikes-grid-${COLUMNS}`}
          data={hikesOnDate}
          keyExtractor={keyExtractor}
          numColumns={COLUMNS}
          renderItem={renderHike}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, { paddingHorizontal: sidePadding }]}
        />
      )}

      <HikeFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingHike={editingHike}
        defaultDate={date ?? new Date().toISOString().split('T')[0]}
        mountainId={mountainId}
        onSaved={() => {
          toastRef.current?.show({ type: 'success', title: 'Hike updated', message: 'Changes saved.' });
        }}
      />
      <Toast ref={toastRef} />
      {permit.element}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A111A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: OUTER_PADDING,
    paddingTop: 14,
    paddingBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMountain: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerPillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  list: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  // Cards in a row sit side by side with one even gutter; rows are spaced the same.
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  cardTouchable: {
    flex: 1,
  },
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0E1520',
    padding: 10,
    gap: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  // Other people's hikes get a subtle cool-blue tint on the card itself —
  // just enough to read as "different" at a glance, still calm at rest.
  cardShared: {
    borderColor: 'rgba(124,168,255,0.22)',
    backgroundColor: '#101724',
  },
  // A thin left accent bar in the ownership color (gold for yours, blue for
  // shared) — the fastest thing to scan across a whole grid of cards.
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapShared: {
    backgroundColor: 'rgba(124,168,255,0.12)',
    borderColor: 'rgba(124,168,255,0.22)',
  },
  cardBadgeStack: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    minHeight: 32,
  },
  cardInfoBlock: {
    minWidth: 0,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTime: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardRowText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    flexShrink: 1,
  },
  sharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(124,168,255,0.14)',
  },
  sharedPillText: {
    color: '#AECBFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // The main fill of the hold-to-delete wipe. Its backgroundColor is driven
  // by an Animated interpolation, so it visibly shifts hue (amber → red →
  // near-black) as the hold progresses rather than staying one flat red.
  deleteWipe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  // A slim, brighter "hot edge" riding right at the front of the wipe,
  // always a shade hotter than the fill behind it.
  deleteWipeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
  },
  deleteTrashWrap: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(201,169,110,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
  },
});