import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  organizationService,
  type Organization,
  type HikingEvent,
  type DashboardStats,
} from '../../services/organizationService';

export default function OrgDashboard() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading your dashboard…</Text>
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

  const upcoming = events.filter(
    (e) => e.status === 'published' && e.event_date >= new Date().toISOString().slice(0, 10)
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A96E" />
      }
    >
      {/* Top bar */}
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Organizer dashboard</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {org.name}
            </Text>
            {org.is_verified ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="shield-checkmark" size={11} color="#0E1520" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : (
              <View style={styles.pendingPill}>
                <Ionicons name="time-outline" size={11} color="#C9A96E" />
                <Text style={styles.pendingText}>Pending verification</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/organizations/Profile')}
          style={styles.iconButton}
        >
          <Ionicons name="person-circle-outline" size={22} color="#F4E7C5" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} style={styles.iconButton}>
          <Ionicons name="log-out-outline" size={20} color="#E07070" />
        </TouchableOpacity>
      </View>

      {/* Unverified banner */}
      {!org.is_verified && (
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={16} color="#C9A96E" />
          <Text style={styles.bannerText}>
            Your organization is awaiting admin verification. You can create events as
            drafts, but they won't be publicly visible until you're verified.
          </Text>
        </View>
      )}

      {/* Stat grid */}
      <View style={styles.summaryGrid}>
        <StatCard label="Upcoming" value={stats?.upcomingCount ?? 0} />
        <StatCard label="Attendees" value={stats?.totalAttendees ?? 0} />
        <StatCard label="Drafts" value={stats?.draftCount ?? 0} />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/organizations/CreateEvent')}
        >
          <Ionicons name="add-circle-outline" size={18} color="#0E1520" />
          <Text style={styles.primaryButtonText}>Create event</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/organizations/Events')}
        >
          <Ionicons name="calendar-outline" size={18} color="#F4E7C5" />
          <Text style={styles.secondaryButtonText}>View all</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming events */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <Text style={styles.sectionLink}>{upcoming.length} event{upcoming.length === 1 ? '' : 's'}</Text>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={28} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>No published events yet.</Text>
          <Text style={styles.emptyHint}>
            Create your first event and publish it once verified.
          </Text>
        </View>
      ) : (
        upcoming.slice(0, 5).map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventCard}
            onPress={() =>
              router.push({
                pathname: '/organizations/Events',
                params: { eventId: event.id },
              } as any)
            }
          >
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <View style={styles.openPill}>
                <Text style={styles.openPillText}>Open</Text>
              </View>
            </View>
            <Text style={styles.eventMeta}>
              {event.event_date} · {event.start_time}
            </Text>
            <Text style={styles.eventMeta}>
              {event.difficulty} · capacity {event.capacity ?? '∞'}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 20, paddingTop: 28, paddingBottom: 60, gap: 16 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  title: { color: '#F3F6FA', fontSize: 22, fontWeight: '800', flexShrink: 1 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6FAF8A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedText: { color: '#0E1520', fontSize: 10, fontWeight: '800' },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pendingText: { color: '#C9A96E', fontSize: 10, fontWeight: '700' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#151F2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(201,169,110,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  bannerText: { color: '#E8D7AE', fontSize: 12, flex: 1, lineHeight: 17 },
  summaryGrid: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  summaryLabel: { color: '#A9B7C4', fontSize: 11, marginBottom: 8 },
  summaryValue: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#0E1520', fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#111C27',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: { color: '#F4E7C5', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: '#F3F6FA', fontSize: 17, fontWeight: '700' },
  sectionLink: { color: '#C9A96E', fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },
  eventCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  eventTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 10 },
  openPill: { backgroundColor: '#1D8F6A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  openPillText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  eventMeta: { color: '#B7C7D6', fontSize: 12, marginTop: 2 },
});