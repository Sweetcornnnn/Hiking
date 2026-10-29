import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

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

  const handleSignOut = useCallback(() => {
    setShowSignOutConfirm(true);
  }, []);

  const confirmSignOut = useCallback(async () => {
    setShowSignOutConfirm(false);
    await signOut();
    router.replace('/Login');
  }, [signOut, router]);

  if (loading) return <CenteredState loading message="Loading your dashboard…" />;
  if (error) return <CenteredState message={error} actionLabel="Retry" onAction={fetchAll} />;
  if (!org) return null;

  const today = todayISO();
  const upcoming = events.filter(
    (e) => e.status === 'published' && (e.end_date ?? e.event_date) >= today,
  );

  return (
    <>
      <OrgLandscapeShell
        icon="business-outline"
        eyebrow="Organizer dashboard"
        title={org.name}
        badge={
          org.is_verified ? (
            <Pill label="Verified" icon="shield-checkmark" bg="rgba(63,214,157,0.12)" color={PC.green} border="rgba(63,214,157,0.28)" uppercase={false} />
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
                  <Pill label="Open" bg="rgba(29,143,106,0.2)" color={PC.green} />
                </View>
                <MetaRow
                  icon="calendar-outline"
                  text={
                    event.end_date && event.end_date !== event.event_date
                      ? `${event.event_date} – ${event.end_date} · ${event.start_time}`
                      : `${event.event_date} · ${event.start_time}`
                  }
                />
                <MetaRow
                  icon="speedometer-outline"
                  text={`${event.difficulty} · capacity ${event.capacity ?? '∞'}`}
                />
              </Card>
            ))}
          </Grid>
        )}
      </OrgLandscapeShell>

      <Modal
        transparent
        visible={showSignOutConfirm}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowSignOutConfirm(false)}
      >
        <View style={styles.logoutRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSignOutConfirm(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel sign out"
          />
          <View pointerEvents="none" style={styles.logoutScrim} />
          <View style={styles.logoutCard} accessibilityViewIsModal>
            <View pointerEvents="none" style={styles.logoutContourAnchor}>
              {[96, 150, 210, 280].map((width, index) => (
                <View
                  key={width}
                  style={{
                    position: 'absolute',
                    left: -width / 2,
                    top: -(width * 0.62) / 2,
                    width,
                    height: width * 0.62,
                    borderRadius: width / 2,
                    borderWidth: 1,
                    borderColor: `rgba(224,112,112,${0.14 - index * 0.03})`,
                    transform: [{ rotate: `${index % 2 === 0 ? -8 : 6}deg` }],
                  }}
                />
              ))}
            </View>

            <View style={styles.logoutIconRing}>
              <View style={styles.logoutIconCircle}>
                <Ionicons name="log-out-outline" size={26} color="#E07070" />
              </View>
            </View>
            <Text style={styles.logoutTitle} accessibilityRole="header">Sign out of Saka?</Text>
            <Text style={styles.logoutMessage}>You’ll be taken back to the login screen.</Text>
            <View style={styles.logoutPerf} />
            <View style={styles.logoutActions}>
              <Pressable
                onPress={() => setShowSignOutConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel="Stay signed in"
                style={({ pressed }) => [styles.logoutStay, pressed && styles.pressed]}
              >
                <Text style={styles.logoutStayText}>Stay</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmSignOut()}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={({ pressed }) => [styles.logoutConfirm, pressed && styles.pressed]}
              >
                <Text style={styles.logoutConfirmText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: PC.textPrimary, fontSize: FS.title - 1, fontWeight: '700' },
  sectionCount: { color: PC.gold, fontWeight: '700', fontSize: FS.small },

  eventCard: { gap: 5 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  eventTitle: { color: PC.textPrimary, fontSize: FS.base, fontWeight: '700', flex: 1 },
  logoutRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoutScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4,8,13,0.7)',
  },
  logoutCard: {
    width: '88%',
    maxWidth: 360,
    alignItems: 'center',
    paddingTop: 30,
    borderRadius: 24,
    backgroundColor: '#0E1520',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },
  logoutContourAnchor: { position: 'absolute', left: '50%', top: 58, width: 0, height: 0 },
  logoutIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(224,112,112,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(224,112,112,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(224,112,112,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  logoutMessage: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 28,
  },
  logoutPerf: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginTop: 22,
    borderTopWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: 'rgba(201,169,110,0.28)',
  },
  logoutActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 22,
  },
  logoutStay: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutStayText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  logoutConfirm: {
    flex: 1.15,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E07070',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutConfirmText: { color: '#0E1520', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});