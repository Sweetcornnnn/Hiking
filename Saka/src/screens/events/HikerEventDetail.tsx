import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  eventService,
  eventPlannedFinish,
  type PublicEvent,
  type EventRsvpCounts,
  type MyRsvpWithSafetyCheck,
} from '../../services/eventService';
import { hikeSafetyService } from '../../services/hikeSafetyService';
import { cancelCheck, scheduleCheck } from '../../services/hikeSafetyNotifications';
import { supabase } from '../../lib/supabase';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import { mountainService, type Mountain } from '../../services/mountainService';
import {
  getCurrentWeather,
  getForecastForEvent,
  getWeatherSafetyAdvice,
  type WeatherCondition,
} from '../../services/weatherService';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  Banner,
  Card,
  Pill,
  InfoRow,
  Block,
  Grid,
  PC,
  SP,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

const formatDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
};

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const daysUntil = (isoDate: string): number => {
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(isoDate + 'T00:00:00');
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
  | { mode: 'forecast-soon' }        // event is >5 days away
  | { mode: 'current'; weather: WeatherCondition }   // event is today
  | { mode: 'forecast'; weather: WeatherCondition; approximate: boolean };

function WeatherBanner({ state }: { state: WeatherState }) {
  if (state.mode === 'hidden') return null;

  if (state.mode === 'loading') {
    return (
      <View style={[styles.weatherBanner, styles.weatherBannerNeutral]}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.45)" />
        <Text style={styles.weatherLoadingText}>Checking mountain weather…</Text>
      </View>
    );
  }

  if (state.mode === 'forecast-soon') {
    return (
      <View style={[styles.weatherBanner, styles.weatherBannerNeutral]}>
        <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
        <View style={{ flex: 1 }}>
          <Text style={styles.weatherNeutralLabel}>Forecast not available yet</Text>
          <Text style={styles.weatherNeutralText}>
            Reliable forecasts open 5 days before the hike. Check back closer to the date.
          </Text>
        </View>
      </View>
    );
  }

  const weather = state.weather;
  const severity = getWeatherSeverity(weather);
  const config =
    severity === 'danger'
      ? {
          icon: 'alert-circle' as const,
          color: '#E07070',
          bg: 'rgba(224,112,112,0.08)',
          border: 'rgba(224,112,112,0.32)',
          label: 'Weather warning',
        }
      : severity === 'caution'
      ? {
          icon: 'warning' as const,
          color: '#C9A96E',
          bg: 'rgba(201,169,110,0.08)',
          border: 'rgba(201,169,110,0.32)',
          label: 'Weather advisory',
        }
      : {
          icon: 'checkmark-circle' as const,
          color: '#3FD69D',
          bg: 'rgba(63,214,157,0.06)',
          border: 'rgba(63,214,157,0.26)',
          label: 'Weather looks good',
        };

  const advice = getWeatherSafetyAdvice(weather);

  const contextLine =
    state.mode === 'current'
      ? 'Current mountain conditions'
      : state.approximate
      ? 'Nearest available forecast'
      : 'Forecast for hike start';

  return (
    <View
      style={[
        styles.weatherBanner,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Ionicons name={config.icon} size={18} color={config.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.weatherLabel, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.weatherContext}>{contextLine}</Text>
        <Text style={styles.weatherMeta}>
          {weather.description} · {weather.temperature.toFixed(0)}°C · Wind{' '}
          {weather.windSpeed.toFixed(0)} m/s · Humidity {weather.humidity}%
        </Text>
        {advice ? (
          <Text style={styles.weatherAdvice} numberOfLines={3}>
            {advice}
          </Text>
        ) : null}
      </View>
    </View>
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
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weatherState, setWeatherState] = useState<WeatherState>({ mode: 'hidden' });

  const fetchAll = useCallback(async () => {
    if (!eventId) {
      setError('Missing event id');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [evt, rsvp] = await Promise.all([
        eventService.getEventById(eventId),
        eventService.getMyRsvpForEventWithCheck(eventId),
      ]);
      if (!evt) {
        setError('Event not found');
        return;
      }
      setEvent(evt);
      setMyRsvp(rsvp);

      const cached = mountainService.getCachedMountainById(evt.mountain_id);
      if (cached) {
        setMountain(cached);
      } else {
        mountainService.fetchMountainById(evt.mountain_id).then(setMountain);
      }

      const c = await eventService.getRsvpCounts([evt.id]);
      setCounts(c[evt.id] ?? { confirmed: 0, waitlist: 0, total: 0 });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load event');
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

    // Past event — nothing meaningful to show.
    if (days < 0) {
      setWeatherState({ mode: 'hidden' });
      return;
    }

    // >5 days out — OWM's free forecast window is ~5 days.
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
          // Mark as approximate if the target hour fell between 3-hour slots.
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

  const handleRsvp = async () => {
    if (!event) return;

    setWorking(true);
    try {
      const { status, error: e } = await eventService.rsvpToEvent(event.id, 1);

      if (e) {
        Alert.alert('RSVP failed', e);
        return;
      }

      if (status === 'waitlist') {
        Alert.alert(
          "You're on the waitlist",
          "We'll notify you if a slot opens up."
        );
      }

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
      Alert.alert('RSVP failed', err?.message ?? String(err));
    } finally {
      setWorking(false);
    }
  };

  const handleCancel = () => {
    if (!myRsvp) return;
    Alert.alert('Cancel RSVP?', 'You will lose your slot.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel RSVP',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            const { error: e } = await eventService.cancelMyRsvp(myRsvp.id);
            if (e) {
              Alert.alert('Cancel failed', e);
              return;
            }

            if (myRsvp.safety_check_id) await cancelCheck(myRsvp.safety_check_id);
            await hikeSafetyService.deleteEventCheck(myRsvp.id);
            await fetchAll();
          } catch (err: any) {
            Alert.alert('Cancel failed', err?.message ?? String(err));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  if (loading) return <CenteredState loading message="Loading event…" />;
  if (error || !event) {
    return (
      <CenteredState
        message={error ?? 'Event not found'}
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  const hasCapacity = event.capacity !== null && event.capacity !== undefined;
  const isWaitlisted = myRsvp?.status === 'waitlist';

  return (
    <OrgLandscapeShell
      onBack={() => router.back()}
      backLabel="Events"
      title={event.title}
      titleLines={3}
      badge={
        <View style={styles.pillRow}>
          <Pill
            label={event.difficulty}
            bg="rgba(201,169,110,0.12)"
            color={PC.gold}
            border="rgba(201,169,110,0.3)"
            uppercase={false}
          />
          {event.is_public ? (
            <Pill
              label="Public"
              icon="eye-outline"
              bg="rgba(255,255,255,0.05)"
              color="rgba(255,255,255,0.7)"
              border="rgba(255,255,255,0.1)"
              uppercase={false}
            />
          ) : null}
          {event.allow_walkins ? (
            <Pill
              label="Walk-ins"
              icon="walk-outline"
              bg="rgba(255,255,255,0.05)"
              color="rgba(255,255,255,0.7)"
              border="rgba(255,255,255,0.1)"
              uppercase={false}
            />
          ) : null}
        </View>
      }
      rail={
        <>
          {/* Organizer */}
          <Card style={styles.orgHeader}>
            <View style={styles.orgAvatar}>
              <Ionicons name="business-outline" size={16} color={PC.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orgName} numberOfLines={1}>
                {event.organizations?.name ?? 'Organizer'}
              </Text>
              <View style={styles.orgMeta}>
                {event.organizations?.is_verified ? (
                  <>
                    <Ionicons name="shield-checkmark" size={11} color={PC.green} />
                    <Text style={styles.orgVerified}>Verified organizer</Text>
                  </>
                ) : (
                  <Text style={styles.orgUnverified}>Unverified organizer</Text>
                )}
              </View>
            </View>
          </Card>

          {/* Capacity meter */}
          <Card style={styles.capacityCard}>
            <View style={styles.capacityHeader}>
              <Text style={styles.capacityLabel}>Attending</Text>
              <Text style={styles.capacityValue}>
                {counts.confirmed}
                {hasCapacity ? (
                  <Text style={styles.capacityValueSub}>{` / ${event.capacity}`}</Text>
                ) : null}
              </Text>
            </View>
            {hasCapacity && (event.capacity as number) > 0 && (
              <View style={styles.capacityTrack}>
                <View
                  style={[
                    styles.capacityFill,
                    {
                      width: `${Math.min(100, (counts.confirmed / (event.capacity as number)) * 100)}%`,
                      backgroundColor: isFull ? PC.orange : PC.green,
                    },
                  ]}
                />
              </View>
            )}
            {counts.waitlist > 0 && (
              <Text style={styles.waitlistText}>{counts.waitlist} on the waitlist</Text>
            )}
          </Card>
        </>
      }
      railFooter={
        hasActiveRsvp ? (
          <>
            <Banner tone={isWaitlisted ? 'info' : 'success'} icon={isWaitlisted ? 'hourglass-outline' : 'checkmark-circle'}>
              {isWaitlisted ? "You're on the waitlist" : "You're going — see you on the trail"}
            </Banner>
            <RailButton
              icon="close-circle-outline"
              label="Cancel RSVP"
              variant="danger"
              loading={working}
              disabled={working}
              onPress={handleCancel}
            />
          </>
        ) : (
          <RailButton
            icon={isFull ? 'hourglass-outline' : 'checkmark-circle-outline'}
            label={isFull ? 'Join waitlist' : 'RSVP to this hike'}
            variant="primary"
            loading={working}
            disabled={working}
            onPress={handleRsvp}
          />
        )
      }
    >
      {/* Weather banner — driven by event proximity */}
      <WeatherBanner state={weatherState} />

      {/* Info blocks, two per row */}
      <Grid>
        <InfoRow icon="trail-sign-outline" label="Mountain" value={mountain?.name ?? '—'} />
        <InfoRow icon="calendar-outline" label="Date" value={formatDate(event.event_date)} />
        <InfoRow
          icon="time-outline"
          label="Time"
          value={event.end_time
            ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
            : `${formatTime(event.start_time)}${event.duration_hours ? ` · ~${event.duration_hours}h` : ''}`}
        />
        <InfoRow icon="location-outline" label="Meeting point" value={event.meeting_point} />
      </Grid>

      {event.description ? (
        <Block label="ABOUT THIS HIKE">
          <Text style={styles.blockText}>{event.description}</Text>
        </Block>
      ) : null}

      {event.safety_notes ? (
        <Block label="SAFETY NOTES" accent="rgba(201,169,110,0.2)">
          <Text style={styles.blockText}>{event.safety_notes}</Text>
        </Block>
      ) : null}

      {event.required_gear ? (
        <Block label="REQUIRED GEAR">
          <Text style={styles.blockText}>{event.required_gear}</Text>
        </Block>
      ) : null}
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Rail: organizer
  orgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PC.goldSoft,
    borderWidth: 1,
    borderColor: PC.borderGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgName: { color: '#FFF', fontSize: FS.base, fontWeight: '700' },
  orgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  orgVerified: { color: PC.green, fontSize: FS.small, fontWeight: '600' },
  orgUnverified: { color: PC.textFaint, fontSize: FS.small },

  // Rail: capacity
  capacityCard: { gap: SP.sm },
  capacityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capacityLabel: { color: '#A9B7C4', fontSize: FS.micro, textTransform: 'uppercase', letterSpacing: 0.6 },
  capacityValue: { color: '#FFF', fontSize: FS.title, fontWeight: '800' },
  capacityValueSub: { color: 'rgba(255,255,255,0.45)', fontSize: FS.base, fontWeight: '600' },
  capacityTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 3 },
  waitlistText: { color: PC.gold, fontSize: FS.small, fontWeight: '600' },

  // Panel: weather
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: SP.md,
    borderRadius: PC.radius,
    borderWidth: 1,
  },
  weatherBannerNeutral: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  weatherLoadingText: { color: 'rgba(255,255,255,0.5)', fontSize: FS.body },
  weatherNeutralLabel: { color: 'rgba(255,255,255,0.7)', fontSize: FS.body, fontWeight: '700' },
  weatherNeutralText: { color: 'rgba(255,255,255,0.45)', fontSize: FS.small, lineHeight: 16, marginTop: 2 },
  weatherLabel: { fontSize: FS.small, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  weatherContext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FS.micro,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  weatherMeta: { color: 'rgba(255,255,255,0.7)', fontSize: FS.body, marginTop: 2 },
  weatherAdvice: { color: PC.textBody, fontSize: FS.body, lineHeight: 17, marginTop: 2 },

  blockText: { color: PC.textBody, fontSize: FS.base, lineHeight: 19 },
});