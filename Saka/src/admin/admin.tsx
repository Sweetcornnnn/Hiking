import { useEffect, useState, useRef } from 'react';
import {
  FlatList, View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView, TextInput, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useHikesStore } from '../store/hikesStore';
import { useNotificationStore } from '../store/notificationStore';
import UserLocationModal from './UserLocationModal';

// ---------- User Store (local, using authToken) ----------
interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
}

export default function AdminRoute() {
  const router = useRouter();
  const { user, authToken, signOut } = useAuthStore();
  const { allHikes, adminStats, fetchAllHikes, fetchAdminStats, isLoading: hikesLoading } = useHikesStore();
  const {
    passwordChangeRequests,
    unreadCount,
    fetchPasswordChangeRequests,
    approvePasswordChange,
    rejectPasswordChange,
  } = useNotificationStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'hikes' | 'users'>('hikes');

  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Password request modal state
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [processRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // User location modal state
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalUser, setLocationModalUser] = useState<AdminUser | null>(null);

  // ---------- Fetch users ----------
  const fetchUsers = async () => {
    if (!authToken) return;
    setUsersLoading(true);
    try {
      const res = await fetch('http://10.236.247.102:3000/api/admin/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        Alert.alert('Error', data.error || 'Failed to fetch users');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error fetching users');
    } finally {
      setUsersLoading(false);
    }
  };

  // ---------- Update user (admin toggle) ----------
  const updateUserAdmin = async (userId: number, isAdmin: boolean) => {
    if (!authToken) return;
    try {
      const res = await fetch(`http://10.236.247.102:3000/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ is_admin: isAdmin }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', `User admin status updated`);
        fetchUsers();
      } else {
        Alert.alert('Error', data.error || 'Failed to update user');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  // ---------- Reset password (creates pending request) ----------
  const resetUserPassword = async (userId: number, password: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`http://10.236.247.102:3000/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Password reset request created. The user will need to approve it.');
      } else {
        Alert.alert('Error', data.error || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  // ---------- Delete user ----------
  const deleteUser = async (userId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch(`http://10.236.247.102:3000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'User deleted');
        fetchUsers();
      } else {
        Alert.alert('Error', data.error || 'Failed to delete user');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  // ---------- Initial data fetching ----------
  useEffect(() => {
    if (!user?.is_admin) {
      router.replace('/drawer/home');
      return;
    }
    fetchAllHikes();
    fetchAdminStats();
    if (authToken) {
      fetchPasswordChangeRequests(authToken);
      fetchUsers();
    }
  }, [user?.is_admin, authToken]);

  // Password request handlers
  const filteredRequests = passwordChangeRequests.filter(req =>
    filterStatus === 'all' ? true : req.status === filterStatus
  );

  const statusStyleMap = {
    pending: styles.statusPending,
    approved: styles.statusApproved,
    rejected: styles.statusRejected,
  } as const;

  const statusTextMap = {
    pending: styles.statusText,
    approved: styles.statusTextApproved,
    rejected: styles.statusTextRejected,
  } as const;

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    const { error } = await approvePasswordChange(requestId, authToken || '');
    setProcessingRequests(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    if (error) Alert.alert('Error', error);
    else Alert.alert('Success', 'Password change approved');
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    const { error } = await rejectPasswordChange(requestId, authToken || '');
    setProcessingRequests(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    if (error) Alert.alert('Error', error);
    else Alert.alert('Success', 'Password change rejected');
  };

  // ── Themed logout confirm toast ─────────────────────────────────────────
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutToastOpacity = useRef(new Animated.Value(0)).current;
  const logoutToastY = useRef(new Animated.Value(-6)).current;

  const openLogoutConfirm = () => {
    setShowLogoutConfirm(true);
    logoutToastOpacity.setValue(0);
    logoutToastY.setValue(-6);
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY,       { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const dismissLogoutConfirm = () => {
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY,       { toValue: -4, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setShowLogoutConfirm(false));
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
    router.replace('/login');
  };

  const confirmResetPassword = () => {
    if (!selectedUserId) return;
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    resetUserPassword(selectedUserId, newPassword);
    setResetModalVisible(false);
    setNewPassword('');
    setSelectedUserId(null);
  };

  // ---------- Render ----------
  return (
    <>
      {/* User Location Modal */}
      <UserLocationModal
        visible={locationModalVisible}
        user={locationModalUser}
        onClose={() => setLocationModalVisible(false)}
      />

      {/* Password Requests Modal */}
      <Modal
        transparent
        visible={notificationModalVisible}
        animationType="fade"
        onRequestClose={() => setNotificationModalVisible(false)}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Password Requests</Text>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={13} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

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

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {filteredRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle" size={36} color="#6FAF8A" />
                  <Text style={styles.emptyStateText}>
                    {filterStatus === 'pending' ? 'No pending requests' : `No ${filterStatus} requests`}
                  </Text>
                </View>
              ) : (
                filteredRequests.map((request) => (
                  <View key={request.id} style={[styles.requestCard, request.status === 'pending' && styles.requestCardPending]}>
                    <View style={styles.requestHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestName} numberOfLines={1}>{request.userName}</Text>
                        <Text style={styles.requestEmail} numberOfLines={1}>{request.userEmail}</Text>
                      </View>
                      <View style={[styles.statusBadge, statusStyleMap[request.status]]}>
                        <Text style={statusTextMap[request.status]}>{request.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.requestDate}>
                      {new Date(request.requestedAt).toLocaleString()}
                    </Text>
                    {request.respondedAt && (
                      <Text style={styles.respondedDate}>
                        ✓ {request.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(request.respondedAt).toLocaleString()}
                      </Text>
                    )}
                    {request.status === 'pending' && (
                      <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveButton]}
                          onPress={() => handleApproveRequest(request.id)}
                          disabled={processRequests.has(request.id)}
                        >
                          <Ionicons name="checkmark" size={13} color="#6FAF8A" />
                          <Text style={styles.approveBtnText}>
                            {processRequests.has(request.id) ? 'Processing...' : 'Approve'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectButton]}
                          onPress={() => handleRejectRequest(request.id)}
                          disabled={processRequests.has(request.id)}
                        >
                          <Ionicons name="close" size={13} color="#E07070" />
                          <Text style={styles.rejectBtnText}>
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
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal visible={resetModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password (min. 6 characters)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmResetPassword}>
                <Text style={styles.confirmText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Admin Panel */}
      <View style={styles.screen}>
        <View style={styles.card}>
          {/* Left Panel */}
          <View style={styles.leftPanel}>
            <Text style={styles.title}>Admin</Text>
            <Text style={styles.subtitle}>Dashboard</Text>
            <View style={styles.dividerH} />

            <View style={styles.statItem}>
              <Text style={styles.statNum}>{adminStats?.total_hikes || 0}</Text>
              <Text style={styles.statLbl}>hikes</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{adminStats?.total_users || 0}</Text>
              <Text style={styles.statLbl}>users</Text>
            </View>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.notifBtn} onPress={() => setNotificationModalVisible(true)}>
              <Ionicons name="notifications-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.notifBtnText}>Requests</Text>
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshBtn} onPress={fetchAllHikes}>
              <Ionicons name="refresh" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={openLogoutConfirm}>
              <Ionicons name="log-out-outline" size={13} color="#E07070" />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerV} />

          {/* Right Panel with Tabs */}
          <View style={styles.rightPanel}>
            <View style={styles.listHeader}>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'hikes' && styles.activeTab]}
                  onPress={() => setActiveTab('hikes')}
                >
                  <Text style={[styles.tabText, activeTab === 'hikes' && styles.activeTabText]}>Hikes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'users' && styles.activeTab]}
                  onPress={() => setActiveTab('users')}
                >
                  <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
                </TouchableOpacity>
              </View>
            </View>

            {activeTab === 'hikes' && (
              hikesLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Loading hikes...</Text>
                </View>
              ) : allHikes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No hikes yet.</Text>
                </View>
              ) : (
                <FlatList
                  data={allHikes}
                  keyExtractor={(h) => h.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item: hike, index }) => (
                    <View style={[styles.hikeRow, index === allHikes.length - 1 && styles.hikeRowLast]}>
                      <View style={styles.hikeDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hikeName} numberOfLines={1}>
                          {hike.user?.name || hike.user?.email || 'Unknown'}
                        </Text>
                        <Text style={styles.hikeSub} numberOfLines={1}>
                          {hike.start_time} → {hike.end_time}  ·  {hike.tagalongs} along
                        </Text>
                      </View>
                      <Text style={styles.hikeMeta}>
                        {new Date(hike.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  )}
                />
              )
            )}

            {activeTab === 'users' && (
              usersLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Loading users...</Text>
                </View>
              ) : users.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No users found.</Text>
                </View>
              ) : (
                <FlatList
                  data={users}
                  keyExtractor={(u) => u.id.toString()}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item: u }) => (
                    <View style={styles.userRow}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{u.name || 'No name'}</Text>
                        <Text style={styles.userEmail}>{u.email}</Text>
                        <Text style={styles.userMeta}>
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.userActions}>
                        {/* Location button */}
                        <TouchableOpacity
                          onPress={() => {
                            setLocationModalUser(u);
                            setLocationModalVisible(true);
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons name="location-outline" size={16} color="#C9A96E" />
                        </TouchableOpacity>

                        {/* Admin toggle button */}
                        <TouchableOpacity
                          onPress={() => {
                            if (u.id === user?.id) {
                              Alert.alert('Not allowed', 'You cannot change your own admin status.');
                              return;
                            }
                            Alert.alert(
                              u.is_admin ? 'Remove admin rights?' : 'Make admin?',
                              `${u.name || u.email} will ${u.is_admin ? 'lose' : 'gain'} admin privileges.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Confirm', onPress: () => updateUserAdmin(u.id, !u.is_admin) },
                              ]
                            );
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons
                            name={u.is_admin ? 'shield-checkmark' : 'shield-outline'}
                            size={16}
                            color={u.is_admin ? '#C9A96E' : 'rgba(255,255,255,0.5)'}
                          />
                        </TouchableOpacity>

                        {/* Reset password button */}
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedUserId(u.id);
                            setNewPassword('');
                            setResetModalVisible(true);
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons name="key-outline" size={16} color="#6FAF8A" />
                        </TouchableOpacity>

                        {/* Delete button */}
                        <TouchableOpacity
                          onPress={() => {
                            if (u.id === user?.id) {
                              Alert.alert('Not allowed', 'You cannot delete your own account from here.');
                              return;
                            }
                            Alert.alert(
                              'Delete User',
                              `Delete ${u.name || u.email}? This will remove all their hikes and requests.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteUser(u.id) },
                              ]
                            );
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons name="trash-outline" size={16} color="#E07070" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )
            )}
          </View>
        </View>
      </View>

      {/* ── Logout confirm toast ── */}
      {showLogoutConfirm && (
        <Animated.View style={[styles.logoutToast, { opacity: logoutToastOpacity, transform: [{ translateY: logoutToastY }] }]}>
          <View style={styles.logoutToastBar} />
          <View style={styles.logoutToastInner}>
            <Text style={styles.logoutToastTitle}>Sign out?</Text>
            <Text style={styles.logoutToastMsg}>You'll be logged out of the admin panel.</Text>
            <View style={styles.logoutToastActions}>
              <TouchableOpacity style={styles.logoutToastCancel} onPress={dismissLogoutConfirm}>
                <Text style={styles.logoutToastCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutToastConfirm} onPress={confirmLogout}>
                <Ionicons name="log-out-outline" size={11} color="#0E1520" />
                <Text style={styles.logoutToastConfirmText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1520',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 640,
    flex: 1,
    maxHeight: 560,
    backgroundColor: '#0E1520',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  leftPanel: {
    width: 150,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'flex-start',
    backgroundColor: '#111927',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    marginBottom: 12,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  statLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
    justifyContent: 'center',
  },
  notifBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  notifBadge: {
    backgroundColor: '#E07070',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
    justifyContent: 'center',
  },
  refreshBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(224,112,112,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#E07070',
    fontSize: 11,
    fontWeight: '600',
  },
  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  rightPanel: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 14,
  },
  listHeader: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  listTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 14,
  },
  hikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  hikeRowLast: {
    borderBottomWidth: 0,
  },
  hikeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C9A96E',
  },
  hikeName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  hikeSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 1,
  },
  hikeMeta: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: 560,
    backgroundColor: '#111927',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterTabActive: {
    backgroundColor: '#C9A96E',
    borderColor: '#C9A96E',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterTabTextActive: {
    color: '#0E1520',
  },
  modalScroll: {
    padding: 14,
  },
  requestCard: {
    backgroundColor: '#0E1520',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  requestCardPending: {
    borderColor: 'rgba(201,169,110,0.3)',
    backgroundColor: 'rgba(201,169,110,0.04)',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  requestName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestEmail: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: 'rgba(201,169,110,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
  },
  statusApproved: {
    backgroundColor: 'rgba(111,175,138,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(111,175,138,0.3)',
  },
  statusRejected: {
    backgroundColor: 'rgba(224,112,112,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.3)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#C9A96E',
  },
  statusTextApproved: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#6FAF8A',
  },
  statusTextRejected: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#E07070',
  },
  requestDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  respondedDate: {
    fontSize: 10,
    color: '#6FAF8A',
    marginBottom: 6,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  approveButton: {
    backgroundColor: 'rgba(111,175,138,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(111,175,138,0.3)',
  },
  rejectButton: {
    backgroundColor: 'rgba(224,112,112,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.3)',
  },
  approveBtnText: {
    color: '#6FAF8A',
    fontWeight: '600',
    fontSize: 11,
  },
  rejectBtnText: {
    color: '#E07070',
    fontWeight: '600',
    fontSize: 11,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  tab: {
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#C9A96E',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#C9A96E',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  userMeta: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 12,
  },
  actionIcon: {
    padding: 4,
  },
  input: {
    backgroundColor: '#0E1520',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  confirmText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  logoutToast: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    marginLeft: -140,
    width: 280,
    flexDirection: 'row',
    backgroundColor: '#141E2D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
    overflow: 'hidden',
    zIndex: 100,
    elevation: 10,
  },
  logoutToastBar: {
    width: 3,
    backgroundColor: '#BF6A6A',
    alignSelf: 'stretch',
  },
  logoutToastInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  logoutToastTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  logoutToastMsg: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    lineHeight: 13,
    marginBottom: 8,
  },
  logoutToastActions: {
    flexDirection: 'row',
    gap: 6,
  },
  logoutToastCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoutToastCancelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
  },
  logoutToastConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#BF6A6A',
  },
  logoutToastConfirmText: {
    color: '#0E1520',
    fontSize: 10,
    fontWeight: '700',
  },
});