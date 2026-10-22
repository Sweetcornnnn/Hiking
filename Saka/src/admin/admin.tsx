// Admin.tsx — restyled to match ChatScreen (CHAT_* tokens, hairline shell,
// matching header + empty states). Data layer unchanged from the previous rewrite.
import { useEffect, useState, useRef, useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useHikesStore } from '../store/hikesStore';
import { useHikeSafetyStore } from '../store/hikeSafetyStore';
import { supabase } from '../lib/supabase';
import { organizationService } from '../services/organizationService';
import type { AdminSafetyRow } from '../services/hikeSafetyService';
import { hikeSafetyService } from '../services/hikeSafetyService';
import {
  adminService,
  type AdminUserRow,
  type AdminOrgRow,
  type AdminEventRow,
  type AdminJournalRow,
  type AdminSosRow,
  type AdminDiscoveryRow,
  type GlobalStats,
} from '../services/AdminService';
import { formatRangeShort } from '../utils/dateRange';
import UserLocationModal from './UserLocationModal';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../theme/designTokens';

// Local aliases so the JSX reads like ChatScreen
const SIDEBAR_W = 196;
const PANEL_W = 264;

type Tab =
  | 'overview'
  | 'hikes'
  | 'users'
  | 'orgs'
  | 'events'
  | 'safety'
  | 'emergencies'
  | 'moderation';

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'hikes', label: 'Hikes', icon: 'trail-sign-outline' },
  { id: 'users', label: 'Users', icon: 'people-outline' },
  { id: 'orgs', label: 'Organizations', icon: 'business-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline' },
  { id: 'emergencies', label: 'Emergencies', icon: 'alert-circle-outline' },
  { id: 'moderation', label: 'Moderation', icon: 'eye-outline' },
];

