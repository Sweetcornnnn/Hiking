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
  D,
  Shell,
  Sidebar,
  Center,
  RightPane,
  CenterMessage,
  SidebarHeader,
  SectionLabel,
  ActionButton,
  Badge,
  MetaRow,
  Meter,
  Panel,
  todayISO,
  parseISO,
  formatTime,
  type IconName,
} from '../../components/events/DesktopKit';

// ── SAKA logo for the permit stamp ─────────────────────────
const sakaLogo = require('../../../assets/images/SakaLogo.png');

const formatDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
      <Panel style={styles.weatherRow}>
        <ActivityIndicator size="small" color={D.muted} />
        <Text style={styles.weatherQuiet}>Checking mountain weather…</Text>
      </Panel>
    );
  }

  if (state.mode === 'forecast-soon') {
    return (
      <Panel style={{ gap: 3 }}>
        <View style={styles.weatherHead}>
          <Ionicons name="calendar-outline" size={13} color={D.muted} />
          <Text style={styles.weatherQuietTitle}>Forecast not available yet</Text>
        </View>
        <Text style={styles.weatherQuiet}>Forecasts open 5 days before the hike.</Text>
      </Panel>
    );
  }

  const weather = state.weather;
  const severity = getWeatherSeverity(weather);
  const config =
    severity === 'danger'
      ? { icon: 'alert-circle' as IconName, color: D.red, bg: 'rgba(224,112,112,0.08)', border: 'rgba(224,112,112,0.3)', label: 'Weather warning' }
      : severity === 'caution'
      ? { icon: 'warning' as IconName, color: D.gold, bg: D.goldSoft, border: D.goldLine, label: 'Weather advisory' }
      : { icon: 'checkmark-circle' as IconName, color: D.green, bg: 'rgba(63,214,157,0.06)', border: 'rgba(63,214,157,0.26)', label: 'Weather looks good' };

  const advice = getWeatherSafetyAdvice(weather);
  const contextLine =
    state.mode === 'current'
      ? 'Current conditions'
      : state.approximate
      ? 'Nearest available forecast'
      : 'Forecast for hike start';

  return (
    <Panel style={{ gap: 3, backgroundColor: config.bg, borderColor: config.border }}>
      <View style={styles.weatherHead}>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={[styles.weatherLabel, { color: config.color }]}>{config.label}</Text>
      </View>
      <Text style={styles.weatherMeta}>
        {weather.description}, {weather.temperature.toFixed(0)}°C
      </Text>
      <Text style={styles.weatherQuiet}>
        Wind {weather.windSpeed.toFixed(0)} m/s, humidity {weather.humidity}%
      </Text>
      <Text style={styles.weatherContext}>{contextLine}</Text>
      {advice ? (
        <Text style={styles.weatherAdvice} numberOfLines={4}>
          {advice}
        </Text>
      ) : null}
    </Panel>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factLabelRow}>
        <Ionicons name={icon} size={11} color={D.faint} />
        <Text style={styles.factLabel}>{label}</Text>
      </View>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function TextPanel({
  icon,
  title,
  text,
  accent,
  flex = 1,
}: {
  icon: IconName;
  title: string;
  text: string;
  accent?: boolean;
  flex?: number;
}) {
  return (
    <Panel style={[styles.textPanel, { flex }, accent && { borderColor: D.goldLine }]}>
      <View style={styles.textPanelHead}>
        <Ionicons name={icon} size={12} color={accent ? D.gold : D.muted} />
        <Text style={[styles.textPanelTitle, accent && { color: D.gold }]}>{title}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <Text style={styles.bodyText}>{text}</Text>
      </ScrollView>
    </Panel>
  );
}

// ── Attendee card (one per hiker) ─────────────────────────
const AVATAR_SIZE = 34;

