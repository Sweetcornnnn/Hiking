import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { eventService, type PublicEvent, type EventRsvpCounts } from '../../services/eventService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  Chip,
  OptionRow,
  SelectField,
  PickerModal,
  EmptyState,
  Card,
  Pill,
  MetaRow,
  Grid,
  PC,
  SP,
  FS,
  HIT,
} from '../../components/organizations/OrgLandscapeShell';

const DIFFICULTIES = ['All', 'Easy', 'Moderate', 'Hard', 'Expert'] as const;
const DATE_RANGES = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
] as const;

type DateRangeId = (typeof DATE_RANGES)[number]['id'];

// Local-date helpers (toISOString() is UTC and shifts the date for UTC+8 users).
const toLocalISO = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const todayISO = () => toLocalISO(new Date());
const plusDaysISO = (days: number) => toLocalISO(new Date(Date.now() + days * 86400_000));

const formatDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
};

export default function HikerEventsList() {
  useRequireAuth();
  const router = useRouter();

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, EventRsvpCounts>>({});
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('All');
  const [dateRange, setDateRange] = useState<DateRangeId>('upcoming');
  const [mountainId, setMountainId] = useState<string | null>(null);
  const [mountainPickerOpen, setMountainPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mountains, setMountains] = useState<Mountain[]>([]);

  const selectedMountain = useMemo(
    () => mountains.find((m) => m.id === mountainId) ?? null,
    [mountains, mountainId]
  );

  // Load mountains once
  useEffect(() => {
    const cached = mountainService.getCachedMountains();
    if (cached.length > 0) setMountains(cached);
    else mountainService.fetchMountains().then(setMountains);
  }, []);

  const fetchEvents = useCallback(async () => {
    setError(null);
    try {
      const from = dateRange === 'all' ? undefined : todayISO();

      const list = await eventService.getPublicEvents({
        mountainId: mountainId ?? undefined,
        difficulty: difficulty === 'All' ? undefined : difficulty,
        dateFrom: from,
      });

      setEvents(list);
      const c = await eventService.getRsvpCounts(list.map((e) => e.id));
      setCounts(c);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
      setHasLoaded(true);
      setRefreshing(false);
    }
  }, [mountainId, difficulty, dateRange]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    let result = events;

    if (dateRange === 'week') {
      const cutoff = plusDaysISO(7);
      result = result.filter((e) => e.event_date <= cutoff);
    } else if (dateRange === 'month') {
      const cutoff = plusDaysISO(30);
      result = result.filter((e) => e.event_date <= cutoff);
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.organizations?.name ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [events, dateRange, searchText]);

  const mountainNameFor = (id: string) =>
    mountains.find((m) => m.id === id)?.name ?? 'Mountain';

  const hasFilters =
    difficulty !== 'All' ||
    dateRange !== 'upcoming' ||
    mountainId !== null ||
    searchText.trim().length > 0;

  const clearFilters = () => {
    setDifficulty('All');
    setDateRange('upcoming');
    setMountainId(null);
    setSearchText('');
  };

  // Full-screen loader only for the very first load; filter changes load inside the panel.
  if (!hasLoaded && loading) return <CenteredState loading message="Finding hikes near you…" />;

  return (
    <>
      <OrgLandscapeShell
        onBack={() => router.back()}
        backLabel="Home"
        eyebrow="Discover hikes"
        title={loading ? 'Upcoming events' : `${filtered.length} event${filtered.length === 1 ? '' : 's'}`}
        rail={
          <View style={styles.railStack}>
            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={15} color="rgba(255,255,255,0.4)" />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search events or organizers"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  hitSlop={HIT}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Mountain filter */}
            <SelectField
              icon="trail-sign-outline"
              text={selectedMountain ? selectedMountain.name : 'All mountains'}
              selected={!!selectedMountain}
              onPress={() => setMountainPickerOpen(true)}
              onClear={() => setMountainId(null)}
            />

            {/* Difficulty chips (wrap instead of horizontal scroll) */}
            <Text style={styles.railLabel}>DIFFICULTY</Text>
            <View style={styles.chipWrap}>
              {DIFFICULTIES.map((d) => (
                <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(d)} />
              ))}
            </View>

            {/* Date range */}
            <Text style={styles.railLabel}>WHEN</Text>
            <View style={styles.optionList}>
              {DATE_RANGES.map((r) => (
                <OptionRow
                  key={r.id}
                  label={r.label}
                  active={dateRange === r.id}
                  onPress={() => setDateRange(r.id)}
                />
              ))}
            </View>
          </View>
        }
        railFooter={
          hasFilters ? (
            <RailButton
              icon="refresh-outline"
              label="Clear filters"
              variant="secondary"
              onPress={clearFilters}
            />
          ) : undefined
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PC.gold} />
        }
      >
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={PC.gold} />
            <Text style={styles.loadingText}>Updating results…</Text>
          </View>
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title={error}>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.85}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            title="No events match your filters"
            hint="Try widening the date range or clearing filters."
          />
        ) : (
          <Grid>
            {filtered.map((event) => {
              const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
              const isFull = event.capacity !== null && c.confirmed >= event.capacity;
              const verified = !!event.organizations?.is_verified;

              return (
                <Card
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() =>
                    router.push({
                      pathname: '/events/EventDetail',
                      params: { eventId: event.id },
                    } as any)
                  }
                >
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    {isFull ? (
                      <Pill label="Full" bg="rgba(230,126,34,0.2)" color={PC.orange} />
                    ) : (
                      <Pill label="Open" bg="rgba(29,143,106,0.2)" color={PC.green} />
                    )}
                  </View>

                  <MetaRow
                    icon={verified ? 'shield-checkmark' : 'business-outline'}
                    iconColor={verified ? PC.green : 'rgba(255,255,255,0.5)'}
                    text={event.organizations?.name ?? 'Organizer'}
                    textColor="rgba(255,255,255,0.8)"
                  />
                  <MetaRow icon="trail-sign-outline" text={mountainNameFor(event.mountain_id)} />
                  <MetaRow
                    icon="calendar-outline"
                    text={`${formatDate(event.event_date)} · ${formatTime(event.start_time)}`}
                  />

                  <View style={styles.footerRow}>
                    <MetaRow
                      icon="people-outline"
                      text={`${c.confirmed}${event.capacity ? ` / ${event.capacity}` : ''} attending`}
                    />
                    <Pill
                      label={event.difficulty}
                      bg="rgba(201,169,110,0.12)"
                      color={PC.gold}
                      border="rgba(201,169,110,0.25)"
                      uppercase={false}
                    />
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
      </OrgLandscapeShell>

      <PickerModal
        visible={mountainPickerOpen}
        title="Filter by mountain"
        items={mountains}
        selectedId={mountainId}
        emptyText="No mountains available."
        onSelect={setMountainId}
        onClose={() => setMountainPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Rail
  railStack: { gap: SP.sm },
  railLabel: {
    color: PC.textFaint,
    fontSize: FS.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: SP.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionList: { gap: 6 },

  searchRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SP.md,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: FS.base, paddingVertical: 0 },

  // Panel
  loadingCard: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: SP.xl,
    alignItems: 'center',
    gap: SP.sm,
  },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: FS.body },
  retryBtn: {
    marginTop: SP.sm,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: PC.gold,
    borderRadius: PC.radiusBtn,
  },
  retryText: { color: '#0E1520', fontWeight: '800', fontSize: FS.base },

  eventCard: { gap: 6 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  eventTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});