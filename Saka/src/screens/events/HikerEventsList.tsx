import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  SearchBox,
  FilterButton,
  SheetShell,
  Button,
  todayISO,
  plusDaysISO,
  toLocalISO,
  parseISO,
  formatTime,
} from '../../components/events/TrailKit';
import { EventStub } from '../../components/events/EventStub';
import { EventsBoardSkeleton } from '../../components/events/HikersSkeletons';

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
type Row =
  | { kind: 'header'; key: string; title: string; description: string; count: number }
  | { kind: 'row'; key: string; items: ListItem[] };

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

// ── Filters sheet ─────────────────────────────────────────────────
function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.opt, active && styles.optActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.optText, active && styles.optTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {active ? <Ionicons name="checkmark-circle" size={18} color={T.gold} /> : null}
    </TouchableOpacity>
  );
}

function OptionRows({
  items,
  selected,
  onSelect,
  columns,
}: {
  items: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  columns: number;
}) {
  const rows: (typeof items[number])[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return (
    <View style={styles.optionRows}>
      {rows.map((row) => (
        <View
          key={row.map((item) => item.id).join('-')}
          style={[styles.optionRow, row.length < columns && styles.optionRowCentered]}
        >
          {row.map((item) => (
            <Option
              key={item.id}
              label={item.label}
              active={selected === item.id}
              onPress={() => onSelect(item.id)}
            />
          ))}
          {row.length < columns && <View style={styles.optionSpacer} />}
        </View>
      ))}
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  dateRange,
  onDateRange,
  difficulty,
  onDifficulty,
  canReset,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  dateRange: DateRangeId;
  onDateRange: (r: DateRangeId) => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
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
      showCloseButton={false}
      headerRight={
        canReset ? (
          <TouchableOpacity onPress={onReset} hitSlop={10} accessibilityRole="button" accessibilityLabel="Reset filters">
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      <View style={[styles.fBody, !stacked && styles.fBodyWide]}>
        <View style={styles.filterGroup}>
          <Text style={styles.fLabel}>When</Text>
          <OptionRows
            items={DATE_RANGES}
            selected={dateRange}
            onSelect={(id) => onDateRange(id as DateRangeId)}
            columns={2}
          />
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.fLabel}>Difficulty</Text>
          <OptionRows
            items={DIFFICULTIES.map((difficulty) => ({
              id: difficulty,
              label: difficulty === 'All' ? 'Any' : difficulty,
            }))}
            selected={difficulty}
            onSelect={(value) => onDifficulty(value as Difficulty)}
            columns={3}
          />
        </View>
      </View>
    </SheetShell>
  );
}

export default function HikerEventsList() {
  useRequireAuth();
  const router = useRouter();
  const { mountainId: routeMountainId } = useLocalSearchParams<{ mountainId?: string }>();
  const { width } = useWindowDimensions();
  const mountainId = routeMountainId || null;
  const isSplitLayout = width >= 720;
  const cols = isSplitLayout ? (width >= 1250 ? 2 : 1) : width >= 560 ? 2 : 1;

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, EventRsvpCounts>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>('All');
  const [dateRange, setDateRange] = useState<DateRangeId>('upcoming');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [mountainDescriptionExpanded, setMountainDescriptionExpanded] = useState(false);
  const [mountainDescriptionLayout, setMountainDescriptionLayout] = useState<{
    text: string;
    preview: string;
    hasMore: boolean;
  } | null>(null);

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
  const activeMountain = mountainId
    ? mountains.find((mountain) => mountain.id === mountainId) ?? null
    : null;
  const mountainDescription = activeMountain?.description ||
    'Find a hike that matches your pace, discover new trails, and make a day of it.';
  const currentDescriptionLayout =
    mountainDescriptionLayout?.text === mountainDescription ? mountainDescriptionLayout : null;
  const mountainDescriptionHasMore = currentDescriptionLayout?.hasMore ?? mountainDescription.length > 180;
  const mountainDescriptionPreview =
    currentDescriptionLayout?.preview ?? mountainDescription.slice(0, 140).trimEnd();

  const measureMountainDescription = ({
    nativeEvent,
  }: {
    nativeEvent: { lines: Array<{ text: string; width: number }> };
  }) => {
    const { lines } = nativeEvent;
    const hasMore = lines.length > 5;
    if (!hasMore) {
      setMountainDescriptionLayout((current) =>
        current?.text === mountainDescription &&
        current.preview === mountainDescription &&
        !current.hasMore
          ? current
          : { text: mountainDescription, preview: mountainDescription, hasMore: false }
      );
      return;
    }

    const precedingLineLength = lines.slice(0, 4).reduce((length, line) => length + line.text.length, 0);
    const lastVisibleLine = lines[4];
    const averageCharacterWidth = lastVisibleLine.width / Math.max(lastVisibleLine.text.length, 1);
    const reservedCharacters = Math.ceil(180 / Math.max(averageCharacterWidth, 1));
    const lastLineLength = Math.max(lastVisibleLine.text.length - reservedCharacters, 0);
    const previewLength = precedingLineLength + lastLineLength;
    const preview = mountainDescription.slice(0, previewLength).trimEnd();

    setMountainDescriptionLayout((current) =>
      current?.text === mountainDescription &&
      current.preview === preview &&
      current.hasMore === hasMore
        ? current
        : { text: mountainDescription, preview, hasMore }
    );
  };

  useEffect(() => {
    setMountainDescriptionExpanded(false);
    setMountainDescriptionLayout(null);
  }, [mountainId, mountainDescription]);

  // Filters shown in the sheet; the mountain comes from the Home card.
  const activeCount =
    (dateRange !== 'upcoming' ? 1 : 0) + (difficulty !== 'All' ? 1 : 0);
  const hasFilters = activeCount > 0 || searchText.trim().length > 0;

  const resetSheetFilters = () => {
    setDifficulty('All');
    setDateRange('upcoming');
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
    if (hasCap && (left as number) <= 0) return { text: 'Full', strong: true };
    if (left !== null) {
      if (left <= 3) return { text: `Only ${left} left`, strong: true };
      return { text: `${left} spots left`, strong: false };
    }
    return { text: c.confirmed > 0 ? `${c.confirmed} going` : 'Open to all', strong: false };
  };

  const renderStub = (item: ListItem) => {
    if ('__spacer' in item) return null;
    const event = item;
    const db = dateBlock(event.event_date, event.end_date);
    const st = statusFor(event);
    const days =
      event.end_date && event.end_date !== event.event_date
        ? Math.round((parseISO(event.end_date).getTime() - parseISO(event.event_date).getTime()) / 86400000) + 1
        : 1;

    return (
      <EventStub
        eventId={event.id}
        title={event.title}
        where={`${mountainNameFor(event.mountain_id)}, ${formatTime(event.start_time)}${days > 1 ? `, ${days} days` : ''}`}
        dateText={`${db.top}, ${db.month} ${db.big}`}
        organizer={event.organizations?.name ?? 'Organizer'}
        verified={!!event.organizations?.is_verified}
        difficulty={event.difficulty}
        status={st.text}
        statusStrong={st.strong}
        hikeDate={event.event_date}
        endDate={event.end_date}
        label={`${event.title} on ${mountainNameFor(event.mountain_id)}, ${db.top} ${db.month} ${db.big}, ${formatTime(event.start_time)}, ${event.difficulty}, ${st.text}`}
        onPress={() => openEvent(event.id)}
      />
    );
  };

  // Time-sorted board: a heading per time group, stubs laid out in rows under it.
  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.groupHead}>
          <View style={styles.groupCopy}>
            <Text style={styles.groupTitle}>{item.title}</Text>
            <Text style={styles.groupDescription}>{item.description}</Text>
          </View>
          <View style={styles.groupCountBadge}>
            <Text style={styles.groupCount}>{item.count}</Text>
            <Text style={styles.groupCountLabel}>{item.count === 1 ? 'event' : 'events'}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.stubRow}>
        {item.items.map((it, i) => (
          <View key={'__spacer' in it ? `sp-${i}` : it.id} style={{ flex: 1 }}>
            {renderStub(it)}
          </View>
        ))}
      </View>
    );
  };

  const empty = loading ? (
    <EventsBoardSkeleton cols={cols} />
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

  const buildRows = (): Row[] => {
    if (loading) return [];
    const today = todayISO();
    const tomorrow = plusDaysISO(1);
    const weekEnd = plusDaysISO(7);
    const groups: { key: string; title: string; description: string; items: PublicEvent[] }[] = [
      { key: 'today', title: 'Today’s trail time', description: 'Hikes happening today.', items: [] },
      { key: 'tomorrow', title: 'Tomorrow’s trail plans', description: 'Get ready for what’s next.', items: [] },
      { key: 'week', title: 'This week’s adventures', description: 'More chances to get outside.', items: [] },
      { key: 'later', title: 'On the horizon', description: 'Future hikes worth looking forward to.', items: [] },
      { key: 'past', title: 'Past adventures', description: 'The trails are behind us; the stories aren’t.', items: [] },
    ];
    for (const e of filtered) {
      if (effectiveEnd(e.event_date, e.end_date) < today) groups[4].items.push(e);
      else if (e.event_date <= today) groups[0].items.push(e); // today, or a multi-day hike under way
      else if (e.event_date === tomorrow) groups[1].items.push(e);
      else if (e.event_date <= weekEnd) groups[2].items.push(e);
      else groups[3].items.push(e);
    }
    const out: Row[] = [];
    for (const g of groups) {
      if (g.items.length === 0) continue;
      out.push({
        kind: 'header',
        key: `h-${g.key}`,
        title: g.title,
        description: g.description,
        count: g.items.length,
      });
      for (let i = 0; i < g.items.length; i += cols) {
        const chunk: ListItem[] = g.items.slice(i, i + cols);
        while (chunk.length < cols) chunk.push(SPACER);
        out.push({ kind: 'row', key: `r-${g.key}-${i}-${cols}`, items: chunk });
      }
    }
    return out;
  };
  const data = buildRows();

  return (
    <>
      <Screen>
        <View style={styles.listHeader}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBack}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Ionicons name="home-outline" size={18} color={T.gold} />
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Find Your Next Adventure</Text>
              <Text style={styles.headerSubtitle}>A great trail day starts here</Text>
            </View>
            <View style={styles.headerBackSpacer} />
          </View>
          <View style={styles.headerControls}>
            <View style={styles.headerSearch}>
              <SearchBox
                compact
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search events"
              />
            </View>
            <FilterButton compact count={activeCount} onPress={() => setFiltersOpen(true)} />
          </View>
        </View>

        <View style={[styles.eventsLayout, isSplitLayout && styles.eventsLayoutSplit]}>
          {isSplitLayout ? (
            <View style={[styles.mountainPanel, { width: width * 0.45 }]}>
              <ScrollView
                style={styles.mountainPanelScroll}
                contentContainerStyle={styles.mountainPanelScrollContent}
                scrollEnabled={mountainDescriptionExpanded}
                nestedScrollEnabled
                showsVerticalScrollIndicator={mountainDescriptionExpanded}
              >
                <Text style={styles.mountainPanelEyebrow}>YOUR TRAIL DESTINATION</Text>
                <View style={styles.mountainTitleRow}>
                  <Text style={styles.mountainPanelTitle}>
                    {activeMountain?.name ?? 'Mountain adventures'}
                  </Text>
                  <Ionicons name="trail-sign-outline" size={22} color={T.gold} />
                </View>
                {activeMountain?.location ? (
                  <View style={styles.mountainLocation}>
                    <Ionicons name="location-outline" size={14} color={T.muted} />
                    <Text style={styles.mountainPanelMeta}>{activeMountain.location}</Text>
                  </View>
                ) : null}
                {!mountainDescriptionExpanded ? (
                  <>
                    <Text
                      style={styles.mountainDescriptionMeasure}
                      onTextLayout={measureMountainDescription}
                      accessible={false}
                    >
                      {mountainDescription}
                    </Text>
                    <Text
                      style={styles.mountainPanelDescription}
                      numberOfLines={5}
                      ellipsizeMode="clip"
                    >
                      {mountainDescriptionPreview}
                      {mountainDescriptionHasMore ? (
                        <Text
                          style={styles.mountainDescriptionInlineLink}
                          onPress={() => setMountainDescriptionExpanded(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Read more mountain description"
                        >
                          …
                        </Text>
                      ) : null}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.mountainPanelDescription}>{mountainDescription}</Text>
                )}
                {mountainDescriptionExpanded ? (
                  <TouchableOpacity
                    onPress={() => setMountainDescriptionExpanded((expanded) => !expanded)}
                    style={styles.mountainDescriptionToggle}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Show less mountain description"
                  >
                    <Text style={styles.mountainDescriptionToggleText}>Show less</Text>
                    <Ionicons name="chevron-up" size={13} color={T.gold} />
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
          <FlatList
            style={[styles.eventsList, isSplitLayout && styles.eventsListSplit]}
            data={data}
            keyExtractor={(r) => r.key}
            renderItem={renderRow}
            ListEmptyComponent={empty}
            contentContainerStyle={styles.listContent}
            extraData={[counts, mountains, cols]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
          />
        </View>
      </Screen>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        dateRange={dateRange}
        onDateRange={setDateRange}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
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
  listHeader: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackSpacer: { width: 36 },
  headerTitleBlock: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { color: T.text, fontFamily: SERIF, fontSize: 20, textAlign: 'center' },
  headerSubtitle: { color: T.muted, fontSize: 12, textAlign: 'center' },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSearch: { flex: 1, minWidth: 0 },
  eventsLayout: { flex: 1 },
  eventsLayoutSplit: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  mountainPanel: {
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  mountainPanelScroll: { flex: 1 },
  mountainPanelScrollContent: { flexGrow: 1, padding: 18 },
  mountainPanelEyebrow: {
    color: T.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  mountainPanelTitle: {
    flex: 1,
    color: T.text,
    fontFamily: SERIF,
    fontSize: 24,
    lineHeight: 29,
    marginTop: 6,
  },
  mountainTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mountainLocation: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  mountainPanelMeta: { color: T.muted, fontSize: 12, flexShrink: 1 },
  mountainPanelDescription: {
    color: T.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
  },
  mountainDescriptionMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    color: T.body,
    fontSize: 13,
    lineHeight: 19,
  },
  mountainDescriptionInlineLink: { color: T.gold, fontWeight: '700' },
  mountainDescriptionToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 7,
    paddingVertical: 3,
  },
  mountainDescriptionToggleText: { color: T.gold, fontSize: 12, fontWeight: '700' },
  eventsList: { marginHorizontal: 16 },
  eventsListSplit: { flex: 1, marginHorizontal: 0 },
  listContent: { paddingBottom: 20, flexGrow: 1 },

  // Time groups
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  groupCopy: { flex: 1, gap: 3 },
  groupTitle: { color: T.text, fontFamily: SERIF, fontSize: 16 },
  groupDescription: { color: T.muted, fontSize: 11, lineHeight: 15 },
  groupCountBadge: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: T.goldSoft,
    borderWidth: 1,
    borderColor: T.goldLine,
  },
  groupCount: { color: T.gold, fontSize: 15, fontWeight: '700' },
  groupCountLabel: { color: T.muted, fontSize: 9, fontWeight: '600' },
  stubRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  // Filters sheet
  fBody: { paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  fBodyWide: { flexDirection: 'row' },
  filterGroup: { flex: 1, gap: 6 },
  fLabel: { color: T.muted, fontSize: 12, fontWeight: '700' },
  optionRows: { gap: 6 },
  optionRow: { flexDirection: 'row', gap: 6 },
  optionRowCentered: { justifyContent: 'center' },
  optionSpacer: { flex: 1 },
  opt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
    backgroundColor: T.ctrl,
  },
  optActive: { backgroundColor: T.goldSoft, borderColor: T.goldLine },
  optText: { color: T.body, fontSize: 12, flexShrink: 1 },
  optTextOn: { color: T.gold, fontWeight: '700' },
  resetText: { color: T.gold, fontSize: 14, fontWeight: '600' },

  // States
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
  stateTitle: { color: T.text, fontFamily: SERIF, fontSize: 17, textAlign: 'center' },
  stateText: { color: T.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});