function AttendeeCard({
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
      style={({ pressed }) => [styles.attendeeCard, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.attendeeCardAvatar, { backgroundColor: color }]}>
        {attendee.avatarUrl ? (
          <Image source={{ uri: attendee.avatarUrl }} style={styles.attendeeCardAvatarImage} />
        ) : (
          <Text style={styles.attendeeCardInitials}>{getInitials(name)}</Text>
        )}
      </View>

      <View style={styles.attendeeCardBody}>
        <Text style={styles.attendeeCardName} numberOfLines={1}>
          {name}
        </Text>
        {attendee.username ? (
          <Text style={styles.attendeeCardUsername} numberOfLines={1}>
            @{attendee.username}
          </Text>
        ) : (
          <Text style={styles.attendeeCardUsername} numberOfLines={1}>
            {isWaitlist ? 'On the waitlist' : 'Going'}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.attendeeCardPill,
          isWaitlist ? styles.attendeeCardPillWaitlist : styles.attendeeCardPillGoing,
        ]}
      >
        <Text
          style={[
            styles.attendeeCardPillText,
            { color: isWaitlist ? D.gold : D.green },
          ]}
        >
          {isWaitlist ? 'WAITLIST' : 'GOING'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HikerEventDetail() {
  useRequireAuth();
  const router = useRouter();
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
  const pct =
    hasCapacity && (event.capacity as number) > 0
      ? (counts.confirmed / (event.capacity as number)) * 100
      : 0;

  const hasSecondary = !!(event.safety_notes || event.required_gear);
  const hasAnyText = !!(event.description || hasSecondary);

  return (
    <Shell>
      {/* ── Sidebar: organizer, tags, RSVP ── */}
      <Sidebar
        footer={
          hasActiveRsvp ? (
            <>
              <View style={styles.rsvpState}>
                <Ionicons
                  name={isWaitlisted ? 'hourglass-outline' : 'checkmark-circle'}
                  size={14}
                  color={isWaitlisted ? D.gold : D.green}
                />
                <Text style={styles.rsvpStateText}>
                  {isWaitlisted ? "You're on the waitlist" : "You're going. See you on the trail."}
                </Text>
              </View>
              <ActionButton
                icon="close-circle-outline"
                label="Cancel RSVP"
                variant="danger"
                loading={working}
                disabled={working}
                onPress={handleCancel}
              />
            </>
          ) : (
            <ActionButton
              icon={isFull ? 'hourglass-outline' : 'checkmark-circle-outline'}
              label={isFull ? 'Join waitlist' : 'RSVP to this hike'}
              loading={working}
              disabled={working}
              onPress={handleRsvp}
            />
          )
        }
      >
        <SidebarHeader
          onBack={() => router.back()}
          backLabel="Events"
          title="Event details"
        />

        <Panel style={styles.orgCard}>
          <View style={styles.orgAvatar}>
            <Ionicons name="business-outline" size={14} color={D.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName} numberOfLines={2}>
              {event.organizations?.name ?? 'Organizer'}
            </Text>
            <View style={styles.orgMeta}>
              {verified ? (
                <>
                  <Ionicons name="shield-checkmark" size={10} color={D.green} />
                  <Text style={styles.orgVerified}>Verified</Text>
                </>
              ) : (
                <Text style={styles.orgUnverified}>Unverified</Text>
              )}
            </View>
          </View>
        </Panel>

        <SectionLabel>DETAILS</SectionLabel>
        <View style={{ gap: 6 }}>
          <Badge label={event.difficulty} />
          {event.is_public ? <MetaRow icon="eye-outline" text="Open to the public" /> : null}
          {event.allow_walkins ? <MetaRow icon="walk-outline" text="Walk-ins welcome" /> : null}
        </View>
      </Sidebar>

      {/* ── Centre: title, facts, text panels ── */}
      <Center>
        <View style={styles.centerInner}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <Panel style={styles.facts}>
            <Fact
              icon="calendar-outline"
              label="Date"
              value={multiDay ? `${formatDate(event.event_date)} – ${formatDate(event.end_date as string)}` : formatDate(event.event_date)}
            />
            <Fact
              icon="time-outline"
              label="Time"
              value={event.end_time
                ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
                : `${formatTime(event.start_time)}${event.duration_hours ? ` · ~${event.duration_hours}h` : ''}`}
            />
            <Fact icon="trail-sign-outline" label="Mountain" value={mountain?.name ?? '—'} />
            <Fact icon="location-outline" label="Meeting point" value={event.meeting_point} />
          </Panel>

          {hasAnyText ? (
            <View style={styles.textRow}>
              {event.description ? (
                <TextPanel icon="reader-outline" title="About this hike" text={event.description} flex={1.4} />
              ) : null}
              {hasSecondary ? (
                <View style={styles.textStack}>
                  {event.safety_notes ? (
                    <TextPanel icon="shield-outline" title="Safety notes" text={event.safety_notes} accent />
                  ) : null}
                  {event.required_gear ? (
                    <TextPanel icon="bag-handle-outline" title="Required gear" text={event.required_gear} />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyText}>
              <Text style={styles.weatherQuiet}>The organizer hasn't added more details yet.</Text>
            </View>
          )}
        </View>
      </Center>

      {/* ── Right pane: weather + attendance + attendee cards ── */}
      <RightPane>
        <WeatherCard state={weatherState} />

        <Panel style={{ gap: 6 }}>
          <View style={styles.attendRow}>
            <Text style={styles.attendLabel}>ATTENDING</Text>
            <Text style={styles.attendValue}>
              {counts.confirmed}
              {hasCapacity ? <Text style={styles.attendSub}>{` / ${event.capacity}`}</Text> : null}
            </Text>
          </View>
          {hasCapacity && (event.capacity as number) > 0 ? (
            <Meter value={pct} color={isFull ? D.orange : D.green} />
          ) : null}
          {counts.waitlist > 0 ? (
            <Text style={styles.waitlist}>{counts.waitlist} on the waitlist</Text>
          ) : null}
        </Panel>

        {attendees.length > 0 && (
          <Panel style={{ gap: 8, flex: 1, minHeight: 0 }}>
            <View style={styles.attendeeHeader}>
              <Text style={styles.attendLabel}>HIKERS GOING</Text>
              <Text style={styles.attendeeCount}>{goingCount}</Text>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.attendeeListContent}
              style={{ flex: 1 }}
            >
              {attendees.map((a) => (
                <AttendeeCard
                  key={a.rsvpId}
                  attendee={a}
                  onPress={setProfileUserId}
                />
              ))}
            </ScrollView>
          </Panel>
        )}
      </RightPane>

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
    </Shell>
  );
}

const styles = StyleSheet.create({
  // Sidebar
  orgCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  orgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.goldSoft,
    borderWidth: 1,
    borderColor: D.goldLine,
  },
  orgName: { color: D.text, fontSize: 11.5, fontWeight: '700' },
  orgMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  orgVerified: { color: D.green, fontSize: 9.5, fontWeight: '600' },
  orgUnverified: { color: D.faint, fontSize: 9.5 },
  rsvpState: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rsvpStateText: { color: D.text, fontSize: 10.5, flex: 1, lineHeight: 14 },

  // Centre
  centerInner: { flex: 1, padding: 10, gap: 8 },
  title: { color: D.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2, lineHeight: 20 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4, paddingHorizontal: 6 },
  fact: { width: '50%', paddingVertical: 5, paddingHorizontal: 4 },
  factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factLabel: { color: D.faint, fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
  factValue: { color: D.text, fontSize: 11, marginTop: 2, lineHeight: 14 },

  textRow: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 0 },
  textStack: { flex: 1, gap: 8, minHeight: 0 },
  textPanel: { minHeight: 0, padding: 10 },
  textPanelHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  textPanelTitle: { color: D.muted, fontSize: 10.5, fontWeight: '700' },
  bodyText: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 16 },
  emptyText: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Right pane
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weatherLabel: { fontSize: 10.5, fontWeight: '800' },
  weatherMeta: { color: D.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  weatherContext: { color: D.faint, fontSize: 9, marginTop: 1 },
  weatherAdvice: { color: 'rgba(255,255,255,0.7)', fontSize: 10, lineHeight: 14, marginTop: 3 },
  weatherQuietTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '700' },
  weatherQuiet: { color: D.muted, fontSize: 10, lineHeight: 14 },

  attendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attendLabel: { color: D.faint, fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  attendValue: { color: D.text, fontSize: 16, fontWeight: '800' },
  attendSub: { color: D.muted, fontSize: 11, fontWeight: '600' },
  waitlist: { color: D.gold, fontSize: 10, fontWeight: '600' },

  // Attendees — vertical list of cards
  attendeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeeCount: { color: D.text, fontSize: 12, fontWeight: '700' },
  attendeeListContent: {
    gap: 6,
    paddingBottom: 4,
  },
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    borderLeftColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  attendeeCardAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendeeCardAvatarImage: { width: '100%', height: '100%' },
  attendeeCardInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  attendeeCardBody: { flex: 1, minWidth: 0 },
  attendeeCardName: { color: D.text, fontSize: 11.5, fontWeight: '700' },
  attendeeCardUsername: { color: D.muted, fontSize: 9.5, marginTop: 1 },
  attendeeCardPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  attendeeCardPillGoing: {
    backgroundColor: 'rgba(63,214,157,0.10)',
    borderColor: 'rgba(63,214,157,0.30)',
  },
  attendeeCardPillWaitlist: {
    backgroundColor: 'rgba(201,169,110,0.10)',
    borderColor: 'rgba(201,169,110,0.30)',
  },
  attendeeCardPillText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4 },
});