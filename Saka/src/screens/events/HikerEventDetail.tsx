import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Pressable,
  useWindowDimensions,
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
  T,
  SERIF,
  Screen,
  TopBar,
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

const formatDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });

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

function WeatherCard({ state }: { state: WeatherState }) {
  if (state.mode === 'hidden') return null;

  if (state.mode === 'loading') {
    return (
      <View style={[styles.weather, styles.weatherRow]}>
        <ActivityIndicator size="small" color={T.muted} />
        <Text style={styles.weatherQuiet}>Checking the mountain weather…</Text>
      </View>
    );
  }

  if (state.mode === 'forecast-soon') {
    return (
      <View style={[styles.weather, styles.weatherRow]}>
        <Ionicons name="partly-sunny-outline" size={18} color={T.muted} />
        <Text style={styles.weatherQuiet}>Weather forecast opens 5 days before the hike.</Text>
      </View>
    );
  }

  const weather = state.weather;
  const severity = getWeatherSeverity(weather);
  const config =
    severity === 'danger'
      ? { icon: 'alert-circle' as IconName, color: T.red, label: 'Weather warning' }
      : severity === 'caution'
      ? { icon: 'warning' as IconName, color: T.gold, label: 'Weather: take care' }
      : { icon: 'checkmark-circle' as IconName, color: T.green, label: 'Good hiking weather' };

  const advice = getWeatherSafetyAdvice(weather);
  const contextLine =
    state.mode === 'current'
      ? 'now'
      : state.approximate
      ? 'closest forecast'
      : 'at start time';

  return (
    <View style={[styles.weather, { borderColor: `${config.color}59`, backgroundColor: `${config.color}12` }]}>
      <View style={styles.weatherRow}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.weatherTitle, { color: config.color }]}>{config.label}</Text>
          <Text style={styles.weatherQuiet}>
            {weather.description}, {weather.temperature.toFixed(0)}°C. Wind {weather.windSpeed.toFixed(0)} m/s,
            humidity {weather.humidity}% ({contextLine}).
          </Text>
        </View>
      </View>
      {advice ? <Text style={styles.weatherAdvice}>{advice}</Text> : null}
    </View>
  );
}

