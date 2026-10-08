import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
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
  MetaRow,
  Grid,
  PC,
  SP,
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
        <Grid>
          {filtered.map((event) => {
            const c = counts[event.id] ?? { confirmed: 0, waitlist: 0, total: 0 };
            const capacityLabel = event.capacity ? `${c.confirmed} / ${event.capacity}` : `${c.confirmed}`;

            return (
              <Card
                key={event.id}
                style={styles.eventCard}
                onPress={() =>
                  router.push({
                    pathname: '/organizations/EventDetail',
                    params: { eventId: event.id },
                  } as any)
                }
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <StatusPill status={event.status} />
                </View>

                <MetaRow icon="trail-sign-outline" text={mountainName(event.mountain_id)} />
                <MetaRow
                  icon="calendar-outline"
                  text={
                    event.end_date && event.end_date !== event.event_date
                      ? `${event.event_date} – ${event.end_date} · ${event.start_time}`
                      : `${event.event_date} · ${event.start_time}`
                  }
                />

                <View style={styles.footerRow}>
                  <MetaRow icon="people-outline" text={`${capacityLabel} attending`} />
                  {c.waitlist > 0 && (
                    <Pill
                      label={`${c.waitlist} waitlist`}
                      bg="rgba(201,169,110,0.12)"
                      color={PC.gold}
                      border="rgba(201,169,110,0.25)"
                      uppercase={false}
                    />
                  )}
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                </View>
              </Card>
            );
          })}
        </Grid>
      )}
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  filterList: { gap: 6 },

  eventCard: { gap: 6 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  eventTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});