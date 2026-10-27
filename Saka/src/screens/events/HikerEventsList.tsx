import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { eventService, type PublicEvent, type EventRsvpCounts } from '../../services/eventService';
import { effectiveEnd } from '../../utils/dateRange';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import {
  D,
  Shell,
  Sidebar,
  Center,
  RightPane,
  CenterMessage,
  SidebarHeader,
  SectionLabel,
  SearchField,
  SelectField,
  Chip,
  LinkButton,
  ActionButton,
  Badge,
  MetaRow,
  Meter,
  Panel,
  PickerSheet,
  todayISO,
  plusDaysISO,
  toLocalISO,
  parseISO,
  formatTime,
} from '../../components/events/DesktopKit';

const DIFFICULTIES = ['All', 'Easy', 'Moderate', 'Hard', 'Expert'] as const;
const DATE_RANGES = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
] as const;

type DateRangeId = (typeof DATE_RANGES)[number]['id'];

const shortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const longDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Compact date label for table rows. */
const dateLabel = (start: string, end?: string | null) => {
  if (end && end !== start) {
    const s = parseISO(start);
    const e = parseISO(end);
    return s.getMonth() === e.getMonth()
      ? `${shortDate(start)}–${e.getDate()}`
      : `${shortDate(start)} – ${shortDate(end)}`;
  }
  if (start === todayISO()) return { label: 'Today', hot: true };
  if (start === toLocalISO(new Date(Date.now() + 86400_000))) return { label: 'Tomorrow', hot: true };
  return longDate(start);
};

