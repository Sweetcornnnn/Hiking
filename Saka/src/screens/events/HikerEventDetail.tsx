import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Pressable,
  Animated,
  BackHandler,
  Easing,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  eventService,
  eventPlannedFinish,
  type PublicEvent,
  type EventRsvpCounts,
  type MyRsvpWithSafetyCheck,
  type EventAttendee,
} from '../../services/eventService';
import { hikeSafetyService } from '../../services/hikeSafetyService';
import { cancelCheck, scheduleCheck } from '../../services/hikeSafetyNotifications';
import { supabase } from '../../lib/supabase';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import OfflineActionModal from '../../components/OfflineActionModal';
import { isConnectionError } from '../../services/offlineStatusService';
import { mountainService, type Mountain } from '../../services/mountainService';
import {
  getCurrentWeather,
  getForecastForEvent,
  getWeatherSafetyAdvice,
  type WeatherCondition,
} from '../../services/weatherService';
import ProfileCard from '../../components/chat/ProfileCard';
import {
  useHikePermit,
  buildPermitDetails,
  type SavedHikeLike,
  type PermitDetails,
} from '../../components/HikePermitModal';
import { getAvatarColor, getInitials } from '../../utils/colors';
import {
  PaperUnderlay,
  PaperOverlay,
  agePalette,
  getHikeAge,
  hashSeed,
  clamp01,
} from '../../components/HikeCardFace';
import {
  T,
  SERIF,
  Screen,
  CenterMessage,
  Button,
  Pill,
  InfoLine,
  Meter,
  difficultyColor,
  todayISO,
  parseISO,
  formatTime,
  type IconName,
} from '../../components/events/TrailKit';


// ── SAKA logo for the permit stamp ─────────────────────────
const sakaLogo = require('../../../assets/images/SakaLogo.png');

function PaperPanel({
  eventId,
  eventDate,
  endDate,
  ageing = true,
  style,
  children,
}: {
  eventId: string;
  eventDate: string;
  endDate?: string | null;
  ageing?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const age = ageing ? clamp01(getHikeAge(eventDate, endDate)) : 0;
  const palette = agePalette(true, age);
  const seed = hashSeed(eventId);

  return (
    <View
      style={[styles.paperPanel, { backgroundColor: palette.paper, borderColor: palette.edge }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        const nextSize = { width: Math.round(width), height: Math.round(height) };
        setSize((current) =>
          current.width === nextSize.width && current.height === nextSize.height
            ? current
            : nextSize
        );
      }}
    >
      {size.width > 0 && (
        <PaperUnderlay W={size.width} H={size.height} t={age} seed={seed} />
      )}
      {children}
      {size.width > 0 && (
        <PaperOverlay
          W={size.width}
          H={size.height}
          t={age}
          seed={seed}
          paper={palette.paper}
          flap={palette.flap}
        />
      )}
    </View>
  );
}

const formatDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });

const isEventPast = (event: PublicEvent) => {
  const plannedFinishAt = eventPlannedFinish(event);
  return plannedFinishAt
    ? plannedFinishAt.getTime() <= Date.now()
    : (event.end_date ?? event.event_date) < todayISO();
};

