import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  eventService,
  type PublicEvent,
  type EventRsvpCounts,
  type MyRsvp,
} from '../../services/eventService';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import { mountainService, type Mountain } from '../../services/mountainService';
import {
  getCurrentWeather,
  getForecastForEvent,
  getWeatherSafetyAdvice,
  type WeatherCondition,
} from '../../services/weatherService';

const formatDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
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
        <Text style={styles.weatherBannerLoadingText}>Checking mountain weather…</Text>
      </View>
    );
  }

  if (state.mode === 'forecast-soon') {
    return (
      <View style={[styles.weatherBanner, styles.weatherBannerNeutral]}>
        <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
        <View style={{ flex: 1 }}>
          <Text style={styles.weatherBannerNeutralLabel}>Forecast not available yet</Text>
          <Text style={styles.weatherBannerNeutralText}>
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
      <View style={{ flex: 1 }}>
        <Text style={[styles.weatherBannerLabel, { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.weatherBannerContext}>{contextLine}</Text>
        <Text style={styles.weatherBannerMeta}>
          {weather.description} · {weather.temperature.toFixed(0)}°C · Wind{' '}
          {weather.windSpeed.toFixed(0)} m/s · Humidity {weather.humidity}%
        </Text>
        {advice ? (
          <Text style={styles.weatherBannerAdvice} numberOfLines={3}>
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
  const [myRsvp, setMyRsvp] = useState<MyRsvp | null>(null);
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
        eventService.getMyRsvpForEvent(eventId),
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
          const { error: e } = await eventService.cancelMyRsvp(myRsvp.id);
          setWorking(false);
          if (e) {
            Alert.alert('Cancel failed', e);
            return;
          }
          await fetchAll();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading event…</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color="#E07070" />
        <Text style={styles.centeredText}>{error ?? 'Event not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Events</Text>
      </TouchableOpacity>

      {/* Org header */}
      <View style={styles.orgHeader}>
        <View style={styles.orgAvatar}>
          <Ionicons name="business-outline" size={18} color="#C9A96E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.orgName} numberOfLines={1}>
            {event.organizations?.name ?? 'Organizer'}
          </Text>
          <View style={styles.orgMeta}>
            {event.organizations?.is_verified ? (
              <>
                <Ionicons name="shield-checkmark" size={11} color="#3FD69D" />
                <Text style={styles.orgVerified}>Verified organizer</Text>
              </>
            ) : (
              <Text style={styles.orgUnverified}>Unverified organizer</Text>
            )}
          </View>
        </View>
      </View>

      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.pillRow}>
        <View style={styles.diffPill}>
          <Text style={styles.diffPillText}>{event.difficulty}</Text>
        </View>
        {event.is_public ? (
          <View style={styles.softPill}>
            <Ionicons name="eye-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.softPillText}>Public</Text>
          </View>
        ) : null}
        {event.allow_walkins ? (
          <View style={styles.softPill}>
            <Ionicons name="walk-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.softPillText}>Walk-ins</Text>
          </View>
        ) : null}
      </View>

      {/* Weather banner — driven by event proximity */}
      <WeatherBanner state={weatherState} />

      {/* Capacity meter */}
      <View style={styles.capacityCard}>
        <View style={styles.capacityHeader}>
          <Text style={styles.capacityLabel}>Attending</Text>
          <Text style={styles.capacityValue}>
            {counts.confirmed}
            {event.capacity !== null && event.capacity !== undefined ? ` / ${event.capacity}` : ''}
          </Text>
        </View>
        {event.capacity !== null && event.capacity !== undefined && event.capacity > 0 && (
          <View style={styles.capacityTrack}>
            <View
              style={[
                styles.capacityFill,
                {
                  width: `${Math.min(100, (counts.confirmed / event.capacity) * 100)}%`,
                  backgroundColor: isFull ? '#E67E22' : '#3FD69D',
                },
              ]}
            />
          </View>
        )}
        {counts.waitlist > 0 && (
          <Text style={styles.waitlistText}>{counts.waitlist} on the waitlist</Text>
        )}
      </View>

      {/* Info */}
      <InfoRow icon="trail-sign-outline" label="Mountain" value={mountain?.name ?? '—'} />
      <InfoRow icon="calendar-outline" label="Date" value={formatDate(event.event_date)} />
      <InfoRow
        icon="time-outline"
        label="Start time"
        value={`${formatTime(event.start_time)}${event.duration_hours ? ` · ~${event.duration_hours}h` : ''}`}
      />
      <InfoRow icon="location-outline" label="Meeting point" value={event.meeting_point} />

      {event.description ? (
        <Block label="ABOUT THIS HIKE">
          <Text style={styles.blockText}>{event.description}</Text>
        </Block>
      ) : null}

      {event.safety_notes ? (
        <Block label="SAFETY NOTES" accent="rgba(201,169,110,0.15)">
          <Text style={styles.blockText}>{event.safety_notes}</Text>
        </Block>
      ) : null}

      {event.required_gear ? (
        <Block label="REQUIRED GEAR" accent="rgba(255,255,255,0.04)">
          <Text style={styles.blockText}>{event.required_gear}</Text>
        </Block>
      ) : null}

      {/* Action */}
      <View style={styles.actionSection}>
        {hasActiveRsvp ? (
          <>
            <View
              style={[
                styles.statusBanner,
                myRsvp!.status === 'waitlist'
                  ? styles.statusBannerWaitlist
                  : styles.statusBannerConfirmed,
              ]}
            >
              <Ionicons
                name={myRsvp!.status === 'waitlist' ? 'hourglass-outline' : 'checkmark-circle'}
                size={16}
                color={myRsvp!.status === 'waitlist' ? '#C9A96E' : '#3FD69D'}
              />
              <Text
                style={[
                  styles.statusBannerText,
                  myRsvp!.status === 'waitlist' ? { color: '#C9A96E' } : { color: '#3FD69D' },
                ]}
              >
                {myRsvp!.status === 'waitlist'
                  ? "You're on the waitlist"
                  : "You're going — see you on the trail"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.dangerOutlineBtn}
              onPress={handleCancel}
              disabled={working}
              activeOpacity={0.85}
            >
              {working ? (
                <ActivityIndicator color="#E07070" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color="#E07070" />
                  <Text style={styles.dangerOutlineText}>Cancel RSVP</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, working && styles.btnDisabled]}
            onPress={handleRsvp}
            disabled={working}
            activeOpacity={0.85}
          >
            {working ? (
              <ActivityIndicator color="#0E1520" />
            ) : (
              <>
                <Ionicons
                  name={isFull ? 'hourglass-outline' : 'checkmark-circle-outline'}
                  size={17}
                  color="#0E1520"
                />
                <Text style={styles.primaryBtnText}>
                  {isFull ? 'Join waitlist' : 'RSVP to this hike'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={14} color="#C9A96E" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Block({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <View style={[styles.block, accent ? { borderColor: accent } : null]}>
      <Text style={styles.blockLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 22, paddingTop: 26, paddingBottom: 80, gap: 12 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },

  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  orgAvatar: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.28)',
    justifyContent: 'center', alignItems: 'center',
  },
  orgName: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  orgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  orgVerified: { color: '#3FD69D', fontSize: 11, fontWeight: '600' },
  orgUnverified: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  title: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 6 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  diffPill: {
    backgroundColor: 'rgba(201,169,110,0.12)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.3)',
  },
  diffPillText: { color: '#C9A96E', fontSize: 11, fontWeight: '700' },
  softPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  softPillText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600' },

  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  weatherBannerNeutral: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  weatherBannerLoadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginLeft: 8,
  },
  weatherBannerNeutralLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '700',
  },
  weatherBannerNeutralText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  weatherBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  weatherBannerContext: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  weatherBannerMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 3,
  },
  weatherBannerAdvice: {
    color: '#DCE6EF',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  capacityCard: {
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 8,
  },
  capacityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capacityLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  capacityValue: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  capacityTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 3 },
  waitlistText: { color: '#C9A96E', fontSize: 11, fontWeight: '600', marginTop: 2 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 2 },

  block: {
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 6,
  },
  blockLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  blockText: { color: '#DCE6EF', fontSize: 13, lineHeight: 19 },

  actionSection: { gap: 10, marginTop: 10 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 16,
  },
  primaryBtnText: { color: '#0E1520', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBannerConfirmed: {
    backgroundColor: 'rgba(63,214,157,0.06)',
    borderColor: 'rgba(63,214,157,0.28)',
  },
  statusBannerWaitlist: {
    backgroundColor: 'rgba(201,169,110,0.06)',
    borderColor: 'rgba(201,169,110,0.28)',
  },
  statusBannerText: { fontSize: 13, fontWeight: '700', flex: 1 },

  dangerOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(224,112,112,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.3)',
  },
  dangerOutlineText: { color: '#E07070', fontWeight: '700', fontSize: 13 },
});