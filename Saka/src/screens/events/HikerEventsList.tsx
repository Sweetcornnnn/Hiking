import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { eventService, type PublicEvent, type EventRsvpCounts } from '../../services/eventService';
import { effectiveEnd } from '../../utils/dateRange';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import OfflineActionModal from '../../components/OfflineActionModal';
import { isConnectionError } from '../../services/offlineStatusService';
import {
  T,
  SERIF,
  Screen,
  TopBar,
  CenterMessage,
  SearchBox,
  FilterButton,
  RemovableTag,
  SheetShell,
  Button,
  Pill,
  difficultyColor,
  todayISO,
  plusDaysISO,
  toLocalISO,
  parseISO,
  formatTime,
} from '../../components/events/TrailKit';

const DIFFICULTIES = ['All', 'Easy', 'Moderate', 'Hard', 'Expert'] as const;
const DATE_RANGES = [
  { id: 'upcoming', label: 'Coming up' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'Any date' },
] as const;

type Difficulty = (typeof DIFFICULTIES)[number];
type DateRangeId = (typeof DATE_RANGES)[number]['id'];

const SPACER = { __spacer: true } as const;
type ListItem = PublicEvent | typeof SPACER;

/** Calendar-style date for the card: "Sat / 14 / Nov", or "Today / 14 / Nov". */
const dateBlock = (start: string, end?: string | null) => {
  const s = parseISO(start);
  const multi = !!end && end !== start;
  const rel =
    start === todayISO()
      ? 'Today'
      : start === toLocalISO(new Date(Date.now() + 86400_000))
      ? 'Tomorrow'
      : null;
  return {
    top: rel ?? s.toLocaleDateString('en-US', { weekday: 'short' }),
    big: multi ? `${s.getDate()}–${parseISO(end as string).getDate()}` : String(s.getDate()),
    month: s.toLocaleDateString('en-US', { month: 'short' }),
    hot: !!rel,
  };
};

