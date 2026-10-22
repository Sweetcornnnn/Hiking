import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  organizationService,
  type Organization,
  type HikingEvent,
} from '../../services/organizationService';
import { mountainService } from '../../services/mountainService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  OptionRow,
  EmptyState,
  Card,
  Pill,
  StatusPill,
  PC,
  SP,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

type FilterTab = 'all' | 'draft' | 'published' | 'cancelled';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrgEventsList() {
  const router = useRouter();
  useRequireOrganization();

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

  const matchesTab = useCallback((e: HikingEvent, id: FilterTab) => {
    if (id === 'all') return true;
    if (id === 'published') return e.status === 'published' || e.status === 'full';
    return e.status === id;
  }, []);

  const filtered = useMemo(() => events.filter((e) => matchesTab(e, tab)), [events, tab, matchesTab]);

  const tabCount = useCallback(
    (id: FilterTab) => events.filter((e) => matchesTab(e, id)).length,
    [events, matchesTab]
  );

  const mountainName = (mountainId: string) => {
    const cached = mountainService.getCachedMountainById(mountainId);
    return cached?.name ?? 'Mountain';
  };

  if (loading) return <CenteredState loading message="Loading your events…" />;
  if (error) return <CenteredState message={error} actionLabel="Retry" onAction={fetchAll} />;
  if (!org) return null;

  return (
    <OrgLandscapeShell
      onBack={() => router.back()}
      backLabel="Dashboard"
      eyebrow="Your events"
      title={`${events.length} event${events.length === 1 ? '' : 's'}`}
      rail={
        <View style={styles.filterList}>
          {TABS.map((t) => (
            <OptionRow
              key={t.id}
              label={t.label}
              count={tabCount(t.id)}
              active={tab === t.id}
              onPress={() => setTab(t.id)}
            />
          ))}
        </View>
      }
      railFooter={
        <RailButton
          icon="add-circle-outline"
          label="Create new event"
          variant="primary"
          onPress={() => router.push('/organizations/CreateEvent')}
        />
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PC.gold} />
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title={tab === 'all' ? 'No events yet' : `No ${tab} events`}
          hint={
            tab === 'all'
              ? 'Create your first hiking event to get started.'
              : 'Try a different filter.'
          }
        />
      ) : (
        <Card padded={false} style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cMain]}>Event</Text>
            <Text style={[styles.th, styles.cCount]}>Attending</Text>
            <Text style={[styles.th, styles.cStatus]}>Status</Text>
            <View style={{ width: 12 }} />
          </View>

          {filtered.map((event, i) => {
            const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
            const capacityLabel = event.capacity ? `${c.confirmed} / ${event.capacity}` : `${c.confirmed}`;
            const dates =
              event.end_date && event.end_date !== event.event_date
                ? `${event.event_date} – ${event.end_date}`
                : event.event_date;

            return (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.75}
                style={[styles.row, i === filtered.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() =>
                  router.push({
                    pathname: '/organizations/EventDetail',
                    params: { eventId: event.id },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={event.title}
              >
                <View style={styles.cMain}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {mountainName(event.mountain_id)}  ·  {dates}  ·  {event.start_time}
                  </Text>
                </View>

                <View style={[styles.cCount, styles.countCell]}>
                  <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.countText}>{capacityLabel}</Text>
                  {c.waitlist > 0 && (
                    <Pill
                      label={`+${c.waitlist}`}
                      bg="rgba(201,169,110,0.12)"
                      color={PC.gold}
                      border="rgba(201,169,110,0.25)"
                      uppercase={false}
                    />
                  )}
                </View>

                <View style={styles.cStatus}>
                  <StatusPill status={event.status} />
                </View>

                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            );
          })}
        </Card>
      )}
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  filterList: { gap: 4 },

  table: { overflow: 'hidden' },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    height: 26,
    paddingHorizontal: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
  },
  th: { color: PC.textFaint, fontSize: FS.micro, fontWeight: '600', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    minHeight: 42,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  cMain: { flex: 1, minWidth: 0 },
  cCount: { width: 96 },
  cStatus: { width: 78 },
  countCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  eventTitle: { color: PC.textPrimary, fontSize: FS.base, fontWeight: '700' },
  eventMeta: { color: PC.textMuted, fontSize: FS.small, marginTop: 2 },
  countText: { color: PC.textBody, fontSize: FS.body, fontWeight: '600' },
});