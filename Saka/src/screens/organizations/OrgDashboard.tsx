import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import {
  organizationService,
  type Organization,
  type HikingEvent,
  type DashboardStats,
} from '../../services/organizationService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  RailIconButton,
  CenteredState,
  Banner,
  Card,
  Pill,
  Grid,
  StatCard,
  EmptyState,
  MetaRow,
  PC,
  SP,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

// Local date (toISOString is UTC and is off by a day for early-morning UTC+8 users).
const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function OrgDashboard() {
  const router = useRouter();
  const { signOut } = useAuthStore();
  useRequireOrganization();

  const [org, setOrg] = useState<Organization | null>(null);
  const [events, setEvents] = useState<HikingEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const organization = await organizationService.getMyOrganization();

      if (!organization) {
        // Role says organization, but no org row exists yet — push to creation.
        router.replace('/organizations/BecomeOrganizer');
        return;
      }

      setOrg(organization);

      const [evts, dashStats] = await Promise.all([
        organizationService.getMyEvents(organization.id),
        organizationService.getDashboardStats(organization.id),
      ]);

      setEvents(evts);
      setStats(dashStats);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
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

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/Login');
  }, [signOut, router]);

  if (loading) return <CenteredState loading message="Loading your dashboard…" />;
  if (error) return <CenteredState message={error} actionLabel="Retry" onAction={fetchAll} />;
  if (!org) return null;

  const today = todayISO();
  const upcoming = events.filter((e) => e.status === 'published' && e.event_date >= today);

  return (
    <OrgLandscapeShell
      icon="business-outline"
      eyebrow="Organizer dashboard"
      title={org.name}
      badge={
        org.is_verified ? (
          <Pill label="Verified" icon="shield-checkmark" bg="#6FAF8A" color="#0E1520" uppercase={false} />
        ) : (
          <Pill
            label="Pending verification"
            icon="time-outline"
            bg="rgba(201,169,110,0.12)"
            color={PC.gold}
            border="rgba(201,169,110,0.3)"
            uppercase={false}
          />
        )
      }
      headerActions={
        <>
          <RailIconButton
            icon="person-circle-outline"
            color="#F4E7C5"
            label="Organization profile"
            onPress={() => router.push('/organizations/Profile')}
          />
          <RailIconButton
            icon="compass-outline"
            color={PC.green}
            label="Browse as hiker"
            onPress={() => router.push('/Home')}
          />
          <RailIconButton
            icon="log-out-outline"
            color={PC.danger}
            label="Sign out"
            onPress={handleSignOut}
          />
        </>
      }
      rail={
        <Grid columns={3} gap={6}>
          <StatCard label="Upcoming" value={stats?.upcomingCount ?? 0} />
          <StatCard label="Attendees" value={stats?.totalAttendees ?? 0} />
          <StatCard label="Drafts" value={stats?.draftCount ?? 0} />
        </Grid>
      }
      railFooter={
        <>
          <RailButton
            icon="add-circle-outline"
            label="Create event"
            variant="primary"
            onPress={() => router.push('/organizations/CreateEvent')}
          />
          <RailButton
            icon="calendar-outline"
            label="View all events"
            variant="secondary"
            onPress={() => router.push('/organizations/Events')}
          />
        </>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PC.gold} />
      }
    >
      {!org.is_verified && (
        <Banner>
          Your organization is awaiting admin verification. You can create events as drafts, but
          they won't be publicly visible until you're verified.
        </Banner>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <Text style={styles.sectionCount}>
          {upcoming.length} event{upcoming.length === 1 ? '' : 's'}
        </Text>
      </View>

      {upcoming.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title="No published events yet"
          hint="Create your first event and publish it once verified."
        />
      ) : (
        <Grid>
          {upcoming.slice(0, 6).map((event) => (
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
                <Pill label="Open" bg="#1D8F6A" color="#FFFFFF" />
              </View>
              <MetaRow icon="calendar-outline" text={`${event.event_date} · ${event.start_time}`} />
              <MetaRow
                icon="speedometer-outline"
                text={`${event.difficulty} · capacity ${event.capacity ?? '∞'}`}
              />
            </Card>
          ))}
        </Grid>
      )}
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F3F6FA', fontSize: 16, fontWeight: '700' },
  sectionCount: { color: PC.gold, fontWeight: '700', fontSize: FS.body },

  eventCard: { gap: 6 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  eventTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
});