/** A titled block of text. `tone="care"` makes safety info stand out. */
function Section({
  icon,
  title,
  text,
  tone,
  style,
}: {
  icon: IconName;
  title: string;
  text: string;
  tone?: 'care';
  style?: any;
}) {
  const care = tone === 'care';
  return (
    <View style={[styles.section, care && styles.sectionCare, style]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={care ? T.gold : T.muted} />
        <Text style={[styles.sectionTitle, care && { color: T.gold }]}>{title}</Text>
      </View>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

// ── Attendee chip: avatar + first name, wraps in a grid (no inner scrolling) ──
const AVATAR_SIZE = 38;
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
  const multiDay = !!event.end_date && event.end_date !== event.event_date;
  const capacity = hasCapacity ? (event.capacity as number) : 0;
  const pct = hasCapacity && capacity > 0 ? (counts.confirmed / capacity) * 100 : 0;
  const spotsLeft = hasCapacity ? Math.max(0, capacity - counts.confirmed) : null;

  const wide = width >= 720;

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
  const going = (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>Who's going ({goingCount})</Text>
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
      {hasWaitlisted ? <Text style={styles.weatherQuiet}>Gold ring means on the waitlist.</Text> : null}
    </View>
  );

  const hasText = !!(event.description || event.safety_notes || event.required_gear);
  const secondary = !!(event.safety_notes || event.required_gear);

  const main = (
    <View style={styles.main}>
      <View style={{ gap: 6 }}>
        <View style={styles.pills}>
          <Pill label={event.difficulty} color={difficultyColor(event.difficulty)} />
          {verified ? <Pill label="Verified organizer" icon="shield-checkmark" color={T.green} /> : null}
          {event.allow_walkins ? <Pill label="Walk-ins welcome" icon="walk-outline" color={T.muted} /> : null}
        </View>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.organizer}>Organized by {event.organizations?.name ?? 'the organizer'}</Text>
      </View>

      <View style={[styles.infoBlock, wide && { flexDirection: 'row' }]}>
        <View style={wide ? { flex: 1.2 } : undefined}>
          <InfoLine icon="calendar-outline" label="When" text={dateText} sub={timeText} />
        </View>
        <View style={wide ? { flex: 1 } : undefined}>
          <InfoLine icon="trail-sign-outline" label="Mountain" text={mountain?.name ?? '—'} />
        </View>
        <View style={wide ? { flex: 1.2 } : undefined}>
          <InfoLine icon="location-outline" label="Where to meet" text={event.meeting_point} />
        </View>
      </View>

      <WeatherCard state={weatherState} />

      {hasText ? (
        <View style={[styles.textRow, !wide && { flexDirection: 'column' }]}>
          {event.description ? (
            <Section
              icon="reader-outline"
              title="About this hike"
              text={event.description}
              style={wide && secondary ? { flex: 1.3 } : undefined}
            />
          ) : null}
          {secondary ? (
            <View style={[{ gap: 10 }, wide && { flex: 1 }]}>
              {event.safety_notes ? (
                <Section icon="shield-checkmark-outline" title="Safety" text={event.safety_notes} tone="care" />
              ) : null}
              {event.required_gear ? (
                <Section icon="bag-handle-outline" title="What to bring" text={event.required_gear} />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.weatherQuiet}>The organizer hasn't added more details yet.</Text>
      )}

      {!wide && attendees.length > 0 ? going : null}
    </View>
  );

  return (
    <>
      <Screen>
        <TopBar backLabel="Events" a11yLabel="Back to Events" onBack={() => router.back()} />

        {wide ? (
          <View style={styles.row}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {main}
            </ScrollView>

            <View style={styles.side}>
              <View style={styles.rsvpCard}>
                <Text style={styles.spotsHeadline}>{spotsHeadline}</Text>
                {hasCapacity && capacity > 0 ? <Meter value={pct} color={isFull ? T.orange : T.green} /> : null}
                <Text style={styles.spotsSub}>{spotsSub}</Text>
                <View style={{ marginTop: 4 }}>{action}</View>
              </View>

              {attendees.length > 0 ? <View style={styles.goingCard}>{going}</View> : null}
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {main}
            </ScrollView>
            <View style={styles.bottomBar}>
              <Text style={styles.bottomSpots}>
                {spotsHeadline}
                <Text style={styles.bottomSpotsSub}>{`  ${spotsSub}`}</Text>
              </Text>
              {action}
            </View>
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
  row: { flex: 1, flexDirection: 'row' },
  scrollContent: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 20 },
  main: { gap: 12 },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { color: T.text, fontFamily: SERIF, fontSize: 22, lineHeight: 27 },
  organizer: { color: T.muted, fontSize: 13 },
  infoBlock: { gap: 10 },
  textRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },

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

  // Side column (wide) and bottom bar (narrow)
  side: {
    width: 270,
    padding: 12,
    gap: 10,
    borderLeftWidth: 1,
    borderLeftColor: T.border,
  },
  rsvpCard: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  spotsHeadline: { color: T.text, fontFamily: SERIF, fontSize: 19 },
  spotsSub: { color: T.muted, fontSize: 13 },
  goingCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bottomBar: {
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.bg,
  },
  bottomSpots: { color: T.text, fontSize: 14, fontWeight: '700' },
  bottomSpotsSub: { color: T.muted, fontSize: 13, fontWeight: '400' },
  rsvpState: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rsvpStateText: { color: T.text, fontSize: 14, flex: 1, lineHeight: 19 },

  // Attendees
  attendeeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attendee: { width: 48, alignItems: 'center', gap: 3 },
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
});