// ── Filters sheet: three option lists side by side, no footer ───────
function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.opt}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <Text style={[styles.optText, active && styles.optTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterSheet({
  visible,
  onClose,
  dateRange,
  onDateRange,
  difficulty,
  onDifficulty,
  mountains,
  mountainId,
  onMountain,
  canReset,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  dateRange: DateRangeId;
  onDateRange: (r: DateRangeId) => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  mountains: Mountain[];
  mountainId: string | null;
  onMountain: (id: string | null) => void;
  canReset: boolean;
  onReset: () => void;
}) {
  const { width } = useWindowDimensions();
  const stacked = width < 520;

  return (
    <SheetShell
      visible={visible}
      title="Filters"
      onClose={onClose}
      headerRight={
        canReset ? (
          <TouchableOpacity onPress={onReset} hitSlop={10} accessibilityRole="button" accessibilityLabel="Reset filters">
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      <View style={[styles.fBody, !stacked && { flexDirection: 'row' }]}>
        <View style={styles.fCol}>
          <Text style={styles.fLabel}>When</Text>
          {DATE_RANGES.map((r) => (
            <Option key={r.id} label={r.label} active={dateRange === r.id} onPress={() => onDateRange(r.id)} />
          ))}
        </View>

        <View style={styles.fCol}>
          <Text style={styles.fLabel}>Difficulty</Text>
          {DIFFICULTIES.map((d) => (
            <Option
              key={d}
              label={d === 'All' ? 'Any level' : d}
              active={difficulty === d}
              onPress={() => onDifficulty(d)}
            />
          ))}
        </View>

        <View style={styles.fCol}>
          <Text style={styles.fLabel}>Mountain</Text>
          <ScrollView style={{ maxHeight: stacked ? 150 : 190 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <Option label="Any mountain" active={mountainId === null} onPress={() => onMountain(null)} />
            {mountains.map((m) => (
              <Option key={m.id} label={m.name} active={mountainId === m.id} onPress={() => onMountain(m.id)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </SheetShell>
  );
}

export default function HikerEventsList() {
  useRequireAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 560 ? 2 : 1;

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, EventRsvpCounts>>({});
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>('All');
  const [dateRange, setDateRange] = useState<DateRangeId>('upcoming');
  const [mountainId, setMountainId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      setOfflineModalVisible(false);
    } catch (e: any) {
      if (isConnectionError(e)) {
        setOfflineModalVisible(true);
      } else {
        setOfflineModalVisible(false);
        setError(e?.message ?? 'Failed to load events');
      }
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

    if (dateRange === 'week' || dateRange === 'month') {
      const cutoff = plusDaysISO(dateRange === 'week' ? 7 : 30);
      const today = todayISO();
      result = result.filter(
        (e) => e.event_date <= cutoff && effectiveEnd(e.event_date, e.end_date) >= today
      );
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.organizations?.name ?? '').toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) =>
      `${a.event_date} ${a.start_time}`.localeCompare(`${b.event_date} ${b.start_time}`)
    );
  }, [events, dateRange, searchText]);

  const mountainNameFor = (id: string) => mountains.find((m) => m.id === id)?.name ?? 'Mountain';

  // Filters that live in the sheet (search has its own box).
  const activeCount =
    (dateRange !== 'upcoming' ? 1 : 0) + (difficulty !== 'All' ? 1 : 0) + (mountainId !== null ? 1 : 0);
  const hasFilters = activeCount > 0 || searchText.trim().length > 0;

  const resetSheetFilters = () => {
    setDifficulty('All');
    setDateRange('upcoming');
    setMountainId(null);
  };
  const clearFilters = () => {
    resetSheetFilters();
    setSearchText('');
  };

  const openEvent = (id: string) =>
    router.push({ pathname: '/events/EventDetail', params: { eventId: id } } as any);

  const statusFor = (event: PublicEvent) => {
    const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
    const hasCap = event.capacity !== null && event.capacity !== undefined;
    const left = hasCap ? (event.capacity as number) - c.confirmed : null;
    if (hasCap && (left as number) <= 0) return { color: T.orange, text: 'Full' };
    if (left !== null) {
      if (left <= 3) return { color: T.gold, text: `Only ${left} left` };
      return { color: T.green, text: `${left} spots left` };
    }
    return { color: T.green, text: c.confirmed > 0 ? `${c.confirmed} going` : 'Open' };
  };

  // Full-screen loader only for the very first load; filter changes load inside the list.
  if (!hasLoaded && loading) return <CenterMessage loading message="Loading events…" />;

  const renderItem = ({ item }: { item: ListItem }) => {
    if ('__spacer' in item) return <View style={{ flex: 1 }} />;
    const event = item;
    const db = dateBlock(event.event_date, event.end_date);
    const st = statusFor(event);
    const verified = !!event.organizations?.is_verified;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openEvent(event.id)}
        style={[styles.card, cols > 1 && { flex: 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${db.top} ${db.month} ${db.big}, ${event.difficulty}, ${st.text}`}
      >
        <View style={[styles.dateBlock, db.hot && styles.dateBlockHot]}>
          <Text style={[styles.dateTop, db.hot && { color: T.gold }]} numberOfLines={1}>
            {db.top}
          </Text>
          <Text style={styles.dateBig} numberOfLines={1}>
            {db.big}
          </Text>
          <Text style={styles.dateMonth}>{db.month}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {mountainNameFor(event.mountain_id)}, {formatTime(event.start_time)}
          </Text>
          <View style={styles.byline}>
            {verified ? <Ionicons name="shield-checkmark" size={12} color={T.green} /> : null}
            <Text style={styles.org} numberOfLines={1}>
              {event.organizations?.name ?? 'Organizer'}
            </Text>
          </View>
          <View style={styles.cardBottom}>
            <Pill label={event.difficulty} color={difficultyColor(event.difficulty)} />
            <Text style={[styles.status, { color: st.color }]} numberOfLines={1}>
              {st.text}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Applied filters, shown only when there are any. Tap to remove.
  const appliedBar =
    activeCount > 0 ? (
      <View style={styles.applied}>
        {dateRange !== 'upcoming' ? (
          <RemovableTag
            label={DATE_RANGES.find((r) => r.id === dateRange)?.label ?? ''}
            onRemove={() => setDateRange('upcoming')}
          />
        ) : null}
        {difficulty !== 'All' ? <RemovableTag label={difficulty} onRemove={() => setDifficulty('All')} /> : null}
        {selectedMountain ? (
          <RemovableTag label={selectedMountain.name} onRemove={() => setMountainId(null)} />
        ) : null}
      </View>
    ) : null;

  const empty = loading ? (
    <View style={styles.state}>
      <ActivityIndicator color={T.gold} />
    </View>
  ) : error ? (
    <View style={styles.state}>
      <Ionicons name="cloud-offline-outline" size={26} color={T.red} />
      <Text style={styles.stateTitle}>Couldn't load events</Text>
      <Text style={styles.stateText}>{error}</Text>
      <View style={{ width: 160 }}>
        <Button label="Try again" variant="quiet" onPress={onRefresh} />
      </View>
    </View>
  ) : (
    <View style={styles.state}>
      <Ionicons name="calendar-clear-outline" size={26} color={T.faint} />
      <Text style={styles.stateTitle}>No events match</Text>
      <Text style={styles.stateText}>Try a wider date range or a different mountain.</Text>
      {hasFilters ? (
        <View style={{ width: 160 }}>
          <Button label="Clear filters" variant="quiet" onPress={clearFilters} />
        </View>
      ) : null}
    </View>
  );

  const data: ListItem[] = loading
    ? []
    : cols > 1 && filtered.length % cols !== 0
    ? [...filtered, ...Array.from({ length: cols - (filtered.length % cols) }, () => SPACER)]
    : filtered;

  return (
    <>
      <Screen>
        <TopBar
          onBack={() => router.back()}
          a11yLabel="Back to Home"
          backIcon="home-outline"
          title="Events"
          subtitle={loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`}
          right={
            <>
              <View style={{ flex: 1, maxWidth: 260 }}>
                <SearchBox value={searchText} onChangeText={setSearchText} placeholder="Search events" />
              </View>
              <FilterButton count={activeCount} onPress={() => setFiltersOpen(true)} />
            </>
          }
        />

        <FlatList
          key={`cols-${cols}`}
          data={data}
          numColumns={cols}
          keyExtractor={(e, i) => ('__spacer' in e ? `spacer-${i}` : e.id)}
          renderItem={renderItem}
          ListHeaderComponent={appliedBar}
          ListEmptyComponent={empty}
          columnWrapperStyle={cols > 1 ? { gap: 8 } : undefined}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          extraData={[counts, mountains, cols]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
        />
      </Screen>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        dateRange={dateRange}
        onDateRange={setDateRange}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        mountains={mountains}
        mountainId={mountainId}
        onMountain={setMountainId}
        canReset={activeCount > 0}
        onReset={resetSheetFilters}
      />
      <OfflineActionModal
        visible={offlineModalVisible}
        message="Events need an internet connection to load. Connect and try again."
        retrying={refreshing || loading}
        onRetry={() => {
          setOfflineModalVisible(false);
          onRefresh();
        }}
        onDismiss={() => {
          setOfflineModalVisible(false);
          setError('Connect to the internet to load events.');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingBottom: 20, flexGrow: 1 },
  applied: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 },

  // Card: one compact row, date on the left
  card: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateBlock: {
    width: 54,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateBlockHot: { backgroundColor: T.goldSoft, borderColor: T.goldLine },
  dateTop: { color: T.muted, fontSize: 12, fontWeight: '600' },
  dateBig: { color: T.text, fontFamily: SERIF, fontSize: 20, lineHeight: 24 },
  dateMonth: { color: T.muted, fontSize: 12 },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { color: T.text, fontFamily: SERIF, fontSize: 15, lineHeight: 19 },
  line: { color: T.body, fontSize: 13 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  org: { color: T.muted, fontSize: 12, flexShrink: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  status: { fontSize: 13, fontWeight: '700' },

  // Filters sheet
  fBody: { padding: 16, gap: 14 },
  fCol: { flex: 1, gap: 2 },
  fLabel: { color: T.muted, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: T.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: T.gold },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.gold },
  optText: { color: T.body, fontSize: 14, flexShrink: 1 },
  optTextOn: { color: T.gold, fontWeight: '700' },
  resetText: { color: T.gold, fontSize: 14, fontWeight: '600' },

  // States
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
  stateTitle: { color: T.text, fontFamily: SERIF, fontSize: 17, textAlign: 'center' },
  stateText: { color: T.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});