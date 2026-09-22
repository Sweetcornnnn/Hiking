import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  Dimensions,
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

const COLUMNS = 3;
const OUTER_PADDING = 12;
const CARD_GAP = 8;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - OUTER_PADDING * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS;

// Slow, resistant hold: Easing.out(cubic) means the wipe races ahead early
// then visibly fights back the closer it gets to the edge, like it's
// resisting being deleted.
const HOLD_TO_DELETE_MS = 3700;
const HOLD_EASING = Easing.out(Easing.cubic);
const MAX_SHAKE_PX = 4;

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
  weather: DayWeather | null;
  canEdit: boolean;
  onEdit: (hike: Hike) => void;
  onDelete: (hike: Hike) => void;
}

// Tap = edit. Hold = a red wipe crawls left→right across the card, slowing
// down (resistance) as it nears the right edge, while the card shakes
// harder the further the wipe has gotten. Let go early and it snaps back —
// the wipe reaching the far edge IS the confirmation, no alert needed.
function HikeCard({ hike, weather, canEdit, onEdit, onDelete }: HikeCardProps) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fillAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const shakeLoop = useRef<Animated.CompositeAnimation | null>(null);
  const deletedRef = useRef(false);

  const startHold = () => {
    if (deletedRef.current) return;

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
        onDelete(hike);
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

  const cancelHold = () => {
    if (deletedRef.current) return;
    fillAnimation.current?.stop();
    shakeLoop.current?.stop();
    Animated.parallel([
      Animated.timing(fillAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const wipeWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CARD_WIDTH],
  });
  // Shake amplitude grows with how far the wipe has crawled.
  const shakeAmplitude = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MAX_SHAKE_PX],
  });
  const translateX = Animated.multiply(shakeAnim, shakeAmplitude);

  return (
    <Pressable
      onPress={() => canEdit && onEdit(hike)}
      onPressIn={() => canEdit && startHold()}
      onPressOut={() => canEdit && cancelHold()}
      style={styles.cardTouchable}
    >
      <Animated.View style={[styles.card, { transform: [{ translateX }] }]}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="trail-sign" size={30} color="#C9A96E" />
        </View>

        <View style={styles.cardInfoBlock}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTime} numberOfLines={1}>
              {formatTimeShort(hike.start_time)}–{formatTimeShort(hike.end_time)}
            </Text>
            {weather ? (
              <Ionicons name={getWeatherIconName(weather.icon)} size={11} color={getWeatherIconColor(weather.icon)} />
            ) : null}
            {!canEdit ? (
              <Ionicons name="eye-outline" size={11} color="rgba(255,255,255,0.55)" />
            ) : null}
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="people-outline" size={10} color="rgba(255,255,255,0.5)" />
            <Text style={styles.cardRowText}>{hike.tagalongs}</Text>
            {!canEdit ? (
              <Text style={styles.viewOnlyText}>View only</Text>
            ) : null}
          </View>
        </View>

        {canEdit ? (
          <Animated.View pointerEvents="none" style={[styles.deleteWipe, { width: wipeWidth }]} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

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

  const hikesOnDate = mountainHikes.filter((h) => h.date === date);
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

  const handleEdit = (hike: Hike) => {
    setEditingHike(hike);
    setModalVisible(true);
  };

  const handleDelete = async (hike: Hike) => {
    const { error } = await deleteHike(hike.id);
    if (error) {
      toastRef.current?.show({ type: 'error', title: 'Could not delete hike', message: error });
    } else {
      toastRef.current?.show({ type: 'success', title: 'Hike deleted', message: 'Removed from this day.' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
          <Text style={styles.headerSubtitle}>
            {date ? formatDate(date) : ''} · {hikesOnDate.length} hike{hikesOnDate.length === 1 ? '' : 's'} · your hikes can be edited, others are view-only
          </Text>
        </View>
      </View>

      {hikesOnDate.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={22} color="rgba(201,169,110,0.5)" />
          <Text style={styles.emptyText}>No hikes scheduled on this day</Text>
        </View>
      ) : (
        <FlatList
          data={hikesOnDate}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HikeCard
              hike={item}
              weather={dayWeather}
              canEdit={item.user_id === user?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
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
    gap: 10,
    paddingHorizontal: OUTER_PADDING,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMountain: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 1,
  },
  grid: {
    paddingHorizontal: OUTER_PADDING,
    paddingBottom: 16,
  },
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  cardTouchable: {
    width: CARD_WIDTH,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0E1520',
    paddingHorizontal: 8,
    gap: 8,
    overflow: 'hidden',
  },
  // Icon keeps its size but its wrapper is just big enough to hold it —
  // no longer stretched to fill most of the card.
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(201,169,110,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoBlock: {
    flex: 1,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  cardTime: {
    color: '#FFFFFF',
    fontSize: 10,
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
  },
  viewOnlyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    marginLeft: 4,
  },
  deleteWipe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#C0392B',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
  },
});