const daysUntil = (isoDate: string): number => {
  const today = parseISO(todayISO());
  const target = parseISO(isoDate);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

type Severity = 'safe' | 'caution' | 'danger';

function getWeatherSeverity(w: WeatherCondition): Severity {
  const desc = (w.description || '').toLowerCase();
  if (
    /thunder|typhoon|storm|gale|squall|heavy rain|torrential/.test(desc) ||
    w.windSpeed >= 15 ||
    w.precipitationMm >= 5
  ) {
    return 'danger';
  }
  if (
    /rain|shower|drizzle|fog|mist|overcast|snow/.test(desc) ||
    w.windSpeed >= 10 ||
    w.temperature >= 35 ||
    w.temperature <= 10 ||
    w.precipitationMm > 0
  ) {
    return 'caution';
  }
  return 'safe';
}

type WeatherState =
  | { mode: 'hidden' }
  | { mode: 'loading' }
  | { mode: 'forecast-soon' }
  | { mode: 'current'; weather: WeatherCondition }
  | { mode: 'forecast'; weather: WeatherCondition; approximate: boolean };

// Pick the cloud/sun icon that matches what the weather is doing right now.
function weatherIconFor(w: WeatherCondition): IconName {
  const d = (w.description || '').toLowerCase();
  if (/thunder|storm|typhoon|squall/.test(d)) return 'thunderstorm';
  if (/snow/.test(d)) return 'snow';
  if (/rain|shower|drizzle/.test(d)) return 'rainy';
  if (/overcast|broken|fog|mist|haze/.test(d)) return 'cloudy';
  if (/cloud/.test(d)) return 'partly-sunny';
  if (/clear|sun/.test(d)) return 'sunny';
  return 'partly-sunny';
}

type WeatherView = { icon: IconName; color: string; sheet: SheetContent };

// The weather lives behind an icon; this builds the icon and what the paper sheet says.
function getWeatherView(state: WeatherState): WeatherView | null {
  if (state.mode === 'hidden') return null;

  if (state.mode === 'loading') {
    return {
      icon: 'cloud-outline',
      color: T.muted,
      sheet: { icon: 'cloud-outline', title: 'Mountain weather', text: 'Checking the mountain weather…' },
    };
  }

  if (state.mode === 'forecast-soon') {
    return {
      icon: 'partly-sunny-outline',
      color: T.muted,
      sheet: {
        icon: 'partly-sunny-outline',
        title: 'Mountain weather',
        text: 'Weather forecast opens 5 days before the hike.',
      },
    };
  }

  const w = state.weather;
  const severity = getWeatherSeverity(w);
  const color = severity === 'danger' ? T.red : severity === 'caution' ? T.gold : T.green;
  const title =
    severity === 'danger' ? 'Weather warning' : severity === 'caution' ? 'Weather: take care' : 'Good hiking weather';
  const contextLine = state.mode === 'current' ? 'now' : state.approximate ? 'closest forecast' : 'at start time';
  const desc = w.description ? w.description.charAt(0).toUpperCase() + w.description.slice(1) : 'Conditions';
  const advice = getWeatherSafetyAdvice(w);
  const text =
    `${desc}, ${w.temperature.toFixed(0)}°C. Wind ${w.windSpeed.toFixed(0)} m/s, ` +
    `humidity ${w.humidity}% (${contextLine}).` +
    (advice ? `\n\n${advice}` : '');
  const icon = weatherIconFor(w);

  return {
    icon,
    color,
    sheet: { icon, title, text, tone: severity === 'safe' ? undefined : 'care' },
  };
}

/** A titled block of text. `tone="care"` makes safety info stand out. */
function Section({
  icon,
  title,
  text,
  tone,
  style,
  paper = false,
}: {
  icon: IconName;
  title: string;
  text: string;
  tone?: 'care';
  style?: any;
  paper?: boolean;
}) {
  const care = tone === 'care';
  return (
    <View style={[styles.section, care && styles.sectionCare, paper && styles.paperSection, style]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={care ? '#9A6B25' : paper ? '#6A6253' : T.muted} />
        <Text style={[styles.sectionTitle, paper && styles.paperSectionText, care && paper && { color: '#8A5E1C' }, care && !paper && { color: T.gold }]}>{title}</Text>
      </View>
      <Text style={[styles.bodyText, paper && styles.paperSectionText]}>{text}</Text>
    </View>
  );
}

function PaperInfoLine({ icon, label, text, sub }: {
  icon: IconName;
  label: string;
  text: string;
  sub?: string;
}) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.paperInfoIcon}>
        <Ionicons name={icon} size={16} color="#8A6B38" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.paperInfoLabel}>{label}</Text>
        <Text style={styles.paperInfoText}>{text}</Text>
        {sub ? <Text style={styles.paperInfoSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Compact info cell (icon + label + value) ──────────────
function InfoCell({
  icon,
  label,
  text,
  sub,
  paper = false,
  style,
}: {
  icon: IconName;
  label: string;
  text: string;
  sub?: string;
  paper?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.infoCell, paper ? styles.paperInfoCell : styles.darkInfoCell, style]}>
      <View
        style={[
          styles.infoCellIcon,
          { backgroundColor: paper ? 'rgba(138,107,56,0.14)' : T.goldSoft },
        ]}
      >
        <Ionicons name={icon} size={15} color={paper ? '#8A6B38' : T.gold} />
      </View>
      <View style={styles.infoCellText}>
        <Text style={[styles.infoCellLabel, { color: paper ? 'rgba(52,45,32,0.62)' : T.muted }]}>{label}</Text>
        <Text style={[styles.infoCellValue, { color: paper ? '#342D20' : T.text }]} numberOfLines={2}>
          {text}
        </Text>
        {sub ? (
          <Text
            style={[styles.infoCellSub, { color: paper ? 'rgba(43,74,140,0.82)' : T.muted }]}
            numberOfLines={1}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Tappable text tile: short preview here, full text on the paper sheet ──
type SheetContent = { icon: IconName; title: string; text: string; tone?: 'care' };
type SheetKey = 'about' | 'safety' | 'gear' | 'weather';

function DetailTile({
  icon,
  title,
  text,
  tone,
  paper = false,
  lines,
  grow = false,
  onPress,
  style,
}: {
  icon: IconName;
  title: string;
  text: string;
  tone?: 'care';
  paper?: boolean;
  lines: number;
  grow?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const care = tone === 'care';
  const accent = care ? (paper ? '#9A6B25' : T.gold) : paper ? '#6A6253' : T.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Open the full text`}
      style={({ pressed }) => [
        styles.tile,
        paper ? styles.paperTile : styles.darkTile,
        care && (paper ? styles.paperTileCare : styles.darkTileCare),
        grow && styles.tileGrow,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={16} color={accent} />
        <Text
          style={[
            styles.sectionTitle,
            { flex: 1 },
            paper && styles.paperSectionText,
            care && { color: paper ? '#8A5E1C' : T.gold },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={accent} />
      </View>
      <Text style={[styles.bodyText, paper && styles.paperSectionText]} numberOfLines={lines}>
        {text}
      </Text>
      {grow ? <Text style={[styles.tileMore, { color: accent }]}>Read more</Text> : null}
    </Pressable>
  );
}

// ── Dark sheet that lays itself over the left panel ──
// Slides up while straightening out, with the panel dimming behind it.
// Keeps its content mounted until the close animation has finished.
function InfoSheet({ content, onClose }: { content: SheetContent | null; onClose: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const wasOpen = useRef(false);
  const [shown, setShown] = useState<SheetContent | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const open = content !== null;

  useEffect(() => {
    if (content) {
      wasOpen.current = true;
      setShown(content);
      Animated.timing(progress, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      Animated.timing(progress, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, progress]);

  // Android back button closes the sheet before leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!shown) return null;

  const care = shown.tone === 'care';
  const accent = care ? T.gold : T.muted;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setPanelHeight(Math.round(e.nativeEvent.layout.height))}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.sheetScrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelHeight || 700, 0] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '0deg'] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.sheetBody}>
          <View style={styles.sheetHead}>
            <View style={[styles.sheetIcon, { backgroundColor: care ? T.goldSoft : T.ctrl }]}>
              <Ionicons name={shown.icon} size={17} color={care ? T.gold : T.body} />
            </View>
            <Text style={[styles.sheetTitle, { color: care ? T.gold : T.text }]} numberOfLines={1}>
              {shown.title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={T.text} />
            </Pressable>
          </View>
          <View style={styles.sheetRule} />
          <ScrollView style={styles.fill} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetText}>{shown.text}</Text>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Bare icon that wriggles every couple of seconds so people notice it ──
function WiggleIcon({ name, size, color }: { name: IconName; size: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shake = (to: number) =>
      Animated.timing(t, { toValue: to, duration: 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(
      Animated.sequence([shake(1), shake(-1), shake(1), shake(-1), shake(0), Animated.delay(1600)])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const rotate = t.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

// ── Small stat tile for the right panel ──
function StatTile({ icon, value, label, color }: { icon: IconName; value: string; label: string; color?: string }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={16} color={color ?? T.gold} />
      <Text
        style={[styles.statValue, color ? { color } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Attendee chip: avatar + first name, wraps in a grid (no inner scrolling) ──
const AVATAR_SIZE = 42;
const MAX_SHOWN = 12;

function AttendeeChip({
  attendee,
  onPress,
}: {
  attendee: EventAttendee;
  onPress: (userId: string) => void;
}) {
  const name = attendee.fullName || attendee.username || 'Hiker';
  const color = getAvatarColor(attendee.userId);
  const isWaitlist = attendee.status === 'waitlist';

  return (
    <Pressable
      onPress={() => onPress(attendee.userId)}
      style={({ pressed }) => [styles.attendee, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${name}${isWaitlist ? ', on the waitlist' : ''}. View profile`}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: color },
          isWaitlist && { borderWidth: 2, borderColor: T.gold },
        ]}
      >
        {attendee.avatarUrl ? (
          <Image source={{ uri: attendee.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
        )}
      </View>
      <Text style={styles.attendeeName} numberOfLines={1}>
        {name.split(' ')[0]}
      </Text>
    </Pressable>
  );
}

export default function HikerEventDetail() {
  useRequireAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [counts, setCounts] = useState<EventRsvpCounts>({ confirmed: 0, waitlist: 0, total: 0 });
  const [myRsvp, setMyRsvp] = useState<MyRsvpWithSafetyCheck | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineAction, setOfflineAction] = useState<'load' | 'rsvp' | 'cancel' | null>(null);

  const [weatherState, setWeatherState] = useState<WeatherState>({ mode: 'hidden' });

  // Profile card modal
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  // Which text sheet (About / Safety / What to bring) is laid over the left panel
  const [sheetKey, setSheetKey] = useState<SheetKey | null>(null);

  // Hike permit animation — replaces the confirmation Alerts.
  const permit = useHikePermit(sakaLogo);

  const fetchAll = useCallback(async () => {
    if (!eventId) {
      setError('Missing event id');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [evt, rsvp, attendeeList] = await Promise.all([
        eventService.getEventById(eventId),
        eventService.getMyRsvpForEventWithCheck(eventId),
        eventService.getEventAttendees(eventId),
      ]);
      if (!evt) {
        setError('Event not found');
        return;
      }
      setEvent(evt);
      setMyRsvp(rsvp);
      setAttendees(attendeeList);
      setOfflineAction(null);

      const cached = mountainService.getCachedMountainById(evt.mountain_id);
      if (cached) {
        setMountain(cached);
      } else {
        mountainService.fetchMountainById(evt.mountain_id).then(setMountain);
      }

      const c = await eventService.getRsvpCounts([evt.id]);
      setCounts(c[evt.id] ?? { confirmed: 0, waitlist: 0, total: 0 });
    } catch (e: any) {
      if (isConnectionError(e)) {
        setOfflineAction('load');
        setError('Connect to the internet to load hike details.');
      } else {
        setOfflineAction(null);
        setError(e?.message ?? 'Failed to load event');
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Weather: branch on how far out the event is.
  useEffect(() => {
    if (!event || !mountain) return;

    const days = daysUntil(event.event_date);

    if (days < 0) {
      setWeatherState({ mode: 'hidden' });
      return;
    }

    if (days > 5) {
      setWeatherState({ mode: 'forecast-soon' });
      return;
    }

    let cancelled = false;
    setWeatherState({ mode: 'loading' });

    const load = async () => {
      try {
        if (days === 0) {
          const w = await getCurrentWeather(mountain.latitude, mountain.longitude);
          if (!cancelled) setWeatherState({ mode: 'current', weather: w });
          return;
        }

        const w = await getForecastForEvent(
          mountain.latitude,
          mountain.longitude,
          event.event_date,
          event.start_time
        );

        if (cancelled) return;

        if (!w) {
          setWeatherState({ mode: 'forecast-soon' });
        } else {
          const eventHour = Number(event.start_time.split(':')[0]) || 0;
          const slotHour = Math.round(eventHour / 3) * 3;
          const approximate = Math.abs(eventHour - slotHour) > 1;
          setWeatherState({ mode: 'forecast', weather: w, approximate });
        }
      } catch (e) {
        console.warn('[HikerEventDetail] weather fetch failed:', e);
        if (!cancelled) setWeatherState({ mode: 'hidden' });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [event, mountain]);

  const isFull =
    event?.capacity !== null && event?.capacity !== undefined
      ? counts.confirmed >= (event.capacity as number)
      : false;

  const hasActiveRsvp =
    myRsvp && ['confirmed', 'pending', 'waitlist'].includes(myRsvp.status);

  const buildPermitForEvent = useCallback(
    (evt: PublicEvent, mountainName?: string | null): PermitDetails => {
      const hikeLike: SavedHikeLike = {
        date: evt.event_date,
        end_date: evt.end_date ?? null,
        start_time: evt.start_time,
        end_time: evt.end_time ?? evt.start_time,
        tagalongs: (evt as any).capacity ?? undefined,
      };
      return buildPermitDetails(hikeLike, mountainName ?? mountain?.name ?? null);
    },
    [mountain]
  );

  const handleRsvp = async () => {
    if (!event) return;
    if (isEventPast(event)) {
      Alert.alert('Hike already finished', 'RSVPs are closed for this event.');
      return;
    }

    setWorking(true);
    try {
      const { status, error: e } = await eventService.rsvpToEvent(event.id, 1);

      if (e) {
        if (isConnectionError(e)) {
          setOfflineAction('rsvp');
        } else {
          setOfflineAction(null);
          Alert.alert('RSVP failed', e);
        }
        return;
      }

      setOfflineAction(null);
      const details = buildPermitForEvent(event);
      permit.show('approved', details);

      const plannedFinishAt = eventPlannedFinish(event);
      if (plannedFinishAt && plannedFinishAt.getTime() > Date.now()) {
        try {
          const [rsvp, { data: { user } }] = await Promise.all([
            eventService.getMyRsvpForEventWithCheck(event.id),
            supabase.auth.getUser(),
          ]);

          if (rsvp && user) {
            const { checkId, error } = await hikeSafetyService.upsertEventCheck({
              eventId: event.id,
              rsvpId: rsvp.id,
              userId: user.id,
              plannedFinishAt,
            });

            if (error || !checkId) {
              console.warn('[HikerEventDetail] Could not save event safety check:', error);
            } else {
              if (rsvp.safety_check_id) await cancelCheck(rsvp.safety_check_id);
              await scheduleCheck({ checkId, kind: 'event', plannedFinishAt });
            }
          }
        } catch (safetyError) {
          console.warn('[HikerEventDetail] Could not schedule event safety check:', safetyError);
        }
      }

      await fetchAll();
    } catch (err: any) {
      if (isConnectionError(err)) {
        setOfflineAction('rsvp');
      } else {
        setOfflineAction(null);
        Alert.alert('RSVP failed', err?.message ?? String(err));
      }
    } finally {
      setWorking(false);
    }
  };

  const doCancel = useCallback(async () => {
    if (!myRsvp || !event) return;
    setWorking(true);
    try {
      const { error: e } = await eventService.cancelMyRsvp(myRsvp.id);
      if (e) {
        if (isConnectionError(e)) {
          setOfflineAction('cancel');
        } else {
          setOfflineAction(null);
          Alert.alert('Cancel failed', e);
        }
        return;
      }

      setOfflineAction(null);
      const details = buildPermitForEvent(event);
      permit.show('cancelled', details);

      if (myRsvp.safety_check_id) await cancelCheck(myRsvp.safety_check_id);
      await hikeSafetyService.deleteEventCheck(myRsvp.id);
      await fetchAll();
    } catch (err: any) {
      if (isConnectionError(err)) {
        setOfflineAction('cancel');
      } else {
        setOfflineAction(null);
        Alert.alert('Cancel failed', err?.message ?? String(err));
      }
    } finally {
      setWorking(false);
    }
  }, [myRsvp, event, buildPermitForEvent, permit]);

  const handleCancel = () => {
    if (!myRsvp) return;
    doCancel();
  };

  const goingCount = useMemo(
    () => attendees.filter((a) => a.status !== 'waitlist').length,
    [attendees]
  );

  if (loading) return <CenterMessage loading message="Loading hike…" />;
  if (error || !event) {
    return (
      <>
        <CenterMessage
          message={error ?? 'Event not found'}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
        <OfflineActionModal
          visible={offlineAction === 'load'}
          message="Hike details need an internet connection to load. Connect and try again."
          onRetry={() => void fetchAll()}
          onDismiss={() => setOfflineAction(null)}
        />
      </>
    );
  }


  const hasCapacity = event.capacity !== null && event.capacity !== undefined;
  const isWaitlisted = myRsvp?.status === 'waitlist';
  const verified = !!event.organizations?.is_verified;
  const isPastEvent = isEventPast(event);
  const multiDay = !!event.end_date && event.end_date !== event.event_date;
  const capacity = hasCapacity ? (event.capacity as number) : 0;
  const pct = hasCapacity && capacity > 0 ? (counts.confirmed / capacity) * 100 : 0;
  const spotsLeft = hasCapacity ? Math.max(0, capacity - counts.confirmed) : null;

  const wide = width >= 720;
  // On wide screens the left panel is a fixed card that never scrolls;
  // only the right panel scrolls.
  const fixed = wide;

  const dateText = multiDay
    ? `${formatDate(event.event_date)} to ${formatDate(event.end_date as string)}`
    : formatDate(event.event_date);
  const timeText = event.end_time
    ? `${formatTime(event.start_time)} to ${formatTime(event.end_time)}`
    : `Starts ${formatTime(event.start_time)}${event.duration_hours ? `, about ${event.duration_hours} hours` : ''}`;

  const spotsHeadline = hasCapacity
    ? isFull
      ? 'This hike is full'
      : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`
    : `${counts.confirmed} going`;
  const spotsSub = hasCapacity
    ? `${counts.confirmed} of ${capacity} taken${counts.waitlist > 0 ? `, ${counts.waitlist} waiting` : ''}`
    : counts.waitlist > 0
    ? `${counts.waitlist} waiting`
    : 'No limit on spots';

  // The one thing a hiker came here to do.
  const action = hasActiveRsvp ? (
    <View style={{ gap: 8 }}>
      <View style={styles.rsvpState}>
        <Ionicons
          name={isWaitlisted ? 'hourglass-outline' : 'checkmark-circle'}
          size={18}
          color={isWaitlisted ? T.gold : T.green}
        />
        <Text style={styles.rsvpStateText}>
          {isWaitlisted ? "You're on the waitlist." : "You're going. See you on the trail."}
        </Text>
      </View>
      <Button
        label="Cancel RSVP"
        variant="danger"
        loading={working}
        disabled={working}
        onPress={handleCancel}
      />
    </View>
  ) : (
    <Button
      icon={isFull ? 'hourglass-outline' : 'checkmark-circle-outline'}
      label={isFull ? 'Join the waitlist' : 'Join this hike'}
      loading={working}
      disabled={working}
      onPress={handleRsvp}
    />
  );

  const hasWaitlisted = attendees.some((a) => a.status === 'waitlist');
  const spotsBig = hasCapacity ? String(spotsLeft ?? 0) : String(counts.confirmed);
  const spotsLabel = hasCapacity ? (spotsLeft === 1 ? 'spot left' : 'spots left') : 'going';

  const daysToGo = daysUntil(event.event_date);
  const countdown =
    daysToGo > 1 ? `In ${daysToGo} days` : daysToGo === 1 ? 'Tomorrow' : daysToGo === 0 ? 'Hike day' : 'Happening now';
  const shortDate = parseISO(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const groupText = hasCapacity ? String(capacity) : 'Open';
  const durationText = multiDay
    ? `${Math.round((parseISO(event.end_date as string).getTime() - parseISO(event.event_date).getTime()) / 86_400_000) + 1} days`
    : event.duration_hours
    ? `${event.duration_hours} h`
    : '—';
  const levelText = event.difficulty.charAt(0).toUpperCase() + event.difficulty.slice(1);

  const attendeeGridEl = (
    <View style={styles.attendeeGrid}>
      {attendees.slice(0, MAX_SHOWN).map((a) => (
        <AttendeeChip key={a.rsvpId} attendee={a} onPress={setProfileUserId} />
      ))}
      {attendees.length > MAX_SHOWN ? (
        <View style={styles.attendee}>
          <View style={[styles.avatar, { backgroundColor: T.ctrl }]}>
            <Text style={styles.avatarInitials}>+{attendees.length - MAX_SHOWN}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const goingHeader = (
    <View style={styles.pastGoingHeader}>
      <View style={styles.pastGoingTitleWrap}>
        <Ionicons name="people-outline" size={18} color={T.gold} />
        <Text style={styles.pastGoingTitle}>Who's going</Text>
      </View>
      <View style={styles.countChip}>
        <Text style={styles.countChipText}>{goingCount}</Text>
      </View>
    </View>
  );

  // Narrow layout: sits inside the main column.
  const going = (
    <View style={styles.goingWrap}>
      {goingHeader}
      {attendeeGridEl}
      {hasWaitlisted ? <Text style={styles.weatherQuiet}>Gold ring means on the waitlist.</Text> : null}
    </View>
  );

  // Wide layout: always shown, with an invitation when nobody has joined yet.
  const sideGoing = (
    <View style={styles.sideGoing}>
      {goingHeader}
      {attendees.length > 0 ? (
        <>
          {attendeeGridEl}
          {hasWaitlisted ? <Text style={styles.weatherQuiet}>Gold ring means on the waitlist.</Text> : null}
          <Text style={styles.goingHint}>Tap a hiker to see their profile.</Text>
        </>
      ) : (
        <View style={styles.goingEmpty}>
          <View style={styles.goingEmptyIcon}>
            <Ionicons name="people-outline" size={26} color={T.gold} />
          </View>
          <Text style={styles.goingEmptyTitle}>Nobody's signed up yet</Text>
          <Text style={styles.goingEmptyText}>Claim the first spot and the rest of the crew will follow.</Text>
        </View>
      )}
    </View>
  );

  const pastAttendees = attendees.filter((attendee) => attendee.status !== 'waitlist');
  const pastGoing = (
    <View style={styles.pastGoing}>
      <View style={styles.pastGoingHeader}>
        <View style={styles.pastGoingTitleWrap}>
          <Ionicons name="footsteps-outline" size={18} color={T.gold} />
          <Text style={styles.pastGoingTitle}>The muddy-boot crew</Text>
        </View>
        <View style={styles.pastGoingCount}>
          <Text style={styles.pastGoingCountNumber}>{pastAttendees.length}</Text>
          <Text style={styles.pastGoingCountLabel}>trail legends</Text>
        </View>
      </View>
      {pastAttendees.length > 0 ? (
        <View style={styles.attendeeGrid}>
          {pastAttendees.slice(0, MAX_SHOWN).map((attendee) => (
            <AttendeeChip
              key={attendee.rsvpId}
              attendee={attendee}
              onPress={setProfileUserId}
            />
          ))}
          {pastAttendees.length > MAX_SHOWN ? (
            <View style={styles.attendee}>
              <View style={[styles.avatar, { backgroundColor: T.ctrl }]}>
                <Text style={styles.avatarInitials}>+{pastAttendees.length - MAX_SHOWN}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.paperEmptyText}>No muddy boots hit this trail.</Text>
      )}
    </View>
  );

  const secondary = !!(event.safety_notes || event.required_gear);

  const weatherView = getWeatherView(weatherState);

  const sheetContent: SheetContent | null =
    sheetKey === 'weather' && weatherView
      ? weatherView.sheet
      : sheetKey === 'about' && event.description
      ? { icon: 'clipboard-outline', title: 'The Trail Gossip', text: event.description }
      : sheetKey === 'safety' && event.safety_notes
      ? { icon: 'shield-checkmark-outline', title: 'Safety', text: event.safety_notes, tone: 'care' }
      : sheetKey === 'gear' && event.required_gear
      ? { icon: 'bag-handle-outline', title: 'What to bring', text: event.required_gear }
      : null;

  const main = (
    <View style={[styles.main, fixed && styles.fill]}>
      <View style={[styles.headerBlock, isPastEvent && styles.paperHeaderBlock]}>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isPastEvent && styles.paperMainText]} numberOfLines={2}>
              {event.title}
            </Text>
            <Pill label={event.difficulty} color={difficultyColor(event.difficulty)} />
          </View>
          <View style={styles.organizerRow}>
            <Text style={[styles.organizer, isPastEvent && styles.paperSubText]} numberOfLines={1}>
              Organized by {event.organizations?.name ?? 'the organizer'}
            </Text>
            {verified ? <Pill label="Verified organizer" icon="shield-checkmark" color={T.green} /> : null}
            {event.allow_walkins && !isPastEvent ? (
              <Pill label="Walk-ins welcome" icon="walk-outline" color={T.muted} />
            ) : null}
          </View>
        </View>
        {weatherView || event.description ? (
          <View style={styles.headerIcons}>
            {weatherView ? (
              <Pressable
                onPress={() => setSheetKey('weather')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${weatherView.sheet.title}. Tap for the weather details`}
                style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }}
              >
                <Ionicons name={weatherView.icon} size={28} color={weatherView.color} />
              </Pressable>
            ) : null}
            {event.description ? (
              <Pressable
                onPress={() => setSheetKey('about')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Read the trail gossip about this hike"
                style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }}
              >
                <WiggleIcon name="clipboard" size={26} color={isPastEvent ? '#8A6B38' : T.gold} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoPair}>
          <InfoCell
            icon="location-outline"
            label="Where to meet"
            text={event.meeting_point}
            paper={isPastEvent}
            style={{ flex: 1.3 }}
          />
          <InfoCell
            icon="trail-sign-outline"
            label="Mountain"
            text={mountain?.name ?? '—'}
            paper={isPastEvent}
            style={{ flex: 1 }}
          />
        </View>
        <InfoCell
          icon="calendar-outline"
          label="When"
          text={dateText}
          sub={timeText}
          paper={isPastEvent}
        />
      </View>

      {secondary ? (
        <View style={[styles.tilePair, fixed && styles.fill]}>
          {event.safety_notes ? (
            <DetailTile
              icon="shield-checkmark-outline"
              title="Safety"
              text={event.safety_notes}
              tone="care"
              lines={fixed ? 6 : 3}
              grow={fixed}
              paper={isPastEvent}
              style={{ flex: 1 }}
              onPress={() => setSheetKey('safety')}
            />
          ) : null}
          {event.required_gear ? (
            <DetailTile
              icon="bag-handle-outline"
              title="What to bring"
              text={event.required_gear}
              lines={fixed ? 6 : 3}
              grow={fixed}
              paper={isPastEvent}
              style={{ flex: 1 }}
              onPress={() => setSheetKey('gear')}
            />
          ) : null}
        </View>
      ) : !event.description ? (
        <Text style={isPastEvent ? styles.paperWeatherQuiet : styles.weatherQuiet}>
          The organizer hasn't added more details yet.
        </Text>
      ) : null}

      {!wide && !isPastEvent && attendees.length > 0 ? going : null}
    </View>
  );

  const mainPanel = isPastEvent ? (
    <PaperPanel
      eventId={`${event.id}-details`}
      eventDate={event.event_date}
      endDate={event.end_date}
      ageing={false}
      style={wide ? styles.fill : undefined}
    >
      <View style={[styles.paperDetailMainPanel, wide && styles.fill]}>{main}</View>
    </PaperPanel>
  ) : (
    <View style={[styles.detailMainPanel, wide && styles.fill]}>{main}</View>
  );

  const sheetNode = (
    <InfoSheet content={sheetContent} onClose={() => setSheetKey(null)} />
  );

  return (
    <>
      <Screen>
        <View style={styles.detailHeader}>
          <Pressable
            onPress={() => router.back()}
            style={styles.detailBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Events"
          >
            <Ionicons name="chevron-back" size={20} color={T.gold} />
            <Text style={styles.detailBackText}>Events</Text>
          </Pressable>
          <View style={styles.detailHeaderTitle}>
            <Text style={styles.detailHeaderEyebrow}>YOUR HIKE PLAN</Text>
            <Text style={styles.detailHeaderName} numberOfLines={1}>{event.title}</Text>
          </View>
          <View style={styles.detailHeaderSpacer} />
        </View>

        {wide ? (
          <View style={styles.row}>
            {/* Left: the hike plan. A fixed card, no scrolling. */}
            <View style={styles.leftCol}>
              <View style={styles.fixedWrap}>{mainPanel}</View>
              {sheetNode}
            </View>

            {/* Right: one card with the same footprint as the left. */}
            <View style={styles.side}>
              <View style={styles.sideCard}>
                <ScrollView
                  style={styles.fill}
                  contentContainerStyle={styles.sideScroll}
                  showsVerticalScrollIndicator={false}
                >
                {isPastEvent ? (
                  pastGoing
                ) : (
                  <>
                    <PaperPanel eventId={event.id} eventDate={event.event_date} endDate={event.end_date}>
                      <View style={styles.rsvpCard}>
                        <View style={styles.ticketHead}>
                          <View style={styles.ticketHeadLeft}>
                            <Ionicons name="time-outline" size={16} color="#8A6B38" />
                            <Text style={styles.ticketCountdown}>{countdown}</Text>
                          </View>
                          <Text style={styles.ticketDate}>{shortDate}</Text>
                        </View>

                        {/* Tear-off line with the two ticket notches */}
                        <View style={styles.ticketRuleWrap}>
                          <View style={styles.ticketRuleClip}>
                            <View style={styles.ticketRuleDash} />
                          </View>
                          <View style={[styles.notch, { left: -25 }]} />
                          <View style={[styles.notch, { right: -25 }]} />
                        </View>

                        <View style={styles.rsvpTop}>
                          <Text style={styles.spotsBig}>{spotsBig}</Text>
                          <View style={styles.rsvpTopText}>
                            <Text style={styles.spotsLabel}>{spotsLabel}</Text>
                            <Text style={styles.spotsSub}>{spotsSub}</Text>
                          </View>
                        </View>
                        {hasCapacity && capacity > 0 ? (
                          <Meter value={pct} color={isFull ? T.orange : T.green} />
                        ) : null}
                        {action}
                      </View>
                    </PaperPanel>

                    <View style={styles.statRow}>
                      <StatTile icon="people-outline" value={groupText} label="Group size" />
                      <StatTile icon="time-outline" value={durationText} label="Duration" />
                      <StatTile
                        icon="speedometer-outline"
                        value={levelText}
                        label="Level"
                        color={difficultyColor(event.difficulty)}
                      />
                    </View>

                    {sideGoing}
                  </>
                )}
                </ScrollView>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.narrowCol}>
              <ScrollView
                style={styles.fill}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {mainPanel}
              </ScrollView>
              {sheetNode}
            </View>
            {isPastEvent ? <View style={[styles.goingCard, styles.mobilePastGoing]}>{pastGoing}</View> : null}
            {!isPastEvent ? (
              <View style={styles.bottomBar}>
                <Text style={styles.bottomSpots}>
                  {spotsHeadline}
                  <Text style={styles.bottomSpotsSub}>{`  ${spotsSub}`}</Text>
                </Text>
                {action}
              </View>
            ) : null}
          </>
        )}
      </Screen>

      {/* ── Profile card modal ── */}
      <ProfileCard
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onMessagePress={(id) => {
          setProfileUserId(null);
          // router.push(`/chat/${id}`);
        }}
      />

      {/* Hike permit animation — the "assurance" instead of a dialog. */}
      {permit.element}
      <OfflineActionModal
        visible={offlineAction !== null}
        message={offlineAction === 'load'
          ? 'Hike details need an internet connection to load. Connect and try again.'
          : offlineAction === 'cancel'
            ? 'Canceling an RSVP needs an internet connection. Connect and try again.'
            : 'Joining this hike needs an internet connection. Your RSVP has not been submitted.'}
        retrying={working}
        onRetry={() => {
          if (offlineAction === 'load') {
            void fetchAll();
          } else if (offlineAction === 'cancel') {
            void doCancel();
          } else {
            void handleRsvp();
          }
        }}
        onDismiss={() => setOfflineAction(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  detailScroll: { flex: 1, marginHorizontal: 16 },
  wideDetailScroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 20 },
  detailHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  detailBack: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 70 },
  detailBackText: { color: T.gold, fontSize: 13, fontWeight: '600' },
  detailHeaderTitle: { flex: 1, alignItems: 'center', gap: 2 },
  detailHeaderEyebrow: { color: T.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  detailHeaderName: { color: T.text, fontFamily: SERIF, fontSize: 17, textAlign: 'center' },
  detailHeaderSpacer: { width: 70 },
  detailMainPanel: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  paperDetailMainPanel: { gap: 10, padding: 14 },
  main: { gap: 10 },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { color: T.text, fontFamily: SERIF, fontSize: 20, lineHeight: 25, flexShrink: 1 },
  paperMainText: { color: '#342D20' },
  organizerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  organizer: { color: T.muted, fontSize: 13 },
  paperSubText: { color: 'rgba(43,74,140,0.82)' },
  paperHeaderBlock: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(138,107,56,0.25)' },
  infoBlock: { gap: 10 },
  textRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  paperInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,107,56,0.12)',
  },
  paperInfoLabel: { color: 'rgba(52,45,32,0.66)', fontSize: 12 },
  paperInfoText: { color: '#342D20', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  paperInfoSub: { color: 'rgba(43,74,140,0.82)', fontSize: 13, marginTop: 1 },

  // Weather
  weather: {
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
    backgroundColor: T.ctrl,
  },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weatherTitle: { color: T.body, fontSize: 14, fontWeight: '700' },
  weatherQuiet: { color: T.muted, fontSize: 13, lineHeight: 18 },
  weatherAdvice: { color: T.body, fontSize: 13, lineHeight: 19 },
  paperWeather: { borderColor: 'rgba(138,107,56,0.3)', backgroundColor: 'rgba(255,255,255,0.35)' },
  paperWeatherQuiet: { color: 'rgba(52,45,32,0.76)', fontSize: 13, lineHeight: 18 },
  paperWeatherAdvice: { color: '#342D20', fontSize: 13, lineHeight: 19 },

  // Text sections
  section: { gap: 6 },
  sectionCare: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.goldLine,
    backgroundColor: T.goldSoft,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: T.text, fontFamily: SERIF, fontSize: 15 },
  bodyText: { color: T.body, fontSize: 13, lineHeight: 19 },
  paperSection: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(138,107,56,0.22)', backgroundColor: 'rgba(255,255,255,0.3)' },
  paperSectionText: { color: '#342D20' },

  // Side column (wide) and bottom bar (narrow)
  side: {
    width: 300,
    paddingVertical: 12,
  },
  sideScroll: { flexGrow: 1, gap: 12 },
  sideCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  paperPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
  },
  rsvpCard: {
    zIndex: 1,
    gap: 12,
    padding: 16,
  },
  rsvpTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spotsBig: { color: '#342D20', fontFamily: SERIF, fontSize: 44, lineHeight: 48 },
  rsvpTopText: { flex: 1, gap: 1 },
  spotsLabel: { color: '#342D20', fontSize: 15, fontWeight: '700' },
  spotsSub: { color: 'rgba(43,74,140,0.78)', fontSize: 12, lineHeight: 16 },
  ticketRuleWrap: { height: 1, position: 'relative' },
  ticketRuleClip: { height: 1, overflow: 'hidden' },
  ticketRuleDash: {
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(138,107,56,0.45)',
    borderRadius: 1,
  },
  notch: {
    position: 'absolute',
    top: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.card,
  },
  statRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  statValue: { color: T.text, fontFamily: SERIF, fontSize: 16 },
  statLabel: { color: T.muted, fontSize: 11 },
  goingCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pastGoing: { gap: 12 },
  pastGoingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pastGoingTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pastGoingTitle: { color: T.text, fontFamily: SERIF, fontSize: 16, flexShrink: 1 },
  pastGoingCount: {
    alignItems: 'center',
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: T.goldSoft,
    borderWidth: 1,
    borderColor: T.goldLine,
  },
  pastGoingCountNumber: { color: T.gold, fontSize: 17, fontWeight: '800', lineHeight: 20 },
  pastGoingCountLabel: { color: T.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  paperEmptyText: { color: T.muted, fontSize: 13, lineHeight: 18 },
  bottomBar: {
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.bg,
  },
  bottomSpots: { color: T.text, fontSize: 14, fontWeight: '700' },
  bottomSpotsSub: { color: T.muted, fontSize: 13, fontWeight: '400' },
  rsvpState: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rsvpStateText: { color: '#342D20', fontSize: 14, flex: 1, lineHeight: 19 },

  // Attendees
  attendeeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attendee: { width: 58, alignItems: 'center', gap: 3 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: '#fff', fontSize: 13, fontWeight: '800' },
  attendeeName: { color: T.body, fontSize: 12 },
  mobilePastGoing: { marginHorizontal: 16, marginBottom: 8 },

  // Header + gossip button
  headerBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, gap: 4 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },

  // RSVP ticket head
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticketCountdown: { color: '#342D20', fontSize: 14, fontWeight: '700' },
  ticketDate: { color: 'rgba(43,74,140,0.82)', fontSize: 13, fontWeight: '600' },

  // Who's going (side)
  sideGoing: {
    flexGrow: 1,
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  goingHint: { marginTop: 'auto', color: T.muted, fontSize: 12 },
  goingEmpty: { flexGrow: 1, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  goingEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.goldSoft,
    borderWidth: 1,
    borderColor: T.goldLine,
  },
  goingEmptyTitle: { color: T.text, fontFamily: SERIF, fontSize: 16, textAlign: 'center' },
  goingEmptyText: { color: T.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  // Layout helpers
  fill: { flex: 1 },
  fillCard: { flex: 1, overflow: 'hidden' },
  leftCol: { flex: 1, position: 'relative' },
  narrowCol: { flex: 1, marginHorizontal: 16, position: 'relative' },
  fixedWrap: { flex: 1, paddingVertical: 12 },
  goingWrap: { gap: 12 },
  countChip: {
    minWidth: 28,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: T.goldSoft,
    borderWidth: 1,
    borderColor: T.goldLine,
  },
  countChipText: { color: T.gold, fontSize: 13, fontWeight: '800' },
  weatherCompact: { paddingVertical: 8, gap: 2 },

  // Compact info cells
  infoGrid: { gap: 8 },
  infoPair: { flexDirection: 'row', gap: 8 },
  infoCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 0,
  },
  darkInfoCell: { borderColor: T.ctrlBorder, backgroundColor: T.ctrl },
  paperInfoCell: { borderColor: 'rgba(138,107,56,0.22)', backgroundColor: 'rgba(255,255,255,0.3)' },
  infoCellIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoCellText: { flex: 1, minWidth: 0 },
  infoCellLabel: { fontSize: 11 },
  infoCellValue: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  infoCellSub: { fontSize: 12, marginTop: 1 },

  // Tappable text tiles
  tiles: { gap: 8 },
  tilePair: { flexDirection: 'row', gap: 8 },
  tile: { gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  tileGrow: { flexGrow: 1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileMore: { marginTop: 'auto', fontSize: 12, fontWeight: '700' },
  darkTile: { borderColor: T.ctrlBorder, backgroundColor: T.ctrl },
  darkTileCare: { borderColor: T.goldLine, backgroundColor: T.goldSoft },
  paperTile: { borderColor: 'rgba(138,107,56,0.22)', backgroundColor: 'rgba(255,255,255,0.3)' },
  paperTileCare: { borderColor: 'rgba(154,107,37,0.4)', backgroundColor: 'rgba(154,107,37,0.1)' },

  // Paper sheet
  sheetScrim: { backgroundColor: 'rgba(4,7,12,0.55)' },
  sheet: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 18,
  },
  sheetBody: { flex: 1, padding: 16, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { flex: 1, fontFamily: SERIF, fontSize: 19 },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetRule: { height: 1, backgroundColor: T.border },
  sheetText: { color: T.body, fontSize: 15, lineHeight: 23, paddingBottom: 8 },
});