export default function AdminRoute() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { user, profile, signOut } = useAuthStore();
  const { allHikes, fetchAllHikes, isLoading: hikesLoading } = useHikesStore();
  const {
    adminHikes,
    adminEvents,
    adminLoading,
    adminError,
    loadAdminSafety,
    markAdminAlertSeen,
  } = useHikeSafetyStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data (same as previous Admin)
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'hiker' | 'organization' | 'admin'>('all');

  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgFilter, setOrgFilter] = useState<'pending' | 'verified' | 'all'>('pending');
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  const [modEvents, setModEvents] = useState<AdminEventRow[]>([]);
  const [modEventsLoading, setModEventsLoading] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<'all' | 'published' | 'draft' | 'cancelled' | 'completed'>('published');

  const [safetyFilter, setSafetyFilter] = useState<'all' | 'active' | 'needs_duration' | 'responded'>('all');

  const [sosRows, setSosRows] = useState<AdminSosRow[]>([]);
  const [sosLoading, setSosLoading] = useState(false);

  const [journal, setJournal] = useState<AdminJournalRow[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalPublicOnly, setJournalPublicOnly] = useState(true);
  const [discoveries, setDiscoveries] = useState<AdminDiscoveryRow[]>([]);
  const [discoveriesLoading, setDiscoveriesLoading] = useState(false);
  const [moderationTab, setModerationTab] = useState<'journal' | 'discoveries'>('journal');

  const [hikeSearch, setHikeSearch] = useState('');

  // Modals
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalUser, setLocationModalUser] = useState<AdminUserRow | null>(null);
  const [makeAdminModalVisible, setMakeAdminModalVisible] = useState(false);
  const [makeAdminTarget, setMakeAdminTarget] = useState<AdminUserRow | null>(null);
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserRow | null>(null);
  const [deleteJournalModalVisible, setDeleteJournalModalVisible] = useState(false);
  const [deleteJournalTarget, setDeleteJournalTarget] = useState<AdminJournalRow | null>(null);
  const [attendeesModalVisible, setAttendeesModalVisible] = useState(false);
  const [attendeesModalEvent, setAttendeesModalEvent] = useState<AdminEventRow | null>(null);
  const [attendeesList, setAttendeesList] = useState<any[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [durationModalVisible, setDurationModalVisible] = useState(false);
  const [durationTarget, setDurationTarget] = useState<AdminSafetyRow | null>(null);
  const [durationValue, setDurationValue] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; title: string; msg: string } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(8)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (type: 'success' | 'error' | 'warning', title: string, msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, title, msg });
    toastOpacity.setValue(0);
    toastY.setValue(8);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(toastY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(toastY, { toValue: 8, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 2800);
  };

  // Logout confirm (same as before)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutToastOpacity = useRef(new Animated.Value(0)).current;
  const logoutToastY = useRef(new Animated.Value(-6)).current;
  const openLogoutConfirm = () => {
    setShowLogoutConfirm(true);
    logoutToastOpacity.setValue(0);
    logoutToastY.setValue(-6);
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };
  const dismissLogoutConfirm = () => {
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY, { toValue: -4, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setShowLogoutConfirm(false));
  };
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
    router.replace('/Login');
  };

  // Fetchers
  const fetchStats = async () => { setStatsLoading(true); try { setStats(await adminService.fetchGlobalStats()); } finally { setStatsLoading(false); } };
  const fetchUsers = async () => { setUsersLoading(true); try { setUsers(await adminService.fetchAdminUsers()); } finally { setUsersLoading(false); } };
  const fetchOrgs = async () => { setOrgsLoading(true); try { setOrgs(await adminService.fetchAdminOrgs()); } finally { setOrgsLoading(false); } };
  const fetchModEvents = async () => { setModEventsLoading(true); try { setModEvents(await adminService.fetchAdminEvents()); } finally { setModEventsLoading(false); } };
  const fetchSos = async () => { setSosLoading(true); try { setSosRows(await adminService.fetchAdminSos()); } finally { setSosLoading(false); } };
  const fetchJournal = async () => { setJournalLoading(true); try { setJournal(await adminService.fetchAdminJournal(journalPublicOnly)); } finally { setJournalLoading(false); } };
  const fetchDiscoveries = async () => { setDiscoveriesLoading(true); try { setDiscoveries(await adminService.fetchAdminDiscoveries()); } finally { setDiscoveriesLoading(false); } };

  useEffect(() => {
    if (!profile?.is_admin) { router.replace('/Home'); return; }
    fetchStats();
    fetchAllHikes();
  }, [profile?.is_admin]);

  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'orgs') fetchOrgs();
    else if (activeTab === 'events') fetchModEvents();
    else if (activeTab === 'safety') loadAdminSafety();
    else if (activeTab === 'emergencies') fetchSos();
    else if (activeTab === 'moderation') { if (moderationTab === 'journal') fetchJournal(); else fetchDiscoveries(); }
  }, [activeTab, moderationTab, journalPublicOnly]);

  const refreshCurrentTab = () => {
    if (activeTab === 'overview') fetchStats();
    else if (activeTab === 'hikes') fetchAllHikes();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'orgs') fetchOrgs();
    else if (activeTab === 'events') fetchModEvents();
    else if (activeTab === 'safety') loadAdminSafety();
    else if (activeTab === 'emergencies') fetchSos();
    else if (activeTab === 'moderation') { if (moderationTab === 'journal') fetchJournal(); else fetchDiscoveries(); }
  };

  // Actions (same as previous Admin)
  const updateUserAdmin = async (userId: string, isAdmin: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_admin: isAdmin, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) { showToast('error', 'Update Failed', error.message); return; }
    showToast('success', 'Admin Updated', `Privileges have been ${isAdmin ? 'granted' : 'removed'}.`);
    fetchUsers();
  };
  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) { showToast('error', 'Delete Failed', error.message); return; }
    showToast('success', 'User Deleted', 'The profile has been removed.');
    fetchUsers();
  };
  const handleVerifyOrg = async (org: AdminOrgRow, verified: boolean) => {
    setBusyOrgId(org.id);
    const { error } = await organizationService.adminSetVerified(org.id, verified);
    setBusyOrgId(null);
    if (error) { showToast('error', 'Update Failed', error); return; }
    showToast('success', verified ? 'Organization Verified' : 'Verification Removed', `${org.name} has been ${verified ? 'verified' : 'unverified'}.`);
    fetchOrgs(); fetchStats();
  };
  const handleAdminCancelEvent = (eventId: string) => {
    const ev = modEvents.find((e) => e.id === eventId);
    if (!ev) return;
    Alert.alert('Force-cancel event?', `"${ev.title}" will be marked cancelled and hidden from public discovery.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: async () => {
        setBusyEventId(eventId);
        const { error } = await organizationService.adminCancelEvent(eventId);
        setBusyEventId(null);
        if (error) { showToast('error', 'Update Failed', error); return; }
        showToast('success', 'Event Cancelled', 'The organizer has been notified by the status change.');
        fetchModEvents(); fetchStats();
      }},
    ]);
  };
  const handleAdminReinstateEvent = async (eventId: string) => {
    setBusyEventId(eventId);
    const { error } = await organizationService.adminReinstateEvent(eventId);
    setBusyEventId(null);
    if (error) { showToast('error', 'Reinstate Failed', error); return; }
    showToast('success', 'Event Reinstated', 'The event is visible again.');
    fetchModEvents(); fetchStats();
  };
  const openAttendees = async (event: AdminEventRow) => {
    setAttendeesModalEvent(event); setAttendeesModalVisible(true); setAttendeesLoading(true);
    try { setAttendeesList(await organizationService.getEventAttendees(event.id)); } finally { setAttendeesLoading(false); }
  };
  const openDurationModal = (row: AdminSafetyRow) => {
    setDurationTarget(row);
    setDurationValue(row.event_duration_hours ? String(row.event_duration_hours) : '');
    setDurationModalVisible(true);
  };
  const submitDuration = async () => {
    if (!durationTarget?.event_id) return;
    const hrs = Number(durationValue);
    if (!Number.isFinite(hrs) || hrs <= 0) { showToast('warning', 'Invalid duration', 'Enter a positive number of hours.'); return; }
    const { error } = await hikeSafetyService.setEventDuration({ eventId: durationTarget.event_id, durationHours: hrs });
    if (error) { showToast('error', 'Update Failed', error); return; }
    setDurationModalVisible(false); setDurationTarget(null);
    showToast('success', 'Duration set', 'The safety check has been re-planned.');
    loadAdminSafety();
  };
  const confirmDeleteJournal = (entry: AdminJournalRow) => { setDeleteJournalTarget(entry); setDeleteJournalModalVisible(true); };
  const submitDeleteJournal = async () => {
    if (!deleteJournalTarget) return;
    const { error } = await adminService.deleteAdminJournal(deleteJournalTarget.id);
    setDeleteJournalModalVisible(false); setDeleteJournalTarget(null);
    if (error) { showToast('error', 'Delete Failed', error); return; }
    showToast('success', 'Journal Deleted', 'The entry and its photos were removed.');
    fetchJournal();
  };

  // Derived
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userRoleFilter !== 'all') { const role = u.role ?? (u.is_admin ? 'admin' : 'hiker'); if (role !== userRoleFilter) return false; }
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q);
    });
  }, [users, userSearch, userRoleFilter]);
  const filteredOrgs = useMemo(() => orgs.filter((o) => orgFilter === 'all' ? true : orgFilter === 'verified' ? o.is_verified : !o.is_verified), [orgs, orgFilter]);
  const filteredModEvents = useMemo(() => modEvents.filter((e) => eventFilter === 'all' ? true : e.status === eventFilter), [modEvents, eventFilter]);
  const filteredHikes = useMemo(() => {
    const q = hikeSearch.trim().toLowerCase();
    if (!q) return allHikes;
    return allHikes.filter((h) => (h.user?.name ?? '').toLowerCase().includes(q) || (h.user?.email ?? '').toLowerCase().includes(q) || (h.mountain_name ?? '').toLowerCase().includes(q));
  }, [allHikes, hikeSearch]);
  const matchesSafetyFilter = (row: AdminSafetyRow) => {
    const active = !!row.active_alert_id && !row.seen;
    if (safetyFilter === 'active') return active;
    if (safetyFilter === 'needs_duration') return !!row.needs_duration;
    if (safetyFilter === 'responded') return row.response_status !== 'pending';
    return true;
  };
  const activeAlertCount = [...adminHikes, ...adminEvents].filter((r) => !!r.active_alert_id && !r.seen).length;
  const pendingOrgCount = stats?.pendingOrgs ?? orgs.filter((o) => !o.is_verified).length;

  // ── Small building blocks (ChatScreen-flavored) ──
  const renderTabIcon = (t: typeof TABS[number]) => {
    const isActive = activeTab === t.id;
    let badge = 0;
    if (t.id === 'orgs') badge = pendingOrgCount;
    if (t.id === 'safety') badge = activeAlertCount;
    if (t.id === 'emergencies') badge = stats?.sosCount ?? 0;
    return (
      <TouchableOpacity
        key={t.id}
        onPress={() => setActiveTab(t.id)}
        activeOpacity={0.75}
        style={[ss.railItem, isActive && ss.railItemActive]}
      >
        <Ionicons name={t.icon} size={16} color={isActive ? ACCENT_GOLD : TEXT_MUTED} />
        <Text style={[ss.railLabel, isActive && ss.railLabelActive]} numberOfLines={1}>{t.label}</Text>
        {badge > 0 && (
          <View style={ss.railBadge}>
            <Text style={ss.railBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string) => (
    <View style={ss.emptyState}>
      <View style={ss.emptyIconWrap}>
        <Ionicons name={icon} size={44} color={ACCENT_GOLD} />
      </View>
      <Text style={ss.emptyTitle}>{title}</Text>
      <Text style={ss.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderStat = (label: string, value: number | string, accent?: string) => (
    <View style={ss.statCard} key={label}>
      <Text style={ss.statCardLabel} numberOfLines={1}>{label}</Text>
      <Text style={[ss.statCardValue, accent ? { color: accent } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );

  const renderHeader = (title: string, subtitle?: string, right?: React.ReactNode) => (
    <View style={ss.panelHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ss.panelTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={ss.panelSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );

  const renderSearch = (value: string, onChangeText: (v: string) => void, placeholder: string) => (
    <View style={ss.searchRow}>
      <View style={ss.searchBox}>
        <Ionicons name="search-outline" size={13} color="rgba(255,255,255,0.32)" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={ss.searchInput}
        />
      </View>
    </View>
  );

  const renderFilterChips = <T extends string>(
    items: ReadonlyArray<{ id: T; label: string }>,
    current: T,
    onChange: (id: T) => void,
  ) => (
    <View style={ss.chipRow}>
      {items.map((f) => (
        <TouchableOpacity
          key={f.id}
          onPress={() => onChange(f.id)}
          activeOpacity={0.75}
          style={[ss.chip, current === f.id && ss.chipActive]}
        >
          <Text style={[ss.chipText, current === f.id && ss.chipTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Modals (same look as before, ChatScreen-tinted) ──
  const renderModalShell = (visible: boolean, onClose: () => void, title: string, icon: keyof typeof Ionicons.glyphMap, children: React.ReactNode, footer?: React.ReactNode) => (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
      <View style={ss.modalOverlay}>
        <View style={ss.modalCard}>
          <View style={ss.modalHeader}>
            <View style={ss.modalTitleRow}>
              <View style={ss.modalIconWrap}>
                <Ionicons name={icon} size={13} color={ACCENT_GOLD} />
              </View>
              <Text style={ss.modalTitle} numberOfLines={1}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={ss.modalClose}>
              <Ionicons name="close" size={13} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
          <View style={ss.modalBody}>{children}</View>
          {footer ? <View style={ss.modalFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );

  const renderModalAction = (label: string, onPress: () => void, variant: 'ghost' | 'primary' | 'danger' = 'ghost', icon?: keyof typeof Ionicons.glyphMap) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        ss.modalActionBtn,
        variant === 'primary' && ss.modalActionPrimary,
        variant === 'danger' && ss.modalActionDanger,
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={variant === 'primary' ? CHAT_BG : variant === 'danger' ? '#fff' : TEXT_MUTED} /> : null}
      <Text style={[
        ss.modalActionText,
        variant === 'primary' && { color: CHAT_BG, fontWeight: '800' },
        variant === 'danger' && { color: '#fff' },
      ]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <UserLocationModal
        visible={locationModalVisible}
        user={locationModalUser ? { id: locationModalUser.id, name: locationModalUser.name, email: locationModalUser.email } : null}
        onClose={() => setLocationModalVisible(false)}
      />

      {/* Make / remove admin */}
      {renderModalShell(
        makeAdminModalVisible,
        () => setMakeAdminModalVisible(false),
        makeAdminTarget?.is_admin ? 'Remove admin rights' : 'Grant admin rights',
        makeAdminTarget?.is_admin ? 'shield-outline' : 'shield-checkmark',
        <>
          <View style={ss.userPill}>
            <View style={ss.userPillAvatar}>
              <Text style={ss.userPillAvatarText}>{(makeAdminTarget?.name || makeAdminTarget?.email || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.userPillName} numberOfLines={1}>{makeAdminTarget?.name || 'No name'}</Text>
              <Text style={ss.userPillEmail} numberOfLines={1}>{makeAdminTarget?.email}</Text>
            </View>
          </View>
          <Text style={ss.modalDesc}>
            {makeAdminTarget?.is_admin
              ? 'This user will lose all admin privileges and access to the admin panel.'
              : 'This user will gain full admin privileges and access to the admin panel.'}
          </Text>
        </>,
        <>
          {renderModalAction('Cancel', () => setMakeAdminModalVisible(false))}
          {renderModalAction(makeAdminTarget?.is_admin ? 'Remove Admin' : 'Make Admin', () => {
            if (makeAdminTarget) updateUserAdmin(makeAdminTarget.id, !makeAdminTarget.is_admin);
            setMakeAdminModalVisible(false); setMakeAdminTarget(null);
          }, 'primary', 'shield-checkmark')}
        </>
      )}

      {/* Delete user */}
      {renderModalShell(
        deleteUserModalVisible,
        () => setDeleteUserModalVisible(false),
        'Delete user',
        'trash',
        <>
          <View style={ss.userPill}>
            <View style={[ss.userPillAvatar, { backgroundColor: 'rgba(224,112,112,0.12)', borderColor: 'rgba(224,112,112,0.2)' }]}>
              <Text style={[ss.userPillAvatarText, { color: '#E07070' }]}>{(deleteUserTarget?.name || deleteUserTarget?.email || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.userPillName} numberOfLines={1}>{deleteUserTarget?.name || 'No name'}</Text>
              <Text style={ss.userPillEmail} numberOfLines={1}>{deleteUserTarget?.email}</Text>
            </View>
          </View>
          <Text style={ss.modalDesc}>This will permanently delete the user and all their hikes, requests, and data. This action cannot be undone.</Text>
        </>,
        <>
          {renderModalAction('Cancel', () => setDeleteUserModalVisible(false))}
          {renderModalAction('Delete User', () => {
            if (deleteUserTarget) deleteUser(deleteUserTarget.id);
            setDeleteUserModalVisible(false); setDeleteUserTarget(null);
          }, 'danger', 'trash-outline')}
        </>
      )}

      {/* Delete journal */}
      {renderModalShell(
        deleteJournalModalVisible,
        () => setDeleteJournalModalVisible(false),
        'Delete journal entry',
        'trash',
        <Text style={ss.modalDesc} numberOfLines={3}>“{deleteJournalTarget?.title || 'Untitled'}” by {deleteJournalTarget?.author_name || deleteJournalTarget?.author_email || 'unknown'} will be removed with its photos.</Text>,
        <>
          {renderModalAction('Cancel', () => setDeleteJournalModalVisible(false))}
          {renderModalAction('Delete', submitDeleteJournal, 'danger', 'trash-outline')}
        </>
      )}

      {/* Set duration */}
      {renderModalShell(
        durationModalVisible,
        () => setDurationModalVisible(false),
        'Set event duration',
        'timer-outline',
        <>
          <Text style={ss.modalDesc} numberOfLines={2}>“{durationTarget?.title}” has no usable end time. Enter its duration in hours to re-plan the safety check.</Text>
          <View style={ss.inputWrapper}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={ss.inputField}
              value={durationValue}
              onChangeText={setDurationValue}
              keyboardType="numeric"
              placeholder="e.g. 6"
              placeholderTextColor="rgba(255,255,255,0.28)"
            />
          </View>
        </>,
        <>
          {renderModalAction('Cancel', () => setDurationModalVisible(false))}
          {renderModalAction('Save', submitDuration, 'primary', 'checkmark')}
        </>
      )}

      {/* Attendees */}
      <Modal visible={attendeesModalVisible} transparent animationType="fade" onRequestClose={() => setAttendeesModalVisible(false)}>
        <View style={ss.modalOverlay}>
          <View style={[ss.modalCard, { maxHeight: 460 }]}>
            <View style={ss.modalHeader}>
              <View style={ss.modalTitleRow}>
                <View style={ss.modalIconWrap}><Ionicons name="people-outline" size={13} color={ACCENT_GOLD} /></View>
                <Text style={ss.modalTitle} numberOfLines={1}>Attendees · {attendeesModalEvent?.title ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setAttendeesModalVisible(false)} style={ss.modalClose}>
                <Ionicons name="close" size={13} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
              {attendeesLoading ? <Text style={ss.emptyStateText}>Loading attendees…</Text>
                : attendeesList.length === 0 ? <Text style={ss.emptyStateText}>No RSVPs yet.</Text>
                : attendeesList.map((a) => (
                  <View key={a.rsvp_id} style={ss.attendeeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.rowTitle} numberOfLines={1}>{a.full_name || a.email || 'Unknown'}</Text>
                      <Text style={ss.rowSub} numberOfLines={1}>{a.email ?? '—'} · {a.contact_number ?? 'no phone'}</Text>
                    </View>
                    <View style={[ss.miniBadge, { borderColor: a.status === 'confirmed' ? 'rgba(111,175,138,0.35)' : 'rgba(201,169,110,0.35)' }]}>
                      <Text style={[ss.miniBadgeText, { color: a.status === 'confirmed' ? '#6FAF8A' : ACCENT_GOLD }]}>{a.status}</Text>
                    </View>
                    <Text style={ss.attendeeGuests}>{a.guest_count}×</Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MAIN SHELL — ChatScreen-style */}
      <SafeAreaView style={ss.screen} edges={['top', 'left', 'right']}>
        <View style={ss.shell}>
          {/* ── SIDEBAR (rail) ── */}
          <View style={ss.sidebar}>
            <View style={ss.sidebarHeader}>
              <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} hitSlop={8} activeOpacity={0.85}>
                <Ionicons name="arrow-back" size={16} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ss.sidebarTitle} numberOfLines={1}>Admin</Text>
                <View style={ss.statusRow}>
                  <View style={ss.statusDot} />
                  <Text style={ss.statusText}>Signed in</Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.railContent}>
              {TABS.map(renderTabIcon)}
            </ScrollView>

            <View style={ss.sidebarFooter}>
              <TouchableOpacity onPress={() => { refreshCurrentTab(); fetchStats(); }} activeOpacity={0.85} style={ss.footerBtn}>
                <Ionicons name="refresh" size={13} color={TEXT_MUTED} />
                <Text style={ss.footerBtnText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openLogoutConfirm} activeOpacity={0.85} style={[ss.footerBtn, ss.footerBtnDanger]}>
                <Ionicons name="log-out-outline" size={13} color="#E07070" />
                <Text style={[ss.footerBtnText, { color: '#E07070' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── MAIN PANEL ── */}
          <View style={ss.main}>
            {renderHeader(
              TABS.find((t) => t.id === activeTab)?.label ?? 'Admin',
              statsLoading && !stats ? 'Loading overview…' : 'Signed in as admin',
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={ss.headerPill}>
                  <Text style={ss.headerPillText}>{stats?.totalUsers ?? 0} users</Text>
                </View>
                <View style={[ss.headerPill, { borderColor: 'rgba(224,112,112,0.35)' }]}>
                  <Text style={[ss.headerPillText, { color: '#E07070' }]}>{stats?.activeAlerts ?? 0} alerts</Text>
                </View>
              </View>
            )}

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              statsLoading && !stats ? (
                <View style={ss.emptyState}>
                  <Ionicons name="hourglass-outline" size={20} color={TEXT_MUTED} />
                  <Text style={ss.emptySubtitle}>Loading overview…</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}>
                  <Text style={ss.sectionLabel}>SYSTEM TOTALS</Text>
                  <View style={ss.statGrid}>
                    {renderStat('Total hikes', stats?.totalHikes ?? 0)}
                    {renderStat('Total users', stats?.totalUsers ?? 0)}
                    {renderStat('Total orgs', stats?.totalOrgs ?? 0)}
                    {renderStat('Total events', stats?.totalEvents ?? 0)}
                  </View>
                  <Text style={ss.sectionLabel}>VERIFICATION</Text>
                  <View style={ss.statGrid}>
                    {renderStat('Verified orgs', stats?.verifiedOrgs ?? 0, '#6FAF8A')}
                    {renderStat('Pending orgs', stats?.pendingOrgs ?? 0, ACCENT_GOLD)}
                  </View>
                  <Text style={ss.sectionLabel}>EVENTS</Text>
                  <View style={ss.statGrid}>
                    {renderStat('Published', stats?.publishedEvents ?? 0, '#6FAF8A')}
                    {renderStat('Drafts', stats?.draftEvents ?? 0)}
                    {renderStat('Cancelled', stats?.cancelledEvents ?? 0, '#E07070')}
                    {renderStat('Upcoming', stats?.upcomingEvents ?? 0, '#6FAF8A')}
                  </View>
                  <Text style={ss.sectionLabel}>ATTENDANCE</Text>
                  <View style={ss.statGrid}>
                    {renderStat('Confirmed RSVPs', stats?.confirmedRsvps ?? 0, '#6FAF8A')}
                    {renderStat('Waitlist', stats?.waitlistRsvps ?? 0, ACCENT_GOLD)}
                  </View>
                  <Text style={ss.sectionLabel}>SAFETY</Text>
                  <View style={ss.statGrid}>
                    {renderStat('Pending checks', stats?.pendingSafetyChecks ?? 0)}
                    {renderStat('Active alerts', stats?.activeAlerts ?? 0, '#E07070')}
                    {renderStat('SOS (recent)', stats?.sosCount ?? 0, '#E07070')}
                  </View>
                </ScrollView>
              )
            )}

            {/* ── HIKES ── */}
            {activeTab === 'hikes' && (
              <>
                {renderSearch(hikeSearch, setHikeSearch, 'Search user or mountain')}
                {hikesLoading ? (
                  <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading hikes…</Text></View>
                ) : filteredHikes.length === 0 ? (
                  renderEmpty('trail-sign-outline', 'No hikes yet', 'Personal hikes will appear here once hikers schedule them.')
                ) : (
                  <FlatList
                    data={filteredHikes}
                    keyExtractor={(h) => h.id}
                    contentContainerStyle={ss.mainContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: hike, index }) => (
                      <View style={[ss.row, index === filteredHikes.length - 1 && ss.rowLast]}>
                        <View style={ss.rowDot} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={ss.rowTitle} numberOfLines={1}>{hike.user?.name || hike.user?.email || 'Unknown'}</Text>
                          <Text style={ss.rowSub} numberOfLines={1}>
                            {(hike.mountain_name || hike.mountain_id) ? `${hike.mountain_name || hike.mountain_id} · ` : ''}
                            {hike.start_time} → {hike.end_time} · {hike.tagalongs} along
                          </Text>
                          <Text style={ss.rowMeta} numberOfLines={1}>Contact: {hike.contact_number || 'N/A'} · Emergency: {hike.emergency_contact || 'N/A'}</Text>
                        </View>
                        <Text style={ss.rowMetaRight}>
                          {hike.end_date && hike.end_date !== hike.date
                            ? formatRangeShort(hike.date, hike.end_date)
                            : new Date(hike.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    )}
                  />
                )}
              </>
            )}

            {/* ── USERS ── */}
            {activeTab === 'users' && (
              <>
                {renderSearch(userSearch, setUserSearch, 'Search name, email, username')}
                {renderFilterChips(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'hiker', label: 'Hikers' },
                    { id: 'organization', label: 'Organizers' },
                    { id: 'admin', label: 'Admins' },
                  ] as const,
                  userRoleFilter,
                  setUserRoleFilter,
                )}
                {usersLoading ? (
                  <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading users…</Text></View>
                ) : filteredUsers.length === 0 ? (
                  renderEmpty('people-outline', 'No users match', 'Try a different search or role filter.')
                ) : (
                  <FlatList
                    data={filteredUsers}
                    keyExtractor={(u) => u.id}
                    contentContainerStyle={ss.mainContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: u }) => {
                      const role = u.role ?? (u.is_admin ? 'admin' : 'hiker');
                      const online = u.status === 'online';
                      return (
                        <View style={ss.userRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={ss.userNameRow}>
                              <View style={[ss.onlineDot, { backgroundColor: online ? CHAT_ONLINE : 'rgba(255,255,255,0.2)' }]} />
                              <Text style={ss.rowTitle} numberOfLines={1}>{u.name || 'No name'}</Text>
                              {u.is_admin && <Ionicons name="shield-checkmark" size={11} color={ACCENT_GOLD} style={{ marginLeft: 4 }} />}
                            </View>
                            <Text style={ss.rowSub} numberOfLines={1}>{u.email}{u.username ? ` · @${u.username}` : ''}</Text>
                            <Text style={ss.rowMeta} numberOfLines={1}>
                              {role}{u.organization_id ? ' · org' : ''}{u.is_verified ? ' · verified' : ''} · {u.contact_number || 'no phone'}
                            </Text>
                            <Text style={ss.rowMeta}>
                              Joined {new Date(u.created_at).toLocaleDateString()}{u.last_seen ? ` · seen ${new Date(u.last_seen).toLocaleDateString()}` : ''}
                            </Text>
                          </View>
                          <View style={ss.userActions}>
                            <TouchableOpacity onPress={() => { setLocationModalUser(u); setLocationModalVisible(true); }} style={ss.iconAction}>
                              <Ionicons name="location-outline" size={16} color={ACCENT_GOLD} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                if (u.id === user?.id) { showToast('warning', 'Not Allowed', 'You cannot change your own admin status.'); return; }
                                setMakeAdminTarget(u); setMakeAdminModalVisible(true);
                              }}
                              style={ss.iconAction}
                            >
                              <Ionicons name={u.is_admin ? 'shield-checkmark' : 'shield-outline'} size={16} color={u.is_admin ? ACCENT_GOLD : TEXT_MUTED} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                if (u.id === user?.id) { showToast('warning', 'Not Allowed', 'You cannot delete your own account from here.'); return; }
                                setDeleteUserTarget(u); setDeleteUserModalVisible(true);
                              }}
                              style={ss.iconAction}
                            >
                              <Ionicons name="trash-outline" size={16} color="#E07070" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </>
            )}

            {/* ── ORGS ── */}
            {activeTab === 'orgs' && (
              <>
                {renderFilterChips(
                  [
                    { id: 'pending', label: 'Pending' },
                    { id: 'verified', label: 'Verified' },
                    { id: 'all', label: 'All' },
                  ] as const,
                  orgFilter,
                  setOrgFilter,
                )}
                {orgsLoading ? (
                  <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading organizations…</Text></View>
                ) : filteredOrgs.length === 0 ? (
                  renderEmpty('business-outline', orgFilter === 'pending' ? 'No pending organizations' : `No ${orgFilter} organizations`, 'New organizations will show up here for verification.')
                ) : (
                  <FlatList
                    data={filteredOrgs}
                    keyExtractor={(o) => o.id}
                    contentContainerStyle={ss.mainContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: o }) => (
                      <View style={ss.card}>
                        <View style={ss.cardHeader}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={ss.rowTitle} numberOfLines={1}>{o.name}</Text>
                            <Text style={ss.rowSub} numberOfLines={1}>{o.contact_email || o.slug}{o.website ? ` · ${o.website}` : ''}</Text>
                          </View>
                          <View style={[ss.statusBadge, o.is_verified ? ss.statusApproved : ss.statusPending]}>
                            <Text style={o.is_verified ? ss.statusTextApproved : ss.statusText}>{o.is_verified ? 'verified' : 'pending'}</Text>
                          </View>
                        </View>
                        {o.description ? <Text style={ss.rowMeta} numberOfLines={2}>{o.description}</Text> : null}
                        <Text style={ss.rowMeta}>
                          Registered {new Date(o.created_at).toLocaleDateString()}{o.contact_phone ? ` · ${o.contact_phone}` : ''}
                        </Text>
                        <Text style={[ss.rowMeta, { color: ACCENT_GOLD, fontWeight: '600' }]}>
                          {o.member_count} member{o.member_count === 1 ? '' : 's'} · {o.event_count} event{o.event_count === 1 ? '' : 's'}
                        </Text>
                        <View style={ss.cardActions}>
                          {!o.is_verified ? (
                            <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => handleVerifyOrg(o, true)} disabled={busyOrgId === o.id}>
                              <Ionicons name="shield-checkmark" size={12} color="#6FAF8A" />
                              <Text style={ss.smallBtnSuccessText}>{busyOrgId === o.id ? 'Verifying…' : 'Verify'}</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => handleVerifyOrg(o, false)} disabled={busyOrgId === o.id}>
                              <Ionicons name="shield-outline" size={12} color="#E07070" />
                              <Text style={ss.smallBtnDangerText}>{busyOrgId === o.id ? 'Updating…' : 'Remove verification'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  />
                )}
              </>
            )}

            {/* ── EVENTS ── */}
            {activeTab === 'events' && (
              <>
                {renderFilterChips(
                  [
                    { id: 'published', label: 'Published' },
                    { id: 'draft', label: 'Drafts' },
                    { id: 'cancelled', label: 'Cancelled' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'all', label: 'All' },
                  ] as const,
                  eventFilter,
                  setEventFilter,
                )}
                {modEventsLoading ? (
                  <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading events…</Text></View>
                ) : filteredModEvents.length === 0 ? (
                  renderEmpty('calendar-outline', `No ${eventFilter} events`, 'Events will show up here once organizers post them.')
                ) : (
                  <FlatList
                    data={filteredModEvents}
                    keyExtractor={(e) => e.id}
                    contentContainerStyle={ss.mainContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item: e }) => {
                      const hasCap = e.capacity !== null && e.capacity !== undefined;
                      const pct = hasCap && (e.capacity as number) > 0 ? Math.min(100, (e.rsvp_confirmed / (e.capacity as number)) * 100) : 0;
                      return (
                        <View style={ss.card}>
                          <View style={ss.cardHeader}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={ss.rowTitle} numberOfLines={1}>{e.title}</Text>
                              <Text style={ss.rowSub} numberOfLines={1}>
                                {e.organization_name ?? 'Unknown org'}
                                {e.organization_verified ? ' · verified' : ''} · {e.end_date && e.end_date !== e.event_date ? `${e.event_date} – ${e.end_date}` : e.event_date}
                              </Text>
                            </View>
                            <View style={[
                              ss.statusBadge,
                              e.status === 'published' ? ss.statusApproved : e.status === 'cancelled' ? ss.statusRejected : ss.statusPending,
                            ]}>
                              <Text style={
                                e.status === 'published' ? ss.statusTextApproved : e.status === 'cancelled' ? ss.statusTextRejected : ss.statusText
                              }>{e.status}</Text>
                            </View>
                          </View>
                          <Text style={ss.rowMeta} numberOfLines={2}>
                            {e.difficulty} · {e.start_time}{e.end_time ? ` – ${e.end_time}` : e.duration_hours ? ` · ${e.duration_hours}h` : ''} · {e.meeting_point}
                          </Text>
                          <Text style={ss.rowMeta} numberOfLines={1}>
                            {e.is_public ? 'Public' : 'Private'} · {e.allow_walkins ? 'Walk-ins allowed' : 'No walk-ins'} · capacity {e.capacity ?? '∞'}
                          </Text>

                          <View style={ss.attendRow}>
                            <Text style={ss.attendLabel}>Attending</Text>
                            <Text style={ss.attendValue}>
                              {e.rsvp_confirmed}{hasCap ? <Text style={ss.attendSub}>{` / ${e.capacity}`}</Text> : null}
                            </Text>
                          </View>
                          {hasCap && (
                            <View style={ss.meter}>
                              <View style={[ss.meterFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#E67E22' : '#6FAF8A' }]} />
                            </View>
                          )}
                          {e.rsvp_waitlist > 0 && <Text style={ss.waitlistText}>{e.rsvp_waitlist} on the waitlist</Text>}

                          <View style={ss.cardActions}>
                            {(e.status === 'published' || e.status === 'draft') && (
                              <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => handleAdminCancelEvent(e.id)} disabled={busyEventId === e.id}>
                                <Ionicons name="close-circle-outline" size={12} color="#E07070" />
                                <Text style={ss.smallBtnDangerText}>{busyEventId === e.id ? 'Cancelling…' : 'Force-cancel'}</Text>
                              </TouchableOpacity>
                            )}
                            {e.status === 'cancelled' && (
                              <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => handleAdminReinstateEvent(e.id)} disabled={busyEventId === e.id}>
                                <Ionicons name="refresh" size={12} color="#6FAF8A" />
                                <Text style={ss.smallBtnSuccessText}>{busyEventId === e.id ? 'Reinstating…' : 'Reinstate'}</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[ss.smallBtn, ss.smallBtnGold]} onPress={() => openAttendees(e)}>
                              <Ionicons name="people-outline" size={12} color={ACCENT_GOLD} />
                              <Text style={ss.smallBtnGoldText}>Attendees</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </>
            )}

            {/* ── SAFETY ── */}
            {activeTab === 'safety' && (
              <>
                {renderFilterChips(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active alerts' },
                    { id: 'needs_duration', label: 'Needs duration' },
                    { id: 'responded', label: 'Responded' },
                  ] as const,
                  safetyFilter,
                  setSafetyFilter,
                )}
                <ScrollView contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}>
                  <Text style={ss.sectionLabel}>PERSONAL HIKES</Text>
                  {adminLoading ? (
                    <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading safety checks…</Text></View>
                  ) : adminError ? (
                    <View style={ss.emptyState}><Text style={ss.emptyStateText}>{adminError}</Text></View>
                  ) : adminHikes.filter(matchesSafetyFilter).length === 0 ? (
                    <View style={ss.emptyState}><Text style={ss.emptyStateText}>No hike safety checks match.</Text></View>
                  ) : (
                    adminHikes.filter(matchesSafetyFilter).map((row) => (
                      <SafetyRow key={row.check_id} row={row} onMarkSeen={markAdminAlertSeen} onSetDuration={openDurationModal} />
                    ))
                  )}

                  <Text style={ss.sectionLabel}>ORGANIZATION EVENTS</Text>
                  {adminLoading ? null : adminEvents.filter(matchesSafetyFilter).length === 0 ? (
                    <View style={ss.emptyState}><Text style={ss.emptyStateText}>No event safety checks match.</Text></View>
                  ) : (
                    adminEvents.filter(matchesSafetyFilter).map((row) => (
                      <SafetyRow key={row.check_id} row={row} onMarkSeen={markAdminAlertSeen} onSetDuration={openDurationModal} />
                    ))
                  )}
                </ScrollView>
              </>
            )}

            {/* ── EMERGENCIES ── */}
            {activeTab === 'emergencies' && (
              <ScrollView contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}>
                <View style={ss.alertBanner}>
                  <Ionicons name="alert-circle" size={16} color="#E07070" />
                  <Text style={ss.alertBannerText}>
                    {sosRows.length} recent SOS ping{sosRows.length === 1 ? '' : 's'}. Contact hikers and authorities if any are live.
                  </Text>
                </View>
                {sosLoading ? (
                  <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading SOS…</Text></View>
                ) : sosRows.length === 0 ? (
                  renderEmpty('shield-checkmark-outline', 'No SOS pings', 'Recent SOS locations will appear here.')
                ) : (
                  sosRows.map((row) => (
                    <View key={String(row.id)} style={[ss.card, { borderColor: 'rgba(224,112,112,0.35)' }]}>
                      <View style={ss.cardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={ss.rowTitle} numberOfLines={1}>SOS · {new Date(row.timestamp).toLocaleString()}</Text>
                          <Text style={ss.rowSub} numberOfLines={1}>
                            {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)} · ±{row.accuracy?.toFixed(0) ?? '?'}m
                          </Text>
                        </View>
                        <View style={[ss.statusBadge, ss.statusRejected]}>
                          <Text style={ss.statusTextRejected}>SOS</Text>
                        </View>
                      </View>
                      {row.altitude != null && <Text style={ss.rowMeta}>Altitude {row.altitude.toFixed(0)}m</Text>}
                      {row.user_id && <Text style={ss.rowMeta}>User {row.user_id}</Text>}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* ── MODERATION ── */}
            {activeTab === 'moderation' && (
              <>
                {renderFilterChips(
                  [
                    { id: 'journal', label: 'Journal' },
                    { id: 'discoveries', label: 'Discoveries' },
                  ] as const,
                  moderationTab,
                  setModerationTab,
                )}

                {moderationTab === 'journal' && (
                  <>
                    {renderFilterChips(
                      [
                        { id: 'public', label: 'Public only' },
                        { id: 'all', label: 'All entries' },
                      ] as const,
                      journalPublicOnly ? 'public' : 'all',
                      (id) => setJournalPublicOnly(id === 'public'),
                    )}
                    {journalLoading ? (
                      <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading journal…</Text></View>
                    ) : journal.length === 0 ? (
                      renderEmpty('book-outline', 'No journal entries', 'Journal entries will appear here for moderation.')
                    ) : (
                      <FlatList
                        data={journal}
                        keyExtractor={(j) => j.id}
                        contentContainerStyle={ss.mainContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item: j }) => (
                          <View style={ss.card}>
                            <View style={ss.cardHeader}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={ss.rowTitle} numberOfLines={1}>{j.title || 'Untitled'}</Text>
                                <Text style={ss.rowSub} numberOfLines={1}>{j.author_name || j.author_email || 'Unknown'} · {new Date(j.created_at).toLocaleDateString()}</Text>
                              </View>
                              <View style={[ss.statusBadge, j.is_public ? ss.statusApproved : ss.statusPending]}>
                                <Text style={j.is_public ? ss.statusTextApproved : ss.statusText}>{j.is_public ? 'public' : 'private'}</Text>
                              </View>
                            </View>
                            <Text style={ss.rowMeta} numberOfLines={2}>{j.content}</Text>
                            <Text style={ss.rowMeta}>{j.images.length} photo{j.images.length === 1 ? '' : 's'} · ♥ {j.like_count}{j.rating ? ` · ★ ${j.rating}` : ''}</Text>
                            <View style={ss.cardActions}>
                              <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => confirmDeleteJournal(j)}>
                                <Ionicons name="trash-outline" size={12} color="#E07070" />
                                <Text style={ss.smallBtnDangerText}>Delete entry</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      />
                    )}
                  </>
                )}

                {moderationTab === 'discoveries' && (
                  <>
                    {discoveriesLoading ? (
                      <View style={ss.emptyState}><Text style={ss.emptyStateText}>Loading discoveries…</Text></View>
                    ) : discoveries.length === 0 ? (
                      renderEmpty('leaf-outline', 'No discoveries', 'Species discoveries will appear here.')
                    ) : (
                      <FlatList
                        data={discoveries}
                        keyExtractor={(d) => String(d.id)}
                        contentContainerStyle={ss.mainContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item: d }) => (
                          <View style={ss.row}>
                            <View style={ss.rowDot} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={ss.rowTitle} numberOfLines={1}>{d.species_name || d.species_scientific || `Species #${d.species_id}`}</Text>
                              <Text style={ss.rowSub} numberOfLines={1}>{d.species_scientific ?? '—'} · mountain {d.mountain_id}</Text>
                              <Text style={ss.rowMeta} numberOfLines={1}>user {d.user_id}</Text>
                            </View>
                            <Text style={ss.rowMetaRight}>{new Date(d.discovered_at).toLocaleDateString()}</Text>
                          </View>
                        )}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Logout confirm */}
      {showLogoutConfirm && (
        <Animated.View style={[ss.logoutToast, { opacity: logoutToastOpacity, transform: [{ translateY: logoutToastY }] }]}>
          <View style={ss.logoutToastBar} />
          <View style={ss.logoutToastInner}>
            <Text style={ss.logoutToastTitle}>Sign out?</Text>
            <Text style={ss.logoutToastMsg}>You'll be logged out of the admin panel.</Text>
            <View style={ss.logoutToastActions}>
              <TouchableOpacity style={ss.logoutToastCancel} onPress={dismissLogoutConfirm}>
                <Text style={ss.logoutToastCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.logoutToastConfirm} onPress={confirmLogout}>
                <Ionicons name="log-out-outline" size={11} color={CHAT_BG} />
                <Text style={ss.logoutToastConfirmText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Feedback toast */}
      {toast && (
        <Animated.View
          style={[
            ss.feedbackToast,
            toast.type === 'success' && ss.feedbackToastSuccess,
            toast.type === 'error' && ss.feedbackToastError,
            toast.type === 'warning' && ss.feedbackToastWarning,
            { opacity: toastOpacity, transform: [{ translateY: toastY }] },
          ]}
        >
          <View style={[ss.feedbackToastBar,
            toast.type === 'success' && { backgroundColor: '#6FAF8A' },
            toast.type === 'error' && { backgroundColor: '#E07070' },
            toast.type === 'warning' && { backgroundColor: ACCENT_GOLD },
          ]} />
          <View style={ss.feedbackToastIcon}>
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'warning'}
              size={15}
              color={toast.type === 'success' ? '#6FAF8A' : toast.type === 'error' ? '#E07070' : ACCENT_GOLD}
            />
          </View>
          <View style={ss.feedbackToastContent}>
            <Text style={ss.feedbackToastTitle}>{toast.title}</Text>
            <Text style={ss.feedbackToastMsg}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

/* ─────────── SafetyRow (ChatScreen-tinted) ─────────── */
function SafetyRow({
  row,
  onMarkSeen,
  onSetDuration,
}: {
  row: AdminSafetyRow;
  onMarkSeen: (id: string) => Promise<void>;
  onSetDuration: (row: AdminSafetyRow) => void;
}) {
  const isActive = !!row.active_alert_id && !row.seen;
  const statusColor =
    row.response_status === 'got_home' ? '#6FAF8A'
      : row.response_status === 'not_home_yet' ? '#E07070'
      : TEXT_MUTED;

  return (
    <View style={[ss.card, isActive && ss.cardAlert]}>
      <View style={ss.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={ss.rowTitle} numberOfLines={1}>{row.subject_name ?? row.subject_email ?? row.subject_user_id}</Text>
          <Text style={ss.rowSub} numberOfLines={1}>{row.title}{row.event_id ? ` · event ${row.event_id.slice(0, 8)}…` : ''}</Text>
        </View>
        <View style={[ss.statusBadge, { borderColor: statusColor, backgroundColor: 'transparent' }]}>
          <Text style={[ss.statusText, { color: statusColor, textTransform: 'none' }]}>{row.response_status.replace(/_/g, ' ')}</Text>
        </View>
      </View>
      <Text style={ss.rowMeta}>
        Planned finish {new Date(row.planned_finish_at).toLocaleString()}
        {row.responded_at ? ` · Responded ${new Date(row.responded_at).toLocaleTimeString()}` : ''}
      </Text>
      {row.event_duration_hours ? <Text style={ss.rowMeta}>Duration {row.event_duration_hours}h</Text> : null}
      {row.needs_duration && <Text style={[ss.rowMeta, { color: ACCENT_GOLD }]}>Needs duration</Text>}
      {row.active_alert_id && (
        <View style={ss.cardActions}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isActive ? '#E07070' : TEXT_MUTED, fontSize: 10.5, fontWeight: '700' }}>
              {row.active_alert_type === 'not_home_yet' ? 'Not home yet' : 'No response (1h)'}
              {row.active_alert_triggered_at ? ` · ${new Date(row.active_alert_triggered_at).toLocaleTimeString()}` : ''}
            </Text>
          </View>
          {isActive && (
            <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => { void onMarkSeen(row.active_alert_id!); }}>
              <Ionicons name="checkmark" size={12} color="#6FAF8A" />
              <Text style={ss.smallBtnSuccessText}>Mark seen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {row.needs_duration && row.event_id && (
        <View style={ss.cardActions}>
          <TouchableOpacity style={[ss.smallBtn, ss.smallBtnGold]} onPress={() => onSetDuration(row)}>
            <Ionicons name="timer-outline" size={12} color={ACCENT_GOLD} />
            <Text style={ss.smallBtnGoldText}>Set duration</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ─────────── Styles ─────────── */
const ss = StyleSheet.create({
  // Shell
  screen: { flex: 1, backgroundColor: CHAT_BG },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: CHAT_BG },

  // Sidebar (icon rail)
  sidebar: { width: SIDEBAR_W, borderRightWidth: 1, borderRightColor: CHAT_BORDER, backgroundColor: CHAT_BG },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: CHAT_BORDER,
  },
  backBtn: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sidebarTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CHAT_ONLINE },
  statusText: { fontSize: 9.5, color: TEXT_MUTED, fontWeight: '500', letterSpacing: 0.2 },

  railContent: { padding: 8, gap: 2 },
  railItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, height: 34, borderRadius: 9,
  },
  railItemActive: { backgroundColor: 'rgba(201,169,110,0.12)' },
  railLabel: { flex: 1, color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  railLabelActive: { color: TEXT_PRIMARY },
  railBadge: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: '#E07070', alignItems: 'center', justifyContent: 'center',
  },
  railBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  sidebarFooter: { padding: 8, gap: 6, borderTopWidth: 1, borderTopColor: CHAT_BORDER },
  footerBtn: {
    height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  footerBtnDanger: { backgroundColor: 'rgba(224,112,112,0.06)', borderColor: 'rgba(224,112,112,0.2)' },
  footerBtnText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },

  // Main panel
  main: { flex: 1, minWidth: 0, backgroundColor: CHAT_BG },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 52, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: CHAT_BORDER,
  },
  panelTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  panelSubtitle: { color: TEXT_MUTED, fontSize: 10.5, marginTop: 1 },

  headerPill: {
    height: 22, paddingHorizontal: 8, borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerPillText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },

  mainContent: { padding: 14, gap: 8 },

  // Search & chips
  searchRow: { paddingHorizontal: 14, paddingTop: 12 },
  searchBox: {
    height: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10,
    borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 12, paddingVertical: 0 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  chip: {
    height: 24, paddingHorizontal: 9, borderRadius: 8, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(201,169,110,0.12)', borderColor: 'rgba(201,169,110,0.35)' },
  chipText: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '600' },
  chipTextActive: { color: ACCENT_GOLD },

  // Section + stat grid
  sectionLabel: {
    color: 'rgba(255,255,255,0.32)', fontSize: 9, fontWeight: '600',
    letterSpacing: 0.6, marginTop: 6, marginBottom: 4,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%', paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statCardLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 8.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statCardValue: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', marginTop: 2 },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowLast: { borderBottomWidth: 0 },
  rowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT_GOLD },
  rowTitle: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  rowSub: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 },
  rowMeta: { color: 'rgba(255,255,255,0.32)', fontSize: 9.5, marginTop: 2 },
  rowMetaRight: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '600' },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  userActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  iconAction: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  // Cards (for orgs/events/journal/safety)
  card: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 12, gap: 4,
  },
  cardAlert: { borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'rgba(201,169,110,0.04)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },

  // Status badges
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusPending: { backgroundColor: 'rgba(201,169,110,0.1)', borderColor: 'rgba(201,169,110,0.3)' },
  statusApproved: { backgroundColor: 'rgba(111,175,138,0.1)', borderColor: 'rgba(111,175,138,0.3)' },
  statusRejected: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.3)' },
  statusText: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: ACCENT_GOLD },
  statusTextApproved: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: '#6FAF8A' },
  statusTextRejected: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: '#E07070' },

  // Small pill buttons inside cards
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  smallBtnSuccess: { backgroundColor: 'rgba(111,175,138,0.1)', borderColor: 'rgba(111,175,138,0.3)' },
  smallBtnDanger: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.3)' },
  smallBtnGold: { backgroundColor: 'rgba(201,169,110,0.1)', borderColor: 'rgba(201,169,110,0.3)' },
  smallBtnSuccessText: { color: '#6FAF8A', fontSize: 10.5, fontWeight: '700' },
  smallBtnDangerText: { color: '#E07070', fontSize: 10.5, fontWeight: '700' },
  smallBtnGoldText: { color: ACCENT_GOLD, fontSize: 10.5, fontWeight: '700' },

  // Attendance
  attendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  attendLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  attendValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '800' },
  attendSub: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '600' },
  meter: { height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: 2 },
  waitlistText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '600', marginTop: 4 },

  // Empty state (ChatScreen-style)
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: CHAT_BG },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(201,169,110,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 24 },
  emptyStateText: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 460, maxHeight: 560,
    backgroundColor: CHAT_BG, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CHAT_BORDER,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  modalClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  modalDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalActionPrimary: { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD },
  modalActionDanger: { backgroundColor: '#E07070', borderColor: '#E07070' },
  modalActionText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, height: 42, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  inputField: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, paddingVertical: 0 },

  userPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 10,
  },
  userPillAvatar: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.12)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  userPillAvatarText: { color: ACCENT_GOLD, fontSize: 13, fontWeight: '700' },
  userPillName: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  userPillEmail: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 },

  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  miniBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  miniBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  attendeeGuests: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },

  // Emergency banner
  alertBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(224,112,112,0.08)', borderWidth: 1, borderColor: 'rgba(224,112,112,0.3)',
    borderRadius: 10, padding: 10,
  },
  alertBannerText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },

  // Toasts (ChatScreen-consistent)
  logoutToast: {
    position: 'absolute', bottom: 40, left: '50%', marginLeft: -140, width: 280,
    flexDirection: 'row', backgroundColor: '#141E2D', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(224,112,112,0.2)', overflow: 'hidden', zIndex: 100, elevation: 10,
  },
  logoutToastBar: { width: 3, backgroundColor: '#BF6A6A', alignSelf: 'stretch' },
  logoutToastInner: { flex: 1, paddingHorizontal: 10, paddingVertical: 9 },
  logoutToastTitle: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  logoutToastMsg: { color: 'rgba(255,255,255,0.42)', fontSize: 10, lineHeight: 13, marginBottom: 8 },
  logoutToastActions: { flexDirection: 'row', gap: 6 },
  logoutToastCancel: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  logoutToastCancelText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },
  logoutToastConfirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, borderRadius: 6, backgroundColor: '#BF6A6A' },
  logoutToastConfirmText: { color: CHAT_BG, fontSize: 10, fontWeight: '700' },

  feedbackToast: {
    position: 'absolute', bottom: 16, left: '50%', marginLeft: -148, width: 296,
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#141E2D',
    borderRadius: 10, borderWidth: 1, overflow: 'hidden', zIndex: 200, elevation: 12,
  },
  feedbackToastSuccess: { borderColor: 'rgba(111,175,138,0.25)' },
  feedbackToastError: { borderColor: 'rgba(224,112,112,0.25)' },
  feedbackToastWarning: { borderColor: 'rgba(201,169,110,0.25)' },
  feedbackToastBar: { width: 3, alignSelf: 'stretch' },
  feedbackToastIcon: { paddingLeft: 10, paddingRight: 2, justifyContent: 'center' },
  feedbackToastContent: { flex: 1, paddingHorizontal: 8, paddingVertical: 10 },
  feedbackToastTitle: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '700', marginBottom: 1 },
  feedbackToastMsg: { color: 'rgba(255,255,255,0.42)', fontSize: 10, lineHeight: 14 },
});