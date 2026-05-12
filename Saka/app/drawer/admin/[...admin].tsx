import { useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/authStore';
import { useHikesStore } from '../../../src/store/hikesStore';

export default function AdminRoute() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { allHikes, adminStats, fetchAllHikes, fetchAdminStats, isLoading } = useHikesStore();

  useEffect(() => {
    if (!user?.is_admin) {
      router.replace('/drawer/home');
      return;
    }

    fetchAllHikes();
    fetchAdminStats();
  }, [user?.is_admin]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Manage hikes and monitor members</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('../drawer/home')} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardFirst]}>
          <Text style={styles.statLabel}>Total Hikes</Text>
          <Text style={styles.statValue}>{adminStats?.total_hikes || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Users</Text>
          <Text style={styles.statValue}>{adminStats?.total_users || 0}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={fetchAllHikes} style={styles.actionButton}>
          <Ionicons name="refresh" size={18} color="#2C3E50" />
          <Text style={styles.actionButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Hikes</Text>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading hike records...</Text>
        </View>
      ) : allHikes.length === 0 ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>No hikes found yet.</Text>
        </View>
      ) : (
        allHikes.map((hike) => (
          <View key={hike.id} style={styles.hikeCard}>
            <View style={styles.hikeHeader}>
              <Text style={styles.hikeTitle}>{hike.user?.name || hike.user?.email || 'Unknown Hiker'}</Text>
              <Text style={styles.hikeMeta}>{new Date(hike.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.hikeDetail}>Start: {hike.start_time}</Text>
            <Text style={styles.hikeDetail}>End: {hike.end_time}</Text>
            <Text style={styles.hikeDetail}>Tagalongs: {hike.tagalongs}</Text>
            <Text style={styles.hikeDetail}>Contact: {hike.contact_number}</Text>
            <Text style={styles.hikeDetail}>Emergency: {hike.emergency_contact}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2C3E50',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C3E50',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  headerButtonText: {
    color: '#F5E6D3',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F5F2EA',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  statCardFirst: {
    marginRight: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B7355',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2C3E50',
  },
  actionRow: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#D4A574',
    borderRadius: 999,
  },
  actionButtonText: {
    color: '#2C3E50',
    fontWeight: '700',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 12,
  },
  loadingCard: {
    backgroundColor: '#F5F2EA',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  hikeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  hikeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hikeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
  },
  hikeMeta: {
    fontSize: 12,
    color: '#8B7355',
  },
  hikeDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