export default function HikerEventsList() {
  useRequireAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Hide the mountain column when the centre pane gets tight.
  const wide = width - D.sidebarW - D.paneW >= 500;

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Keep a valid selection so the preview pane is never empty when there are results.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!selectedId || !filtered.some((e) => e.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const mountainNameFor = (id: string) => mountains.find((m) => m.id === id)?.name ?? 'Mountain';

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

  const openEvent = (id: string) =>
    router.push({ pathname: '/events/EventDetail', params: { eventId: id } } as any);

  const statusFor = (event: PublicEvent) => {
    const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
    const hasCap = event.capacity !== null && event.capacity !== undefined;
    const left = hasCap ? (event.capacity as number) - c.confirmed : null;
    if (hasCap && (left as number) <= 0) return { color: D.orange, text: 'Full', c };
    if (left !== null)
      return { color: left <= 3 ? D.gold : D.green, text: `${left} left`, c };
    return { color: D.green, text: `${c.confirmed} going`, c };
  };

  // Full-screen loader only for the very first load; filter changes load inside the list.
  if (!hasLoaded && loading) return <CenterMessage loading message="Finding hikes…" />;

  const renderRow = ({ item: event }: { item: PublicEvent }) => {
    const isSel = event.id === selectedId;
    const verified = !!event.organizations?.is_verified;
    const date = dateLabel(event.event_date, event.end_date);
    const dateText = typeof date === 'string' ? date : date.label;
    const hot = typeof date !== 'string';
    const st = statusFor(event);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setSelectedId(event.id)}
        onLongPress={() => openEvent(event.id)}
        style={[styles.row, isSel && styles.rowSel]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSel }}
        accessibilityLabel={`${event.title}, ${st.text}`}
      >
        <View style={styles.cDate}>
          <Text style={[styles.dateMain, hot && { color: D.gold }]} numberOfLines={1}>
            {dateText}
          </Text>
          <Text style={styles.dateSub}>{formatTime(event.start_time)}</Text>
        </View>

        <View style={styles.cEvent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.byline}>
            {verified ? <Ionicons name="shield-checkmark" size={10} color={D.green} /> : null}
            <Text style={styles.org} numberOfLines={1}>
              {event.organizations?.name ?? 'Organizer'}
            </Text>
          </View>
        </View>

        {wide ? (
          <Text style={styles.cMountain} numberOfLines={1}>
            {mountainNameFor(event.mountain_id)}
          </Text>
        ) : null}

        <View style={styles.cEnd}>
          <Text style={styles.level}>{event.difficulty}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: st.color }]} />
            <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => openEvent(event.id)}
          hitSlop={8}
          accessibilityLabel={`Open ${event.title}`}
        >
          <Ionicons name="chevron-forward" size={13} color={isSel ? D.gold : D.faint} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Shell>
        {/* ── Sidebar: filters ── */}
        <Sidebar
          footer={
            hasFilters ? (
              <LinkButton icon="refresh-outline" label="Clear filters" onPress={clearFilters} />
            ) : undefined
          }
        >
          <SidebarHeader
            onBack={() => router.back()}
            backLabel="Home"
            title="Hike events"
            status={loading ? 'Updating…' : `${filtered.length} posted`}
          />

          <SearchField value={searchText} onChangeText={setSearchText} placeholder="Search hikes or organizers" />

          <SelectField
            icon="trail-sign-outline"
            text={selectedMountain ? selectedMountain.name : 'All mountains'}
            selected={!!selectedMountain}
            onPress={() => setMountainPickerOpen(true)}
            onClear={() => setMountainId(null)}
          />

          <SectionLabel>DIFFICULTY</SectionLabel>
          <View style={styles.chipWrap}>
            {DIFFICULTIES.map((d) => (
              <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(d)} />
            ))}
          </View>

          <SectionLabel>WHEN</SectionLabel>
          <View style={styles.chipWrap}>
            {DATE_RANGES.map((r) => (
              <Chip key={r.id} label={r.label} active={dateRange === r.id} onPress={() => setDateRange(r.id)} />
            ))}
          </View>
        </Sidebar>

        {/* ── Centre: table ── */}
        <Center>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cDate]}>Date</Text>
            <Text style={[styles.th, styles.cEventHead]}>Event</Text>
            {wide ? <Text style={[styles.cMountain, styles.th]}>Mountain</Text> : null}
            <Text style={[styles.th, styles.cEnd, { textAlign: 'right' }]}>Level</Text>
            <View style={{ width: 13 }} />
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={D.gold} />
              <Text style={styles.stateText}>Updating results…</Text>
            </View>
          ) : error ? (
            <View style={styles.state}>
              <Ionicons name="alert-circle-outline" size={20} color={D.red} />
              <Text style={styles.stateTitle}>{error}</Text>
              <ActionButton label="Try again" variant="ghost" onPress={onRefresh} fullWidth={false} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.state}>
              <Ionicons name="calendar-clear-outline" size={20} color={D.faint} />
              <Text style={styles.stateTitle}>No hikes match these filters</Text>
              <Text style={styles.stateText}>Widen the date range or clear the filters.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id}
              renderItem={renderRow}
              extraData={[selectedId, counts, mountains, wide]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={D.gold} />
              }
            />
          )}
        </Center>

        {/* ── Right pane: preview ── */}
        <RightPane
          footer={
            selected ? (
              <ActionButton
                icon="open-outline"
                label="View details"
                onPress={() => openEvent(selected.id)}
              />
            ) : undefined
          }
        >
          {selected ? (
            (() => {
              const st = statusFor(selected);
              const hasCap = selected.capacity !== null && selected.capacity !== undefined;
              const pct = hasCap && (selected.capacity as number) > 0
                ? (st.c.confirmed / (selected.capacity as number)) * 100
                : 0;
              const multi = !!selected.end_date && selected.end_date !== selected.event_date;
              return (
                <>
                  <View style={styles.previewHead}>
                    <Text style={styles.previewTitle} numberOfLines={2}>
                      {selected.title}
                    </Text>
                    <View style={styles.badgeRow}>
                      <Badge label={selected.difficulty} />
                      {selected.organizations?.is_verified ? (
                        <Badge
                          label="Verified"
                          icon="shield-checkmark"
                          color={D.green}
                          bg="rgba(63,214,157,0.08)"
                          border="rgba(63,214,157,0.25)"
                        />
                      ) : null}
                    </View>
                  </View>

                  <Panel style={{ gap: 6 }}>
                    <MetaRow icon="business-outline" text={selected.organizations?.name ?? 'Organizer'} color={D.text} />
                    <MetaRow icon="trail-sign-outline" text={mountainNameFor(selected.mountain_id)} />
                    <MetaRow
                      icon="calendar-outline"
                      text={multi
                        ? `${longDate(selected.event_date)} – ${longDate(selected.end_date as string)}`
                        : longDate(selected.event_date)}
                    />
                    <MetaRow icon="time-outline" text={formatTime(selected.start_time)} />
                    <MetaRow icon="location-outline" text={selected.meeting_point} lines={2} />
                  </Panel>

                  <Panel style={{ gap: 6 }}>
                    <View style={styles.attendRow}>
                      <Text style={styles.attendLabel}>Attending</Text>
                      <Text style={styles.attendValue}>
                        {st.c.confirmed}
                        {hasCap ? <Text style={styles.attendSub}>{` / ${selected.capacity}`}</Text> : null}
                      </Text>
                    </View>
                    {hasCap ? <Meter value={pct} color={st.text === 'Full' ? D.orange : D.green} /> : null}
                    {st.c.waitlist > 0 ? (
                      <Text style={styles.waitlist}>{st.c.waitlist} on the waitlist</Text>
                    ) : null}
                  </Panel>

                  {selected.description ? (
                    <Text style={styles.previewDesc} numberOfLines={3}>
                      {selected.description}
                    </Text>
                  ) : null}
                </>
              );
            })()
          ) : (
            <View style={styles.state}>
              <Ionicons name="reader-outline" size={20} color={D.faint} />
              <Text style={styles.stateText}>Select a hike to preview it here.</Text>
            </View>
          )}
        </RightPane>
      </Shell>

      <PickerSheet
        visible={mountainPickerOpen}
        title="Filter by mountain"
        allLabel="All mountains"
        items={mountains}
        selectedId={mountainId}
        onSelect={setMountainId}
        onClose={() => setMountainPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },

  // Table
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 30,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  th: { color: D.faint, fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  rowSel: { backgroundColor: D.goldSoft, borderLeftColor: D.gold },

  cDate: { width: 74 },
  cEvent: { flex: 1, minWidth: 0 },
  cEventHead: { flex: 1 },
  cMountain: { width: 104, color: D.muted, fontSize: 10.5 },
  cEnd: { width: 70, alignItems: 'flex-end' },

  dateMain: { color: D.text, fontSize: 11, fontWeight: '600' },
  dateSub: { color: D.muted, fontSize: 9.5, marginTop: 1 },
  rowTitle: { color: D.text, fontSize: 12, fontWeight: '700' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  org: { color: D.muted, fontSize: 10, flexShrink: 1 },
  level: { color: D.gold, fontSize: 10.5, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9.5, fontWeight: '600' },

  // States
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 },
  stateTitle: { color: D.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  stateText: { color: D.muted, fontSize: 10.5, textAlign: 'center' },

  // Preview
  previewHead: { gap: 6 },
  previewTitle: { color: D.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.1, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  attendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attendLabel: { color: D.faint, fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  attendValue: { color: D.text, fontSize: 14, fontWeight: '800' },
  attendSub: { color: D.muted, fontSize: 10.5, fontWeight: '600' },
  waitlist: { color: D.gold, fontSize: 10, fontWeight: '600' },
  previewDesc: { color: D.muted, fontSize: 10.5, lineHeight: 15 },
});