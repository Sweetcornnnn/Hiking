import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { eventService, type PublicEvent, type EventRsvpCounts } from '../../services/eventService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireAuth } from '../../hooks/useRoleGuard';

const DIFFICULTIES = ['All', 'Easy', 'Moderate', 'Hard', 'Expert'] as const;
const DATE_RANGES = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
] as const;

type DateRangeId = (typeof DATE_RANGES)[number]['id'];

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (days: number) =>
  new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

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
      const from =
        dateRange === 'week' ? todayISO()
        : dateRange === 'month' ? todayISO()
        : dateRange === 'upcoming' ? todayISO()
        : undefined;

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Finding hikes near you…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A96E" />
        }
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color="#C9A96E" />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Discover hikes</Text>
        <Text style={styles.title}>Upcoming events</Text>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={15} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search events or organizers"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.searchInput}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Mountain filter */}
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setMountainPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="trail-sign-outline" size={15} color="#C9A96E" />
          <Text style={[styles.pickerText, selectedMountain && styles.pickerTextSelected]}>
            {selectedMountain ? selectedMountain.name : 'All mountains'}
          </Text>
          {selectedMountain && (
            <TouchableOpacity onPress={() => setMountainId(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
          {!selectedMountain && (
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.3)" />
          )}
        </TouchableOpacity>

        {/* Difficulty chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDifficulty(d)}
              style={[styles.chip, difficulty === d && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date range chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DATE_RANGES.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setDateRange(r.id)}
              style={[styles.chip, dateRange === r.id && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, dateRange === r.id && styles.chipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results */}
        {error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#E07070" />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-clear-outline" size={30} color="rgba(255,255,255,0.25)" />
            <Text style={styles.emptyText}>No events match your filters</Text>
            <Text style={styles.emptyHint}>Try widening the date range or clearing filters.</Text>
          </View>
        ) : (
          filtered.map((event) => {
            const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
            const isFull = event.capacity !== null && c.confirmed >= event.capacity;

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() =>
                  router.push({
                    pathname: '/events/EventDetail',
                    params: { eventId: event.id },
                  } as any)
                }
                activeOpacity={0.85}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {isFull ? (
                    <View style={[styles.badge, styles.badgeFull]}>
                      <Text style={styles.badgeTextFull}>Full</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeOpen]}>
                      <Text style={styles.badgeTextOpen}>Open</Text>
                    </View>
                  )}
                </View>

                <View style={styles.orgRow}>
                  <Ionicons
                    name={event.organizations?.is_verified ? 'shield-checkmark' : 'business-outline'}
                    size={11}
                    color={event.organizations?.is_verified ? '#3FD69D' : 'rgba(255,255,255,0.5)'}
                  />
                  <Text style={styles.orgText} numberOfLines={1}>
                    {event.organizations?.name ?? 'Organizer'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="trail-sign-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>{mountainNameFor(event.mountain_id)}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>
                    {formatDate(event.event_date)} · {formatTime(event.start_time)}
                  </Text>
                </View>

                <View style={styles.footerRow}>
                  <View style={styles.metaRow}>
                    <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.metaText}>
                      {c.confirmed}
                      {event.capacity ? ` / ${event.capacity}` : ''} attending
                    </Text>
                  </View>
                  <View style={styles.diffPill}>
                    <Text style={styles.diffPillText}>{event.difficulty}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Mountain picker */}
      <Modal
        transparent
        visible={mountainPickerOpen}
        animationType="fade"
        onRequestClose={() => setMountainPickerOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by mountain</Text>
              <TouchableOpacity onPress={() => setMountainPickerOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={mountains}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setMountainId(item.id);
                    setMountainPickerOpen(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRowTitle}>{item.name}</Text>
                    <Text style={styles.modalRowSub}>
                      {item.difficulty} · {item.elevationDisplay}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 20, paddingTop: 26, paddingBottom: 80, gap: 10 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    height: 42,
    marginTop: 6,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 13 },

  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerText: { flex: 1, color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  pickerTextSelected: { color: '#FFF', fontWeight: '600' },

  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { backgroundColor: '#C9A96E', borderColor: '#C9A96E' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#0E1520', fontWeight: '800' },

  eventCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 6,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeOpen: { backgroundColor: 'rgba(29,143,106,0.2)' },
  badgeTextOpen: { color: '#3FD69D', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  badgeFull: { backgroundColor: 'rgba(230,126,34,0.2)' },
  badgeTextFull: { color: '#E67E22', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  orgText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#B7C7D6', fontSize: 12 },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  diffPill: {
    backgroundColor: 'rgba(201,169,110,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  diffPillText: { color: '#C9A96E', fontSize: 10, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 30,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 440, maxHeight: 500,
    backgroundColor: '#111927',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalClose: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  modalRowTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  modalRowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
});