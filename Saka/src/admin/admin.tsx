import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useHikesStore } from '../store/hikesStore';
import { useNotificationStore } from '../store/notificationStore';

export default function AdminRoute() {
  const router = useRouter();
  const { user, authToken } = useAuthStore();
  const { allHikes, adminStats, fetchAllHikes, fetchAdminStats, isLoading } = useHikesStore();
  const { passwordChangeRequests, unreadCount, fetchPasswordChangeRequests, approvePasswordChange, rejectPasswordChange } = useNotificationStore();
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [processRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (!user?.is_admin) {
      router.replace('/drawer/home');
      return;
    }

    fetchAllHikes();
    fetchAdminStats();
    if (authToken) {
      fetchPasswordChangeRequests(authToken);
    }
  }, [user?.is_admin, authToken]);

  const filteredRequests = passwordChangeRequests.filter(req => 
    filterStatus === 'all' ? true : req.status === filterStatus
  );

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    const { error } = await approvePasswordChange(requestId, authToken || '');
    setProcessingRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });

    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success', 'Password change approved');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    const { error } = await rejectPasswordChange(requestId, authToken || '');
    setProcessingRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });

    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success', 'Password change rejected');
    }
  };

  return (
    <>
      <Modal
        transparent
        visible={notificationModalVisible}
        animationType="slide"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Password Change Requests</Text>
            <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
              <Ionicons name="close" size={24} color="#2C3E50" />
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTab, filterStatus === tab && styles.filterTabActive]}
                onPress={() => setFilterStatus(tab)}
              >
                <Text style={[styles.filterTabText, filterStatus === tab && styles.filterTabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={60} color="#6FAF8A" />
                <Text style={styles.emptyStateText}>
                  {filterStatus === 'pending' ? 'No pending requests' : `No ${filterStatus} requests`}
                </Text>
              </View>
            ) : (
              filteredRequests.map((request) => (
                <View key={request.id} style={[styles.requestCard, request.status === 'pending' && styles.requestCardPending]}>
                  <View style={styles.requestHeader}>
                    <View>
                      <Text style={styles.requestName}>{request.userName}</Text>
                      <Text style={styles.requestEmail}>{request.userEmail}</Text>
                    </View>
                    <View style={[styles.statusBadge, styles[`status${request.status.charAt(0).toUpperCase() + request.status.slice(1)}`]]}>
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.requestDate}>
                    📅 Requested: {new Date(request.requestedAt).toLocaleString()}
                  </Text>
                  
                  {request.respondedAt && (
                    <Text style={styles.respondedDate}>
                      ✓ {request.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(request.respondedAt).toLocaleString()}
                    </Text>
                  )}

                  {request.status === 'pending' && (
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        style={[styles.modalActionButton, styles.approveButton]}
                        onPress={() => handleApproveRequest(request.id)}
                        disabled={processRequests.has(request.id)}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.modalActionButtonText}>
                          {processRequests.has(request.id) ? 'Processing...' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalActionButton, styles.rejectButton]}
                        onPress={() => handleRejectRequest(request.id)}
                        disabled={processRequests.has(request.id)}
                      >
                        <Ionicons name="close" size={18} color="#FFF" />
                        <Text style={styles.modalActionButtonText}>
                          {processRequests.has(request.id) ? 'Processing...' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Manage hikes and monitor members</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => setNotificationModalVisible(true)} 
              style={styles.notificationButton}
            >
              <Ionicons name="notifications" size={20} color="#2C3E50" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('../drawer/home')} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
              <Text style={styles.headerButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
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
    </>
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
  // Notification styles
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#F5F2EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E07070',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5E6D3',
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DCC8',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C3E50',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  filterTabActive: {
    backgroundColor: '#D4A574',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B7355',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  requestCardPending: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212, 165, 116, 0.05)',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
  },
  requestEmail: {
    fontSize: 12,
    color: '#8B7355',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#FFF3CD',
  },
  statusApproved: {
    backgroundColor: '#D4EDDA',
  },
  statusRejected: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  requestDate: {
    fontSize: 12,
    color: '#8B7355',
    marginBottom: 12,
  },
  respondedDate: {
    fontSize: 12,
    color: '#6FAF8A',
    marginBottom: 12,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 6,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#6FAF8A',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#E07070',
  },
});