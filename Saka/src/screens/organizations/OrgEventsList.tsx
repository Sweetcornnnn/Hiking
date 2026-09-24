import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  organizationService,
  type Organization,
  type HikingEvent,
  type EventStatus,
} from '../../services/organizationService';
import { mountainService } from '../../services/mountainService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';

type FilterTab = 'all' | 'draft' | 'published' | 'cancelled';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<EventStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'rgba(201,169,110,0.18)', text: '#C9A96E', label: 'Draft' },
  published: { bg: 'rgba(29,143,106,0.2)', text: '#3FD69D', label: 'Published' },
  full: { bg: 'rgba(230,126,34,0.2)', text: '#E67E22', label: 'Full' },
  cancelled: { bg: 'rgba(224,112,112,0.18)', text: '#E07070', label: 'Cancelled' },
  completed: { bg: 'rgba(106,127,149,0.2)', text: '#8FA4BA', label: 'Completed' },
};

export default function OrgEventsList() {
  const router = useRouter();
  useRequireOrganization();
  const params = useLocalSearchParams<{ mountainId?: string }>();

  const [org, setOrg] = useState<Organization | null>(null);
  const [events, setEvents] = useState<HikingEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, { confirmed: number; waitlist: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const organization = await organizationService.getMyOrganization();
      if (!organization) {
        router.replace('/organizations/BecomeOrganizer');
        return;
      }
      setOrg(organization);

      const list = await organizationService.getMyEvents(organization.id);
      setEvents(list);

      const rsvpCounts = await organizationService.getEventRsvpCounts(list.map((e) => e.id));
      setCounts(rsvpCounts);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (tab === 'all') return events;
    if (tab === 'published') {
      return events.filter((e) => e.status === 'published' || e.status === 'full');
    }
    return events.filter((e) => e.status === tab);
  }, [events, tab]);

  const mountainName = (mountainId: string) => {
    const cached = mountainService.getCachedMountainById(mountainId);
    return cached?.name ?? 'Mountain';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading your events…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color="#E07070" />
        <Text style={styles.centeredText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchAll}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!org) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A96E" />
      }
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Your events</Text>
        <Text style={styles.title}>{events.length} event{events.length === 1 ? '' : 's'}</Text>
      </View>

      {/* New event button */}
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => router.push('/organizations/CreateEvent')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={18} color="#0E1520" />
        <Text style={styles.newBtnText}>Create new event</Text>
      </TouchableOpacity>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabChip, tab === t.id && styles.tabChipActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabChipText, tab === t.id && styles.tabChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Event cards */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={30} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>
            {tab === 'all' ? 'No events yet' : `No ${tab} events`}
          </Text>
          <Text style={styles.emptyHint}>
            {tab === 'all'
              ? 'Create your first hiking event to get started.'
              : 'Try a different filter.'}
          </Text>
        </View>
      ) : (
        filtered.map((event) => {
          const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
          const statusMeta = STATUS_COLORS[event.status];
          const capacityLabel = event.capacity ? `${c.confirmed} / ${event.capacity}` : `${c.confirmed}`;

          return (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() =>
                router.push({
                  pathname: '/organizations/EventDetail',
                  params: { eventId: event.id },
                } as any)
              }
              activeOpacity={0.85}
            >
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                  <Text style={[styles.statusPillText, { color: statusMeta.text }]}>
                    {statusMeta.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="trail-sign-outline" size={12} color="rgba(255,255,255,0.4)" />
                <Text style={styles.metaText}>{mountainName(event.mountain_id)}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.4)" />
                <Text style={styles.metaText}>
                  {event.event_date} · {event.start_time}
                </Text>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.metaRow}>
                  <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>{capacityLabel} attending</Text>
                </View>
                {c.waitlist > 0 && (
                  <View style={styles.waitlistPill}>
                    <Text style={styles.waitlistPillText}>{c.waitlist} waitlist</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 20, paddingTop: 26, paddingBottom: 60, gap: 12 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },

  header: { gap: 4, marginTop: 4 },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 6,
  },
  newBtnText: { color: '#0E1520', fontWeight: '800', fontSize: 13 },

  tabsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabChipActive: { backgroundColor: '#C9A96E', borderColor: '#C9A96E' },
  tabChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  tabChipTextActive: { color: '#0E1520', fontWeight: '800' },

  eventCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 6,
    marginTop: 4,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 10 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#B7C7D6', fontSize: 12 },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  waitlistPill: {
    backgroundColor: 'rgba(201,169,110,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  waitlistPillText: { color: '#C9A96E', fontSize: 10, fontWeight: '700' },

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
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },
});