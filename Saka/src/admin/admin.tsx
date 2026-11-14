// Admin.tsx — restyled to match ChatScreen (CHAT_* tokens, hairline shell,
// matching header + empty states). Data layer unchanged from the previous rewrite.
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  FlatList,
  Pressable,
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
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useHikesStore } from '../store/hikesStore';
import { useHikeSafetyStore } from '../store/hikeSafetyStore';
import { supabase } from '../lib/supabase';
import { organizationService } from '../services/organizationService';
import { mountainService, type Mountain } from '../services/mountainService';
import type { AdminSafetyRow } from '../services/hikeSafetyService';
import { hikeSafetyService } from '../services/hikeSafetyService';
import {
  adminService,
  type AdminUserRow,
  type AdminOrgRow,
  type AdminEventRow,
  type AdminJournalRow,
  type AdminJournalFilters,
  type AdminSosRow,
  type AdminEmergencyContactRow,
  type AdminDiscoveryRow,
  type GlobalStats,
} from '../services/AdminService';
import { formatRangeShort } from '../utils/dateRange';
import UserLocationModal from './UserLocationModal';
import AdminModal from './AdminModal';
import { AdminListSkeleton, AdminStatsSkeleton } from '../components/admin/AdminsSkeletons';
import Toast, { type ToastHandle } from '../components/Toast';
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
  | 'moderation'
  | 'managerChanges'
  | 'auditLog'
  | 'systemHealth';

type ManagerChange = {
  id: string;
  manager_id: string | null;
  mountain_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
  manager_name: string | null;
  mountain_name: string | null;
  entity_name: string | null;
};

const MANAGER_CHANGE_ENTITY_LABELS: Record<string, string> = {
  mountains: 'Mountain details',
  viewpoints: 'Viewpoint',
  mountain_manager_content: 'Trail guide',
  hiking_journals: 'Journal post',
  chat_messages: 'Chat message',
};

const getManagerChangeTitle = (change: ManagerChange) => {
  const action = ({ create: 'added', update: 'updated', delete: 'removed' } as Record<string, string>)[change.action] ?? 'changed';
  const target = change.entity === 'mountains'
    ? change.mountain_name ?? 'a mountain'
    : change.entity === 'mountain_manager_content'
      ? `guide information for ${change.mountain_name ?? 'a mountain'}`
      : change.entity_name ?? MANAGER_CHANGE_ENTITY_LABELS[change.entity] ?? 'mountain information';
  return `${change.manager_name ?? 'Mountain manager'} ${action} ${target}`;
};

const getManagerChangeSubtitle = (change: ManagerChange) => {
  const entityLabel = MANAGER_CHANGE_ENTITY_LABELS[change.entity] ?? 'Mountain update';
  if (change.entity === 'mountains') return entityLabel;
  return [entityLabel, change.mountain_name].filter(Boolean).join(' · ');
};

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'hikes', label: 'Hikes', icon: 'trail-sign-outline' },
  { id: 'users', label: 'Users', icon: 'people-outline' },
  { id: 'orgs', label: 'Organizations', icon: 'business-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline' },
  { id: 'emergencies', label: 'Emergencies', icon: 'alert-circle-outline' },
  { id: 'moderation', label: 'Moderation', icon: 'eye-outline' },
  { id: 'managerChanges', label: 'Manager updates', icon: 'notifications-outline' },
  { id: 'auditLog', label: 'Audit Trail', icon: 'list-outline' },
  { id: 'systemHealth', label: 'System Health', icon: 'server-outline' },
];

const SEEN_DWELL_MS = 3000;

export default function AdminRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { user, profile, signOut, clearError } = useAuthStore();
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

  // Data
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'hiker' | 'organization' | 'admin' | 'manager'>('all');
  const [managerModalVisible, setManagerModalVisible] = useState(false);
  const [managerTarget, setManagerTarget] = useState<AdminUserRow | null>(null);
  const [managerEnabled, setManagerEnabled] = useState(false);
  const [managerMountains, setManagerMountains] = useState<Mountain[]>([]);
  const [managerMountainIds, setManagerMountainIds] = useState<Set<string>>(new Set());
  const [managerSaving, setManagerSaving] = useState(false);

  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<'pending' | 'verified' | 'all'>('pending');
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  const [modEvents, setModEvents] = useState<AdminEventRow[]>([]);
  const [modEventsLoading, setModEventsLoading] = useState(false);
  const [modEventsError, setModEventsError] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<'all' | 'published' | 'draft' | 'cancelled' | 'completed'>('published');

  const [safetyFilter, setSafetyFilter] = useState<'all' | 'active' | 'needs_duration' | 'responded' | 'not_home_yet'>('all');

  const [sosRows, setSosRows] = useState<AdminSosRow[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<AdminEmergencyContactRow[]>([]);
  const [emergencyContactsLoading, setEmergencyContactsLoading] = useState(false);
  const [emergencyContactsError, setEmergencyContactsError] = useState<string | null>(null);

  // Pagination
  const [journal, setJournal] = useState<AdminJournalRow[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalVisibility, setJournalVisibility] = useState<AdminJournalFilters['visibility']>('public');
  const [journalYear, setJournalYear] = useState<number | null>(null);
  const [journalMonth, setJournalMonth] = useState<number | null>(null);
  const [journalFilterModalVisible, setJournalFilterModalVisible] = useState(false);
  const [journalPage, setJournalPage] = useState(0);
  const [journalHasMore, setJournalHasMore] = useState(true);

  const [managerChanges, setManagerChanges] = useState<ManagerChange[]>([]);
  const managerChangesLoaded = useRef(false);
  const managerChangesVisibleSince = useRef<number | null>(null);
  const managerChangesRef = useRef(managerChanges);
  managerChangesRef.current = managerChanges;
  const safetyRowsRef = useRef<AdminSafetyRow[]>([]);
  safetyRowsRef.current = [...adminHikes, ...adminEvents];
  const safetyVisibleSince = useRef<number | null>(null);

  const [discoveries, setDiscoveries] = useState<AdminDiscoveryRow[]>([]);
  const [discoveriesLoading, setDiscoveriesLoading] = useState(false);
  const [discoveriesError, setDiscoveriesError] = useState<string | null>(null);
  const [discoveriesPage, setDiscoveriesPage] = useState(0);
  const [discoveriesHasMore, setDiscoveriesHasMore] = useState(true);
  
  // Moderation & Audit
  const [moderationTab, setModerationTab] = useState<'journal' | 'discoveries' | 'reports'>('journal');
  const [chatReports, setChatReports] = useState<any[]>([]);
  const [chatReportsLoading, setChatReportsLoading] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // System Health
  const [systemHealth, setSystemHealth] = useState<Record<string, { status: string, message: string }> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

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
  const [attendeesError, setAttendeesError] = useState<string | null>(null);
  const [durationModalVisible, setDurationModalVisible] = useState(false);
  const [durationTarget, setDurationTarget] = useState<AdminSafetyRow | null>(null);
  const [durationValue, setDurationValue] = useState('');

  const toastRef = useRef<ToastHandle>(null);
  const toastDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((type: 'success' | 'error' | 'warning', title: string, msg: string) => {
    if (toastDisplayTimer.current) clearTimeout(toastDisplayTimer.current);
    // Let AdminModal's native modal finish its 200 ms exit before presenting the toast modal.
    toastDisplayTimer.current = setTimeout(() => {
      toastRef.current?.show({ type, title, message: msg });
      toastDisplayTimer.current = null;
    }, 250);
  }, []);
  useEffect(() => () => {
    if (toastDisplayTimer.current) clearTimeout(toastDisplayTimer.current);
  }, []);

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutModalOpacity = useRef(new Animated.Value(0)).current;
  const logoutModalY = useRef(new Animated.Value(24)).current;
  const openLogoutConfirm = () => {
    setShowLogoutConfirm(true);
    logoutModalOpacity.setValue(0);
    logoutModalY.setValue(24);
    Animated.parallel([
      Animated.timing(logoutModalOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutModalY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };
  const dismissLogoutConfirm = () => {
    Animated.parallel([
      Animated.timing(logoutModalOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutModalY, { toValue: 24, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setShowLogoutConfirm(false));
  };
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      clearError();
      await signOut();
      const error = useAuthStore.getState().error;
      if (error) {
        showToast('error', 'Sign Out Failed', error);
        return;
      }
      router.replace('/Login');
    } catch (error) {
      showToast('error', 'Sign Out Failed', error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  // Fetchers
  const fetchStats = async () => { 
    setStatsLoading(true); setStatsError(null);
    try { setStats(await adminService.fetchGlobalStats()); } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch stats';
      setStatsError(message);
      showToast('error', 'Stats Failed', message);
    } finally { setStatsLoading(false); } 
  };
  
  const fetchUsers = async () => { 
    setUsersLoading(true); setUsersError(null);
    try { setUsers(await adminService.fetchAdminUsers()); } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch users';
      setUsersError(message);
      showToast('error', 'Users Failed to Load', message);
    } finally { setUsersLoading(false); } 
  };
  
  const fetchOrgs = async () => { 
    setOrgsLoading(true); setOrgsError(null);
    try { setOrgs(await adminService.fetchAdminOrgs()); } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch organizations';
      setOrgsError(message);
      showToast('error', 'Organizations Failed to Load', message);
    } finally { setOrgsLoading(false); } 
  };
  
  const fetchModEvents = async () => { 
    setModEventsLoading(true); setModEventsError(null);
    try { setModEvents(await adminService.fetchAdminEvents()); } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch events';
      setModEventsError(message);
      showToast('error', 'Events Failed to Load', message);
    } finally { setModEventsLoading(false); } 
  };
  
  const fetchSos = async () => { 
    setSosLoading(true); setSosError(null);
    try { setSosRows(await adminService.fetchAdminSos()); } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch SOS alerts';
      setSosError(message);
      showToast('error', 'SOS Alerts Failed to Load', message);
    } finally { setSosLoading(false); } 
  };

  const resolveSos = async (sosId: string) => {
    try {
      const { error } = await supabase.rpc('admin_resolve_sos', { p_sos_id: sosId });
      if (error) { showToast('error', 'Resolve Failed', error.message); return; }
      showToast('success', 'SOS Resolved', 'The alert has been marked as resolved.');
      void fetchSos();
    } catch (error) {
      showToast('error', 'Resolve Failed', error instanceof Error ? error.message : 'Unable to resolve the SOS alert.');
    }
  };

  const markSafetyAlertSeen = useCallback(async (alertId: string, silent = false) => {
    try {
      const error = await markAdminAlertSeen(alertId);
      if (error) {
        showToast('error', 'Unable to Mark Alert Seen', error);
        return;
      }
      if (!silent) showToast('success', 'Alert Marked Seen', 'The safety alert has been marked as seen.');
    } catch (error) {
      showToast('error', 'Unable to Mark Alert Seen', error instanceof Error ? error.message : 'Unable to update the safety alert.');
    }
  }, [markAdminAlertSeen, showToast]);
  
  const fetchEmergencyContacts = async () => {
    setEmergencyContactsLoading(true); setEmergencyContactsError(null);
    try { setEmergencyContacts(await adminService.fetchAdminEmergencyContacts()); } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load emergency contacts.';
      setEmergencyContactsError(message);
      showToast('error', 'Contacts Failed to Load', message);
    } finally { setEmergencyContactsLoading(false); }
  };
  
  const fetchJournal = async (page = 0) => {
    setJournalLoading(true); setJournalError(null);
    try {
      const filters: AdminJournalFilters = { visibility: journalVisibility, year: journalYear, month: journalMonth };
      const data = await adminService.fetchAdminJournal(filters, page);
      if (page === 0) setJournal(data); else setJournal(prev => [...prev, ...data]);
      setJournalPage(page);
      setJournalHasMore(data.length >= 100);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch journals';
      setJournalError(message);
      showToast('error', 'Journal Failed to Load', message);
    } finally { setJournalLoading(false); }
  };
  
  const fetchDiscoveries = async (page = 0) => { 
    setDiscoveriesLoading(true); setDiscoveriesError(null);
    try { 
      const data = await adminService.fetchAdminDiscoveries(page);
      if (page === 0) setDiscoveries(data); else setDiscoveries(prev => [...prev, ...data]);
      setDiscoveriesPage(page);
      setDiscoveriesHasMore(data.length >= 100);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch discoveries';
      setDiscoveriesError(message);
      showToast('error', 'Discoveries Failed to Load', message);
    } finally { setDiscoveriesLoading(false); } 
  };
  
  const fetchManagerChanges = async () => {
    try {
      const { data, error } = await supabase.from('manager_change_notifications').select('id, manager_id, mountain_id, action, entity, entity_id, created_at, read_at').order('created_at', { ascending: false }).limit(100);
      if (error) { showToast('error', 'Notification Load Failed', error.message); return; }
      const changes = data ?? [];
      const managerIds = Array.from(new Set(changes.map((change) => change.manager_id).filter((id): id is string => !!id)));
      const mountainIds = Array.from(new Set(changes.map((change) => change.mountain_id).filter((id): id is string => !!id)));
      const viewpointIds = Array.from(new Set(changes.filter((change) => change.entity === 'viewpoints').map((change) => change.entity_id).filter((id): id is string => !!id)));
      const journalIds = Array.from(new Set(changes.filter((change) => change.entity === 'hiking_journals').map((change) => change.entity_id).filter((id): id is string => !!id)));

      const [profilesResult, mountainsResult, viewpointsResult, journalsResult] = await Promise.all([
        managerIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', managerIds) : Promise.resolve({ data: [], error: null }),
        mountainIds.length ? supabase.from('mountains').select('id, name').in('id', mountainIds) : Promise.resolve({ data: [], error: null }),
        viewpointIds.length ? supabase.from('viewpoints').select('id, name').in('id', viewpointIds) : Promise.resolve({ data: [], error: null }),
        journalIds.length ? supabase.from('hiking_journals').select('id, title').in('id', journalIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const lookupErrors = [profilesResult.error, mountainsResult.error, viewpointsResult.error, journalsResult.error].filter(Boolean);
      if (lookupErrors.length) {
        showToast('error', 'Some manager update names are unavailable', lookupErrors.map((lookupError) => lookupError?.message).filter(Boolean).join('; '));
      }

      const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name || profile.email]));
      const mountainNames = new Map((mountainsResult.data ?? []).map((mountain) => [mountain.id, mountain.name]));
      const viewpointNames = new Map((viewpointsResult.data ?? []).map((viewpoint) => [viewpoint.id, viewpoint.name]));
      const journalNames = new Map((journalsResult.data ?? []).map((journal) => [journal.id, journal.title]));

      setManagerChanges(changes.map((change) => ({
        ...change,
        manager_name: change.manager_id ? profileNames.get(change.manager_id) ?? null : null,
        mountain_name: change.mountain_id ? mountainNames.get(change.mountain_id) ?? null : null,
        entity_name: change.entity === 'viewpoints'
          ? viewpointNames.get(change.entity_id ?? '') ?? null
          : change.entity === 'hiking_journals'
            ? journalNames.get(change.entity_id ?? '') ?? null
            : null,
      })));
      managerChangesLoaded.current = true;
      if (activeTab === 'managerChanges' && managerChangesVisibleSince.current === null) {
        managerChangesVisibleSince.current = Date.now();
      }
    } catch (error) {
      showToast('error', 'Notification Load Failed', error instanceof Error ? error.message : 'Unable to load manager notifications.');
    }
  };

  const markManagerChangesRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const readAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('manager_change_notifications')
        .update({ read_at: readAt })
        .in('id', ids)
        .is('read_at', null);
      if (error) {
        showToast('error', 'Unable to mark manager updates read', error.message);
        return;
      }
      setManagerChanges((rows) => rows.map((row) => ids.includes(row.id) ? { ...row, read_at: readAt } : row));
    } catch (error) {
      showToast('error', 'Unable to mark manager updates read', error instanceof Error ? error.message : 'Unable to update manager notifications.');
    }
  }, [showToast]);
  
  const fetchChatReports = async () => {
    setChatReportsLoading(true);
    try { setChatReports(await adminService.fetchAdminChatReports()); } catch (e: unknown) { showToast('error', 'Reports Failed', e instanceof Error ? e.message : 'Unable to load reports.'); } finally { setChatReportsLoading(false); }
  };
  
  const fetchAuditLog = async () => {
    setAuditLoading(true);
    try { setAuditLog(await adminService.fetchAdminAuditLog()); } catch (e: unknown) { showToast('error', 'Audit Log Failed', e instanceof Error ? e.message : 'Unable to load the audit log.'); } finally { setAuditLoading(false); }
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try { setSystemHealth(await adminService.fetchSystemHealth()); } catch (e: unknown) { showToast('error', 'Health Check Failed', e instanceof Error ? e.message : 'Unable to check system health.'); } finally { setHealthLoading(false); }
  };

  const loadAllHikes = async () => {
    const error = await fetchAllHikes();
    if (error) showToast('error', 'Hikes Failed to Load', error);
  };

  useEffect(() => {
    if (adminError) showToast('error', 'Safety Data Failed to Load', adminError);
  }, [adminError, showToast]);

  const resolveChatReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      const { error } = await supabase.rpc('admin_resolve_chat_report', {
        p_report_id: reportId,
        p_status: status,
      });
      if (error) {
        showToast('error', 'Report Update Failed', error.message);
        return;
      }
      showToast('success', status === 'resolved' ? 'Report Resolved' : 'Report Dismissed', 'The report status has been updated.');
      void fetchChatReports();
    } catch (error) {
      showToast('error', 'Report Update Failed', error instanceof Error ? error.message : 'Unable to update the report.');
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!profile?.is_admin) { router.replace('/Home'); return; }
    fetchStats(); void loadAllHikes();
  }, [user, profile?.is_admin, router]);

  // Realtime subscriptions
  useEffect(() => {
    if (!profile?.is_admin || !user?.id) return;
    
    const managerChannel = supabase.channel(`manager-updates-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manager_change_notifications' }, () => {
        void fetchManagerChanges();
      }).subscribe();

    const alertsChannel = supabase.channel(`admin-alerts-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'admin_alerts' }, () => {
        fetchStats();
        if (activeTab === 'emergencies') fetchSos();
        if (activeTab === 'safety') loadAdminSafety();
      }).subscribe();

    return () => { void supabase.removeChannel(managerChannel); void supabase.removeChannel(alertsChannel); };
  }, [profile?.is_admin, user?.id, activeTab]);

  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
    else if (activeTab === 'users') { fetchUsers(); fetchEmergencyContacts(); }
    else if (activeTab === 'orgs') fetchOrgs();
    else if (activeTab === 'events') fetchModEvents();
    else if (activeTab === 'safety') { loadAdminSafety(); fetchUsers(); fetchEmergencyContacts(); }
    else if (activeTab === 'emergencies') { fetchSos(); fetchEmergencyContacts(); }
    else if (activeTab === 'managerChanges') fetchManagerChanges();
    else if (activeTab === 'auditLog') fetchAuditLog();
    else if (activeTab === 'systemHealth') fetchHealth();
    else if (activeTab === 'moderation') { 
      if (moderationTab === 'journal') fetchJournal(0); 
      else if (moderationTab === 'discoveries') fetchDiscoveries(0); 
      else if (moderationTab === 'reports') fetchChatReports();
    }
  }, [activeTab, moderationTab, journalVisibility, journalYear, journalMonth]);

  useEffect(() => {
    if (activeTab !== 'safety') {
      safetyVisibleSince.current = null;
      return;
    }
    if (adminLoading || adminError) {
      safetyVisibleSince.current = null;
      return;
    }
    if (safetyVisibleSince.current === null) safetyVisibleSince.current = Date.now();
  }, [activeTab, adminLoading, adminError]);

  useEffect(() => {
    if (activeTab === 'managerChanges') {
      managerChangesVisibleSince.current = managerChangesLoaded.current ? Date.now() : null;
      return () => {
        const visibleSince = managerChangesVisibleSince.current;
        managerChangesVisibleSince.current = null;
        if (visibleSince === null || Date.now() - visibleSince < SEEN_DWELL_MS) return;
        const unreadIds = managerChangesRef.current.filter((change) => !change.read_at).map((change) => change.id);
        void markManagerChangesRead(unreadIds);
      };
    }
    if (activeTab === 'safety') {
      safetyVisibleSince.current = null;
      return () => {
        const visibleSince = safetyVisibleSince.current;
        safetyVisibleSince.current = null;
        if (visibleSince === null || Date.now() - visibleSince < SEEN_DWELL_MS) return;
        const alertIds = safetyRowsRef.current
          .filter((row) => row.response_status === 'got_home' && row.active_alert_id && !row.seen)
          .map((row) => row.active_alert_id!);
        void Promise.all(alertIds.map((id) => markSafetyAlertSeen(id, true)));
      };
    }
  }, [activeTab, markManagerChangesRead, markSafetyAlertSeen]);

  const refreshCurrentTab = () => {
    if (activeTab === 'overview') fetchStats();
    else if (activeTab === 'hikes') void loadAllHikes();
    else if (activeTab === 'users') { fetchUsers(); fetchEmergencyContacts(); }
    else if (activeTab === 'orgs') fetchOrgs();
    else if (activeTab === 'events') fetchModEvents();
    else if (activeTab === 'safety') { loadAdminSafety(); fetchUsers(); fetchEmergencyContacts(); }
    else if (activeTab === 'emergencies') { fetchSos(); fetchEmergencyContacts(); }
    else if (activeTab === 'managerChanges') fetchManagerChanges();
    else if (activeTab === 'auditLog') fetchAuditLog();
    else if (activeTab === 'systemHealth') fetchHealth();
    else if (activeTab === 'moderation') { 
      if (moderationTab === 'journal') fetchJournal(0); 
      else if (moderationTab === 'discoveries') fetchDiscoveries(0); 
      else if (moderationTab === 'reports') fetchChatReports();
    }
  };

  // Actions
  const updateUserAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { error } = await supabase.rpc('admin_set_admin_status', { p_user_id: userId, p_is_admin: isAdmin });
      if (error) { showToast('error', 'Update Failed', error.message); return; }
      showToast('success', 'Admin Updated', `Privileges have been ${isAdmin ? 'granted' : 'removed'}.`);
      void fetchUsers();
    } catch (error) {
      showToast('error', 'Update Failed', error instanceof Error ? error.message : 'Unable to update admin privileges.');
    }
  };

  const openManagerAssignments = async (target: AdminUserRow) => {
    if (target.id === user?.id) { showToast('warning', 'Not Allowed', 'You cannot change your own manager role.'); return; }
    try {
      const [mountains, assignments] = await Promise.all([
        mountainService.fetchMountains(true),
        supabase.from('mountain_manager_assignments').select('mountain_id').eq('manager_id', target.id),
      ]);
      if (assignments.error) throw new Error(assignments.error.message);
      setManagerTarget(target); setManagerEnabled(target.role === 'manager'); setManagerMountains(mountains);
      setManagerMountainIds(new Set((assignments.data ?? []).map((row) => row.mountain_id))); setManagerModalVisible(true);
    } catch (error) { showToast('error', 'Unable to load mountains', error instanceof Error ? error.message : 'Try again.'); }
  };
  
  const saveManagerAssignments = async () => {
    if (!managerTarget) return;
    setManagerSaving(true);
    try {
      const { error } = await supabase.rpc('set_mountain_manager', { p_manager_id: managerTarget.id, p_mountain_ids: Array.from(managerMountainIds), p_make_manager: managerEnabled });
      if (error) { showToast('error', 'Manager Update Failed', error.message); return; }
      setManagerModalVisible(false); setManagerTarget(null);
      showToast('success', managerEnabled ? 'Manager Updated' : 'Manager Removed', managerEnabled ? 'Mountain access assignments have been saved.' : 'Manager role and mountain assignments were removed.');
      void fetchUsers();
    } catch (error) {
      showToast('error', 'Manager Update Failed', error instanceof Error ? error.message : 'Unable to update manager assignments.');
    } finally {
      setManagerSaving(false);
    }
  };
  
  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
      if (error) { showToast('error', 'Delete Failed', error.message); return; }
      showToast('success', 'User Deleted', 'The user account and all data have been permanently removed.');
      void fetchUsers();
    } catch (error) {
      showToast('error', 'Delete Failed', error instanceof Error ? error.message : 'Unable to delete the user.');
    }
  };
  
  const handleVerifyOrg = async (org: AdminOrgRow, verified: boolean) => {
    setBusyOrgId(org.id);
    try {
      const { error } = await organizationService.adminSetVerified(org.id, verified);
      if (error) { showToast('error', 'Update Failed', error); return; }
      showToast('success', verified ? 'Organization Verified' : 'Verification Removed', `${org.name} has been ${verified ? 'verified' : 'unverified'}.`);
      void fetchOrgs(); void fetchStats();
    } catch (error) {
      showToast('error', 'Update Failed', error instanceof Error ? error.message : 'Unable to update organization verification.');
    } finally {
      setBusyOrgId(null);
    }
  };
  
  const handleAdminCancelEvent = (eventId: string) => {
    const ev = modEvents.find((e) => e.id === eventId);
    if (!ev) return;
    Alert.alert('Force-cancel event?', `"${ev.title}" will be marked cancelled and hidden from public discovery.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: async () => {
        setBusyEventId(eventId);
        try {
          const { error } = await organizationService.adminCancelEvent(eventId);
          if (error) { showToast('error', 'Update Failed', error); return; }
          showToast('success', 'Event Cancelled', 'The organizer has been notified by the status change.');
          void fetchModEvents(); void fetchStats();
        } catch (error) {
          showToast('error', 'Update Failed', error instanceof Error ? error.message : 'Unable to cancel the event.');
        } finally {
          setBusyEventId(null);
        }
      }},
    ]);
  };
  
  const handleAdminReinstateEvent = async (eventId: string) => {
    setBusyEventId(eventId);
    try {
      const { error } = await organizationService.adminReinstateEvent(eventId);
      if (error) { showToast('error', 'Reinstate Failed', error); return; }
      showToast('success', 'Event Reinstated', 'The event is visible again.');
      void fetchModEvents(); void fetchStats();
    } catch (error) {
      showToast('error', 'Reinstate Failed', error instanceof Error ? error.message : 'Unable to reinstate the event.');
    } finally {
      setBusyEventId(null);
    }
  };
  
  const openAttendees = async (event: AdminEventRow) => {
    setAttendeesModalEvent(event); setAttendeesModalVisible(true); setAttendeesLoading(true); setAttendeesError(null);
    try { setAttendeesList(await organizationService.getEventAttendees(event.id)); } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load attendees';
      setAttendeesError(message);
      showToast('error', 'Attendees Failed to Load', message);
    } finally { setAttendeesLoading(false); }
  };
  
  const openDurationModal = (row: AdminSafetyRow) => {
    setDurationTarget(row); setDurationValue(row.event_duration_hours ? String(row.event_duration_hours) : ''); setDurationModalVisible(true);
  };
  
  const submitDuration = async () => {
    if (!durationTarget?.event_id) return;
    const hrs = Number(durationValue);
    if (!Number.isFinite(hrs) || hrs <= 0) { showToast('warning', 'Invalid duration', 'Enter a positive number of hours.'); return; }
    try {
      const { error } = await hikeSafetyService.setEventDuration({ eventId: durationTarget.event_id, durationHours: hrs });
      if (error) { showToast('error', 'Update Failed', error); return; }
      setDurationModalVisible(false); setDurationTarget(null);
      showToast('success', 'Duration set', 'The safety check has been re-planned.');
      void loadAdminSafety();
    } catch (error) {
      showToast('error', 'Update Failed', error instanceof Error ? error.message : 'Unable to update the event duration.');
    }
  };
  
  const confirmDeleteJournal = (entry: AdminJournalRow) => { setDeleteJournalTarget(entry); setDeleteJournalModalVisible(true); };
  
  const submitDeleteJournal = async () => {
    if (!deleteJournalTarget) return;
    try {
      const { error } = await adminService.deleteAdminJournal(deleteJournalTarget.id);
      setDeleteJournalModalVisible(false); setDeleteJournalTarget(null);
      if (error) { showToast('error', 'Delete Failed', error); return; }
      showToast('success', 'Journal Deleted', 'The entry and its photos were removed.');
      void fetchJournal(0);
    } catch (error) {
      showToast('error', 'Delete Failed', error instanceof Error ? error.message : 'Unable to delete the journal entry.');
    }
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
    if (safetyFilter === 'not_home_yet') return row.response_status === 'not_home_yet';
    return true;
  };
  
  const activeAlertCount = [...adminHikes, ...adminEvents].filter((r) => !!r.active_alert_id && !r.seen).length;
  const pendingOrgCount = stats?.pendingOrgs ?? orgs.filter((o) => !o.is_verified).length;
  const contactNumbersByUserId = useMemo(
    () => new Map(users.map((adminUser) => [adminUser.id, adminUser.contact_number])),
    [users]
  );
  const emergencyContactsByUserId = useMemo(
    () => new Map(emergencyContacts.map((row) => [row.user_id, row.contacts])),
    [emergencyContacts]
  );
  const renderSafetyRow = (row: AdminSafetyRow) => (
    <SafetyRow
      key={row.check_id}
      row={row}
      onMarkSeen={markSafetyAlertSeen}
      onSetDuration={openDurationModal}
      contactNumber={contactNumbersByUserId.get(row.subject_user_id) ?? null}
      contactNumberLoading={usersLoading}
      contactNumberError={usersError}
      emergencyContacts={emergencyContactsByUserId.get(row.subject_user_id) ?? []}
      emergencyContactsLoading={emergencyContactsLoading}
      emergencyContactsError={emergencyContactsError}
    />
  );

  // ── Small building blocks ──
  const renderTabIcon = (t: typeof TABS[number]) => {
    const isActive = activeTab === t.id;
    let badge = 0;
    if (t.id === 'orgs') badge = pendingOrgCount;
    if (t.id === 'safety') badge = activeAlertCount;
    if (t.id === 'emergencies') badge = stats?.sosCount ?? 0;
    if (t.id === 'managerChanges') badge = managerChanges.filter((change) => !change.read_at).length;
    return (
      <TouchableOpacity key={t.id} onPress={() => setActiveTab(t.id)} activeOpacity={0.75} style={[ss.railItem, isActive && ss.railItemActive]}>
        <Ionicons name={t.icon} size={16} color={isActive ? ACCENT_GOLD : TEXT_MUTED} />
        <Text style={[ss.railLabel, isActive && ss.railLabelActive]} numberOfLines={1}>{t.label}</Text>
        {badge > 0 && <View style={ss.railBadge}><Text style={ss.railBadgeText}>{badge > 99 ? '99+' : badge}</Text></View>}
      </TouchableOpacity>
    );
  };

  const renderEmpty = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string) => (
    <View style={ss.emptyState}><View style={ss.emptyIconWrap}><Ionicons name={icon} size={44} color={ACCENT_GOLD} /></View><Text style={ss.emptyTitle}>{title}</Text><Text style={ss.emptySubtitle}>{subtitle}</Text></View>
  );

  const renderStat = (label: string, value: number | string, accent?: string) => (
    <View style={ss.statCard} key={label}><Text style={ss.statCardLabel} numberOfLines={1}>{label}</Text><Text style={[ss.statCardValue, accent ? { color: accent } : null]} numberOfLines={1}>{value}</Text></View>
  );

  const renderHeader = (title: string, subtitle?: string, right?: React.ReactNode) => (
    <View style={ss.panelHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.panelTitle} numberOfLines={1}>{title}</Text>{subtitle ? <Text style={ss.panelSubtitle} numberOfLines={1}>{subtitle}</Text> : null}</View>{right ?? null}</View>
  );

  const renderSearch = (value: string, onChangeText: (v: string) => void, placeholder: string) => (
    <View style={ss.searchRow}><View style={ss.searchBox}><Ionicons name="search-outline" size={13} color="rgba(255,255,255,0.32)" /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.28)" style={ss.searchInput} /></View></View>
  );

  const renderFilterChips = <T extends string>(items: ReadonlyArray<{ id: T; label: string }>, current: T, onChange: (id: T) => void, centered = false) => (
    <View style={[ss.chipRow, centered && ss.chipRowCentered]}>
      {items.map((f) => (
        <TouchableOpacity key={f.id} onPress={() => onChange(f.id)} activeOpacity={0.75} style={[ss.chip, current === f.id && ss.chipActive]}>
          <Text style={[ss.chipText, current === f.id && ss.chipTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLoadMore = (hasMore: boolean, loading: boolean, onPress: () => void) => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity onPress={onPress} disabled={loading} style={ss.loadMoreBtn}>
        <Text style={ss.loadMoreText}>{loading ? 'Loading...' : 'Load More'}</Text>
      </TouchableOpacity>
    );
  };

  // ── Modals ──
  const renderModalShell = (visible: boolean, onClose: () => void, title: string, icon: keyof typeof Ionicons.glyphMap, children: React.ReactNode, footer?: React.ReactNode) => (
    <AdminModal visible={visible} onClose={onClose}>
      <View style={ss.modalCard}>
        <View style={ss.modalHeader}>
          <View style={ss.modalTitleRow}><View style={ss.modalIconWrap}><Ionicons name={icon} size={13} color={ACCENT_GOLD} /></View><Text style={ss.modalTitle} numberOfLines={1}>{title}</Text></View>
          <TouchableOpacity onPress={onClose} style={ss.modalClose}><Ionicons name="close" size={13} color={TEXT_MUTED} /></TouchableOpacity>
        </View>
        <ScrollView style={ss.modalBodyScroll} contentContainerStyle={ss.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        {footer ? <View style={ss.modalFooter}>{footer}</View> : null}
      </View>
    </AdminModal>
  );

  const renderModalAction = (label: string, onPress: () => void, variant: 'ghost' | 'primary' | 'danger' = 'ghost', icon?: keyof typeof Ionicons.glyphMap) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[ss.modalActionBtn, variant === 'primary' && ss.modalActionPrimary, variant === 'danger' && ss.modalActionDanger]}>
      {icon ? <Ionicons name={icon} size={12} color={variant === 'primary' ? CHAT_BG : variant === 'danger' ? '#fff' : TEXT_MUTED} /> : null}
      <Text style={[ss.modalActionText, variant === 'primary' && { color: CHAT_BG, fontWeight: '800' }, variant === 'danger' && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );

  const headerSubtitle = activeTab === 'managerChanges'
    ? 'Changes and removals made to managed mountain content'
    : activeTab === 'auditLog'
      ? 'Immutable history of admin actions'
      : activeTab === 'systemHealth'
        ? 'Live status of external services and APIs'
        : statsLoading && !stats ? 'Loading overview…' : undefined;

  return (
    <>
      <UserLocationModal visible={locationModalVisible} user={locationModalUser ? { id: locationModalUser.id, name: locationModalUser.name, email: locationModalUser.email } : null} onClose={() => setLocationModalVisible(false)} />

      <AdminModal visible={journalFilterModalVisible} onClose={() => setJournalFilterModalVisible(false)}>
        <View style={[ss.modalCard, ss.journalFilterModalCard]}>
          <View style={[ss.modalHeader, ss.journalFilterModalHeader]}>
            <View style={ss.modalTitleRow}>
              <View style={ss.modalIconWrap}><Ionicons name="filter-outline" size={13} color={ACCENT_GOLD} /></View>
              <Text style={ss.modalTitle}>Filter journal posts</Text>
            </View>
          </View>
          <ScrollView style={ss.modalBodyScroll} contentContainerStyle={ss.journalFilterModalBody} showsVerticalScrollIndicator={false}>
            <Text style={ss.journalFilterLabel}>VISIBILITY</Text>
            <View style={ss.journalFilterChoiceRow}>
              {([{ id: 'all', label: 'All posts' }, { id: 'public', label: 'Public' }, { id: 'private', label: 'Private' }] as const).map((filter) => (
                <TouchableOpacity key={filter.id} onPress={() => setJournalVisibility(filter.id)} activeOpacity={0.75} style={[ss.chip, ss.journalFilterChip, journalVisibility === filter.id && ss.chipActive]}>
                  <Text style={[ss.chipText, journalVisibility === filter.id && ss.chipTextActive]}>{filter.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={ss.journalFilterSectionHeader}>
              <Text style={ss.journalFilterLabel}>YEAR</Text>
              <TouchableOpacity onPress={() => { setJournalYear(null); setJournalMonth(null); }} activeOpacity={0.75} style={[ss.chip, ss.journalFilterChip, journalYear === null && ss.chipActive]}>
                <Text style={[ss.chipText, journalYear === null && ss.chipTextActive]}>All years</Text>
              </TouchableOpacity>
            </View>
            <View style={ss.journalFilterYearRow}>
              <TouchableOpacity
                onPress={() => setJournalYear((year) => year === null ? new Date().getFullYear() : year - 1)}
                activeOpacity={0.75}
                style={ss.journalFilterYearButton}
                accessibilityRole="button"
                accessibilityLabel="Previous year"
              >
                <Ionicons name="chevron-back" size={14} color={ACCENT_GOLD} />
              </TouchableOpacity>
              <Text style={ss.journalFilterYearText}>{journalYear ?? 'Choose a year'}</Text>
              <TouchableOpacity
                onPress={() => setJournalYear((year) => year === null ? new Date().getFullYear() : Math.min(year + 1, new Date().getFullYear()))}
                activeOpacity={0.75}
                style={ss.journalFilterYearButton}
                accessibilityRole="button"
                accessibilityLabel="Next year"
                accessibilityState={{ disabled: journalYear === null || journalYear >= new Date().getFullYear() }}
                disabled={journalYear === null || journalYear >= new Date().getFullYear()}
              >
                <Ionicons name="chevron-forward" size={14} color={journalYear === null || journalYear >= new Date().getFullYear() ? TEXT_MUTED : ACCENT_GOLD} />
              </TouchableOpacity>
            </View>

            <Text style={ss.journalFilterLabel}>MONTH{journalYear === null ? ' · SELECT A YEAR FIRST' : ''}</Text>
            <View style={ss.journalFilterChoiceRow}>
              {[{ id: null, label: 'Any' }, ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, index) => ({ id: index + 1, label }))].map((month) => {
                const disabled = journalYear === null && month.id !== null;
                const selected = journalMonth === month.id;
                return (
                  <TouchableOpacity
                    key={month.label}
                    onPress={() => setJournalMonth(month.id)}
                    activeOpacity={0.75}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    style={[ss.chip, ss.journalFilterChip, selected && ss.chipActive, disabled && ss.journalFilterDisabled]}
                  >
                    <Text style={[ss.chipText, selected && ss.chipTextActive]}>{month.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </AdminModal>

      {renderModalShell(managerModalVisible, () => { if (!managerSaving) setManagerModalVisible(false); }, managerTarget?.role === 'manager' ? 'Edit mountain manager' : 'Assign mountain manager', 'trail-sign-outline',
        <>
          <View style={ss.userPill}><View style={ss.userPillAvatar}><Text style={ss.userPillAvatarText}>{(managerTarget?.name || managerTarget?.email || '?')[0].toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={ss.userPillName} numberOfLines={1}>{managerTarget?.name || 'No name'}</Text><Text style={ss.userPillEmail} numberOfLines={1}>{managerTarget?.email}</Text></View></View>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setManagerEnabled((enabled) => !enabled)} style={[ss.mgrRoleRow, managerEnabled && ss.mgrRoleRowOn]} accessibilityRole="switch" accessibilityLabel="Mountain manager role" accessibilityState={{ checked: managerEnabled }}>
            <View style={{ flex: 1 }}><Text style={ss.mgrRoleTitle}>Mountain manager</Text><Text style={ss.mgrRoleSub} numberOfLines={2}>{managerEnabled ? 'Can maintain the mountains selected below' : 'Turn on to give manager access'}</Text></View>
            <Switch value={managerEnabled} onValueChange={setManagerEnabled} style={{ transform: [{ scale: 0.78 }] }} trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(111,175,138,0.55)' }} thumbColor={managerEnabled ? '#6FAF8A' : '#B8BEC8'} ios_backgroundColor="rgba(255,255,255,0.12)" />
          </TouchableOpacity>
          <View style={[{ gap: 6 }, !managerEnabled && { opacity: 0.4 }]} pointerEvents={managerEnabled ? 'auto' : 'none'}>
            <View style={ss.mgrSectionRow}><Text style={ss.mgrSectionLabel}>MOUNTAINS · {managerMountainIds.size}/{managerMountains.length}</Text><View style={{ flexDirection: 'row', gap: 12 }}><TouchableOpacity hitSlop={8} onPress={() => setManagerMountainIds(new Set(managerMountains.map((m) => m.id)))}><Text style={ss.mgrLink}>All</Text></TouchableOpacity><TouchableOpacity hitSlop={8} onPress={() => setManagerMountainIds(new Set())}><Text style={ss.mgrLink}>None</Text></TouchableOpacity></View></View>
            <ScrollView style={ss.mgrList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {managerMountains.length === 0 ? <Text style={[ss.mgrRoleSub, { padding: 10, textAlign: 'center' }]}>No mountains found</Text> : managerMountains.map((mountain, index) => {
                const checked = managerMountainIds.has(mountain.id);
                return (
                  <TouchableOpacity key={mountain.id} activeOpacity={0.7} onPress={() => setManagerMountainIds((current) => { const next = new Set(current); if (next.has(mountain.id)) next.delete(mountain.id); else next.add(mountain.id); return next; })} style={[ss.mgrOption, index === managerMountains.length - 1 && { borderBottomWidth: 0 }, checked && ss.mgrOptionOn]} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                    <View style={[ss.mgrCheck, checked && ss.mgrCheckOn]}>{checked && <Ionicons name="checkmark" size={11} color={CHAT_BG} />}</View><Text style={[ss.mgrOptionText, checked && { color: TEXT_PRIMARY, fontWeight: '700' }]} numberOfLines={1}>{mountain.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          {!managerEnabled && managerTarget?.role === 'manager' && <View style={ss.mgrWarn}><Ionicons name="alert-circle-outline" size={13} color="#E07070" /><Text style={ss.mgrWarnText}>Saving removes their manager role and all mountain assignments.</Text></View>}
        </>,
        <>{renderModalAction('Cancel', () => { if (!managerSaving) setManagerModalVisible(false); })}{renderModalAction(managerSaving ? 'Saving…' : !managerEnabled && managerTarget?.role === 'manager' ? 'Remove manager' : 'Save', () => { if (!managerSaving) saveManagerAssignments(); }, !managerEnabled && managerTarget?.role === 'manager' ? 'danger' : 'primary', !managerEnabled && managerTarget?.role === 'manager' ? 'person-remove-outline' : 'checkmark')}</>
      )}

      {renderModalShell(makeAdminModalVisible, () => setMakeAdminModalVisible(false), makeAdminTarget?.is_admin ? 'Remove admin rights' : 'Grant admin rights', makeAdminTarget?.is_admin ? 'shield-outline' : 'shield-checkmark',
        <>
          <View style={ss.userPill}><View style={ss.userPillAvatar}><Text style={ss.userPillAvatarText}>{(makeAdminTarget?.name || makeAdminTarget?.email || '?')[0].toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={ss.userPillName} numberOfLines={1}>{makeAdminTarget?.name || 'No name'}</Text><Text style={ss.userPillEmail} numberOfLines={1}>{makeAdminTarget?.email}</Text></View></View>
          <Text style={ss.modalDesc}>{makeAdminTarget?.is_admin ? 'This user will lose all admin privileges and access to the admin panel.' : 'This user will gain full admin privileges and access to the admin panel.'}</Text>
        </>,
        <>{renderModalAction('Cancel', () => setMakeAdminModalVisible(false))}{renderModalAction(makeAdminTarget?.is_admin ? 'Remove Admin' : 'Make Admin', () => { if (makeAdminTarget) updateUserAdmin(makeAdminTarget.id, !makeAdminTarget.is_admin); setMakeAdminModalVisible(false); setMakeAdminTarget(null); }, 'primary', 'shield-checkmark')}</>
      )}

      {renderModalShell(deleteUserModalVisible, () => setDeleteUserModalVisible(false), 'Delete user', 'trash',
        <>
          <View style={ss.userPill}><View style={[ss.userPillAvatar, { backgroundColor: 'rgba(224,112,112,0.12)', borderColor: 'rgba(224,112,112,0.2)' }]}><Text style={[ss.userPillAvatarText, { color: '#E07070' }]}>{(deleteUserTarget?.name || deleteUserTarget?.email || '?')[0].toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={ss.userPillName} numberOfLines={1}>{deleteUserTarget?.name || 'No name'}</Text><Text style={ss.userPillEmail} numberOfLines={1}>{deleteUserTarget?.email}</Text></View></View>
          <Text style={ss.modalDesc}>This will permanently delete the user and all their hikes, requests, and data. This action cannot be undone.</Text>
        </>,
        <>{renderModalAction('Cancel', () => setDeleteUserModalVisible(false))}{renderModalAction('Delete User', () => { if (deleteUserTarget) deleteUser(deleteUserTarget.id); setDeleteUserModalVisible(false); setDeleteUserTarget(null); }, 'danger', 'trash-outline')}</>
      )}

      {renderModalShell(deleteJournalModalVisible, () => setDeleteJournalModalVisible(false), 'Delete journal entry', 'trash',
        <Text style={ss.modalDesc} numberOfLines={3}>“{deleteJournalTarget?.title || 'Untitled'}” by {deleteJournalTarget?.author_name || deleteJournalTarget?.author_email || 'unknown'} will be removed with its photos.</Text>,
        <>{renderModalAction('Cancel', () => setDeleteJournalModalVisible(false))}{renderModalAction('Delete', submitDeleteJournal, 'danger', 'trash-outline')}</>
      )}

      {renderModalShell(durationModalVisible, () => setDurationModalVisible(false), 'Set event duration', 'timer-outline',
        <>
          <Text style={ss.modalDesc} numberOfLines={2}>“{durationTarget?.title}” has no usable end time. Enter its duration in hours to re-plan the safety check.</Text>
          <View style={ss.inputWrapper}><Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.35)" /><TextInput style={ss.inputField} value={durationValue} onChangeText={setDurationValue} keyboardType="numeric" placeholder="e.g. 6" placeholderTextColor="rgba(255,255,255,0.28)" /></View>
        </>,
        <>{renderModalAction('Cancel', () => setDurationModalVisible(false))}{renderModalAction('Save', submitDuration, 'primary', 'checkmark')}</>
      )}

      <AdminModal visible={attendeesModalVisible} onClose={() => setAttendeesModalVisible(false)}>
          <View style={[ss.modalCard, { maxHeight: 460 }]}>
            <View style={ss.modalHeader}><View style={ss.modalTitleRow}><View style={ss.modalIconWrap}><Ionicons name="people-outline" size={13} color={ACCENT_GOLD} /></View><Text style={ss.modalTitle} numberOfLines={1}>Attendees · {attendeesModalEvent?.title ?? ''}</Text></View><TouchableOpacity onPress={() => setAttendeesModalVisible(false)} style={ss.modalClose}><Ionicons name="close" size={13} color={TEXT_MUTED} /></TouchableOpacity></View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
              {attendeesLoading ? <AdminListSkeleton rows={6} />
                : attendeesError ? <Text style={[ss.emptyStateText, { color: '#E07070' }]}>{attendeesError}</Text>
                : attendeesList.length === 0 ? <Text style={ss.emptyStateText}>No RSVPs yet.</Text>
                : attendeesList.map((a) => (
                  <View key={a.rsvp_id} style={ss.attendeeRow}>
                    <View style={{ flex: 1 }}><Text style={ss.rowTitle} numberOfLines={1}>{a.full_name || a.email || 'Unknown'}</Text><Text style={ss.rowSub} numberOfLines={1}>{a.email ?? '—'} · {a.contact_number ?? 'no phone'}</Text></View>
                    <View style={[ss.miniBadge, { borderColor: a.status === 'confirmed' ? 'rgba(111,175,138,0.35)' : 'rgba(201,169,110,0.35)' }]}><Text style={[ss.miniBadgeText, { color: a.status === 'confirmed' ? '#6FAF8A' : ACCENT_GOLD }]}>{a.status}</Text></View>
                    <Text style={ss.attendeeGuests}>{a.guest_count}×</Text>
                  </View>
                ))}
            </ScrollView>
          </View>
      </AdminModal>

      <SafeAreaView style={ss.screen} edges={['top']}>
        <View
          style={[
            ss.shell,
            {
              paddingLeft: 16,
              paddingRight: 16,
            },
          ]}
        >
          <View style={ss.sidebar}>
            <View style={ss.sidebarHeader}>
              <TouchableOpacity onPress={() => router.replace('/Home')} style={ss.backBtn} hitSlop={8} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Browse as hiker"><Ionicons name="compass-outline" size={16} color={ACCENT_GOLD} /></TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0 }}><Text style={ss.sidebarTitle} numberOfLines={1}>Admin</Text><View style={ss.statusRow}><View style={ss.statusDot} /><Text style={ss.headerStatusText}>Signed in</Text></View></View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.railContent}>{TABS.map(renderTabIcon)}</ScrollView>
            <View style={ss.sidebarFooter}>
              <TouchableOpacity onPress={() => { refreshCurrentTab(); fetchStats(); }} activeOpacity={0.85} style={ss.footerBtn}><Ionicons name="refresh" size={13} color={TEXT_MUTED} /><Text style={ss.footerBtnText}>Refresh</Text></TouchableOpacity>
              <TouchableOpacity onPress={openLogoutConfirm} activeOpacity={0.85} style={[ss.footerBtn, ss.footerBtnDanger]}><Ionicons name="log-out-outline" size={13} color="#E07070" /><Text style={[ss.footerBtnText, { color: '#E07070' }]}>Logout</Text></TouchableOpacity>
            </View>
          </View>

          <View style={ss.main}>
            {renderHeader(TABS.find((t) => t.id === activeTab)?.label ?? 'Admin', headerSubtitle,
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={ss.headerPill}><Text style={ss.headerPillText}>{stats?.totalUsers ?? 0} users</Text></View>
                <View style={[ss.headerPill, { borderColor: 'rgba(224,112,112,0.35)' }]}><Text style={[ss.headerPillText, { color: '#E07070' }]}>{stats?.activeAlerts ?? 0} alerts</Text></View>
              </View>
            )}

            {activeTab === 'overview' && (statsLoading && !stats ? <AdminStatsSkeleton /> : statsError ? <View style={ss.emptyState}><Ionicons name="alert-circle-outline" size={20} color="#E07070" /><Text style={[ss.emptySubtitle, { color: '#E07070' }]}>{statsError}</Text></View> : (
              <ScrollView contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}>
                <Text style={ss.sectionLabel}>SYSTEM TOTALS</Text>
                <View style={ss.statGrid}>{renderStat('Total hikes', stats?.totalHikes ?? 0)}{renderStat('Total users', stats?.totalUsers ?? 0)}{renderStat('Total orgs', stats?.totalOrgs ?? 0)}{renderStat('Total events', stats?.totalEvents ?? 0)}</View>
                <Text style={ss.sectionLabel}>VERIFICATION</Text>
                <View style={ss.statGrid}>{renderStat('Verified orgs', stats?.verifiedOrgs ?? 0, '#6FAF8A')}{renderStat('Pending orgs', stats?.pendingOrgs ?? 0, ACCENT_GOLD)}</View>
                <Text style={ss.sectionLabel}>EVENTS</Text>
                <View style={ss.statGrid}>{renderStat('Published', stats?.publishedEvents ?? 0, '#6FAF8A')}{renderStat('Drafts', stats?.draftEvents ?? 0)}{renderStat('Cancelled', stats?.cancelledEvents ?? 0, '#E07070')}{renderStat('Upcoming', stats?.upcomingEvents ?? 0, '#6FAF8A')}</View>
                <Text style={ss.sectionLabel}>ATTENDANCE</Text>
                <View style={ss.statGrid}>{renderStat('Confirmed RSVPs', stats?.confirmedRsvps ?? 0, '#6FAF8A')}{renderStat('Waitlist', stats?.waitlistRsvps ?? 0, ACCENT_GOLD)}</View>
                <Text style={ss.sectionLabel}>SAFETY</Text>
                <View style={ss.statGrid}>{renderStat('Pending checks', stats?.pendingSafetyChecks ?? 0)}{renderStat('Active alerts', stats?.activeAlerts ?? 0, '#E07070')}{renderStat('SOS (recent)', stats?.sosCount ?? 0, '#E07070')}</View>
              </ScrollView>
            ))}

            {activeTab === 'hikes' && (
              <>{renderSearch(hikeSearch, setHikeSearch, 'Search user or mountain')}
                {hikesLoading ? <AdminListSkeleton rows={6} /> : filteredHikes.length === 0 ? renderEmpty('trail-sign-outline', 'No hikes yet', 'Personal hikes will appear here once hikers schedule them.') : (
                  <FlatList data={filteredHikes} keyExtractor={(h) => h.id} contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}
                    renderItem={({ item: hike, index }) => (
                      <View style={[ss.row, index === filteredHikes.length - 1 && ss.rowLast]}><View style={ss.rowDot} /><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{hike.user?.name || hike.user?.email || 'Unknown'}</Text><Text style={ss.rowSub} numberOfLines={1}>{(hike.mountain_name || hike.mountain_id) ? `${hike.mountain_name || hike.mountain_id} · ` : ''}{hike.start_time} → {hike.end_time} · {hike.tagalongs} along</Text><Text style={ss.rowMeta} numberOfLines={1}>Contact: {hike.contact_number || 'N/A'} · Emergency: {hike.emergency_contact || 'N/A'}</Text></View><Text style={ss.rowMetaRight}>{hike.end_date && hike.end_date !== hike.date ? formatRangeShort(hike.date, hike.end_date) : new Date(hike.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text></View>
                    )} />
                )}
              </>
            )}

            {activeTab === 'users' && (
              <>{renderSearch(userSearch, setUserSearch, 'Search name, email, username')}
                {renderFilterChips([{ id: 'all', label: 'All' }, { id: 'hiker', label: 'Hikers' }, { id: 'organization', label: 'Organizers' }, { id: 'admin', label: 'Admins' }, { id: 'manager', label: 'Managers' }] as const, userRoleFilter, setUserRoleFilter, true)}
                {usersLoading ? <AdminListSkeleton rows={6} marginTop={0} /> : usersError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{usersError}</Text></View> : filteredUsers.length === 0 ? renderEmpty('people-outline', 'No users match', 'Try a different search or role filter.') : (
                  <FlatList data={filteredUsers} keyExtractor={(u) => u.id} contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}
                    renderItem={({ item: u }) => {
                      const role = u.role ?? (u.is_admin ? 'admin' : 'hiker');
                      const online = u.status === 'online';
                      const isOrganization = role === 'organization' || !!u.organization_id;
                      const savedContacts = emergencyContactsByUserId.get(u.id) ?? [];
                      return (
                        <View style={[ss.card, ss.userRow]}>
                          <View style={ss.userInfo}>
                            <View style={ss.userNameRow}>
                              <View style={[ss.onlineDot, { backgroundColor: online ? CHAT_ONLINE : 'rgba(255,255,255,0.2)' }]} />
                              <Text style={ss.rowTitle} numberOfLines={1}>{u.name || 'No name'}</Text>
                              {u.is_admin && <Ionicons name="shield-checkmark" size={11} color={ACCENT_GOLD} style={{ marginLeft: 4 }} />}
                              {isOrganization && <Ionicons name="business" size={11} color="#3FD69D" style={{ marginLeft: 4 }} />}
                              {role === 'manager' && <Ionicons name="trail-sign" size={11} color="#74B7FF" style={{ marginLeft: 4 }} />}
                            </View>
                            <Text style={ss.rowSub} numberOfLines={1}>{u.email}{u.username ? ` · @${u.username}` : ''}</Text>
                            <Text style={ss.rowMeta} numberOfLines={1}>{role}{u.organization_id ? ' · org' : ''}{u.is_verified ? ' · verified' : ''} · {u.contact_number || 'no phone'}</Text>
                            <Text style={ss.rowMeta}>Joined {new Date(u.created_at).toLocaleDateString()}{u.last_seen ? ` · seen ${new Date(u.last_seen).toLocaleDateString()}` : ''}</Text>
                            <View style={ss.userEmergencyContacts}>
                              <Text style={ss.userEmergencyContactsLabel}>EMERGENCY CONTACTS</Text>
                              {emergencyContactsLoading
                                ? <Text style={ss.rowMeta}>Loading saved contacts…</Text>
                                : emergencyContactsError
                                  ? <Text style={[ss.rowMeta, { color: '#E07070' }]}>Unable to load saved contacts</Text>
                                  : savedContacts.length === 0
                                    ? <Text style={ss.rowMeta}>None saved</Text>
                                    : savedContacts.map((contact) => (
                                      <Text key={contact.id} style={ss.userEmergencyContact} numberOfLines={2}>
                                        {contact.name}{contact.relationship ? ` · ${contact.relationship}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}
                                      </Text>
                                    ))}
                            </View>
                          </View>
                          <View style={ss.userActions}>
                            <TouchableOpacity onPress={() => { setLocationModalUser(u); setLocationModalVisible(true); }} style={ss.iconAction}><Ionicons name="location-outline" size={16} color={ACCENT_GOLD} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => { if (u.id === user?.id) { showToast('warning', 'Not Allowed', 'You cannot change your own admin status.'); return; } setMakeAdminTarget(u); setMakeAdminModalVisible(true); }} style={ss.iconAction}><Ionicons name={u.is_admin ? 'shield-checkmark' : 'shield-outline'} size={16} color={u.is_admin ? ACCENT_GOLD : TEXT_MUTED} /></TouchableOpacity>
                            {!u.is_admin && <TouchableOpacity onPress={() => void openManagerAssignments(u)} style={ss.iconAction} accessibilityLabel={u.role === 'manager' ? 'Edit mountain manager assignments' : 'Make user a mountain manager'}><Ionicons name="trail-sign-outline" size={16} color={u.role === 'manager' ? ACCENT_GOLD : TEXT_MUTED} /></TouchableOpacity>}
                            <TouchableOpacity onPress={() => { if (u.id === user?.id) { showToast('warning', 'Not Allowed', 'You cannot delete your own account from here.'); return; } setDeleteUserTarget(u); setDeleteUserModalVisible(true); }} style={ss.iconAction}><Ionicons name="trash-outline" size={16} color="#E07070" /></TouchableOpacity>
                          </View>
                        </View>
                      );
                    }} />
                )}
              </>
            )}

            {activeTab === 'orgs' && (
              <>
                {renderFilterChips([{ id: 'pending', label: 'Pending' }, { id: 'verified', label: 'Verified' }, { id: 'all', label: 'All' }] as const, orgFilter, setOrgFilter, true)}
                {orgsLoading ? <AdminListSkeleton rows={6} marginTop={0} /> : orgsError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{orgsError}</Text></View> : filteredOrgs.length === 0 ? renderEmpty('business-outline', orgFilter === 'pending' ? 'No pending organizations' : `No ${orgFilter} organizations`, 'New organizations will show up here for verification.') : (
                <FlatList data={filteredOrgs} keyExtractor={(o) => o.id} contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}
                    renderItem={({ item: o }) => (
                      <View style={ss.card}><View style={ss.cardHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{o.name}</Text><Text style={ss.rowSub} numberOfLines={1}>{o.contact_email || o.slug}{o.website ? ` · ${o.website}` : ''}</Text></View><View style={[ss.statusBadge, o.is_verified ? ss.statusApproved : ss.statusPending]}><Text style={o.is_verified ? ss.statusTextApproved : ss.statusText}>{o.is_verified ? 'verified' : 'pending'}</Text></View></View>
                        {o.description ? <Text style={ss.rowMeta} numberOfLines={2}>{o.description}</Text> : null}
                        <Text style={ss.rowMeta}>Registered {new Date(o.created_at).toLocaleDateString()}{o.contact_phone ? ` · ${o.contact_phone}` : ''}</Text>
                        <Text style={[ss.rowMeta, { color: ACCENT_GOLD, fontWeight: '600' }]}>{o.member_count} member{o.member_count === 1 ? '' : 's'} · {o.event_count} event{o.event_count === 1 ? '' : 's'}</Text>
                        <View style={ss.cardActions}>{!o.is_verified ? <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => handleVerifyOrg(o, true)} disabled={busyOrgId === o.id}><Ionicons name="shield-checkmark" size={12} color="#6FAF8A" /><Text style={ss.smallBtnSuccessText}>{busyOrgId === o.id ? 'Verifying…' : 'Verify'}</Text></TouchableOpacity> : <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => handleVerifyOrg(o, false)} disabled={busyOrgId === o.id}><Ionicons name="shield-outline" size={12} color="#E07070" /><Text style={ss.smallBtnDangerText}>{busyOrgId === o.id ? 'Updating…' : 'Remove verification'}</Text></TouchableOpacity>}</View>
                      </View>
                    )} />
                )}
              </>
            )}

            {activeTab === 'events' && (
              <>{renderFilterChips([{ id: 'published', label: 'Published' }, { id: 'draft', label: 'Drafts' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'completed', label: 'Completed' }, { id: 'all', label: 'All' }] as const, eventFilter, setEventFilter, true)}
                {modEventsLoading ? <AdminListSkeleton rows={6} marginTop={0} /> : modEventsError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{modEventsError}</Text></View> : filteredModEvents.length === 0 ? renderEmpty('calendar-outline', `No ${eventFilter} events`, 'Events will show up here once organizers post them.') : (
                  <FlatList data={filteredModEvents} keyExtractor={(e) => e.id} contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}
                    renderItem={({ item: e }) => {
                      const hasCap = e.capacity !== null && e.capacity !== undefined;
                      const pct = hasCap && (e.capacity as number) > 0 ? Math.min(100, (e.rsvp_confirmed / (e.capacity as number)) * 100) : 0;
                      return (
                        <View style={ss.card}>
                          <View style={ss.cardHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{e.title}</Text><Text style={ss.rowSub} numberOfLines={1}>{e.organization_name ?? 'Unknown org'}{e.organization_verified ? ' · verified' : ''} · {e.end_date && e.end_date !== e.event_date ? `${e.event_date} – ${e.end_date}` : e.event_date}</Text></View><View style={[ss.statusBadge, e.status === 'published' ? ss.statusApproved : e.status === 'cancelled' ? ss.statusRejected : ss.statusPending]}><Text style={e.status === 'published' ? ss.statusTextApproved : e.status === 'cancelled' ? ss.statusTextRejected : ss.statusText}>{e.status}</Text></View></View>
                          <Text style={ss.rowMeta} numberOfLines={2}>{e.difficulty} · {e.start_time}{e.end_time ? ` – ${e.end_time}` : e.duration_hours ? ` · ${e.duration_hours}h` : ''} · {e.meeting_point}</Text>
                          <Text style={ss.rowMeta} numberOfLines={1}>{e.is_public ? 'Public' : 'Private'} · {e.allow_walkins ? 'Walk-ins allowed' : 'No walk-ins'} · capacity {e.capacity ?? '∞'}</Text>
                          <View style={ss.attendRow}><Text style={ss.attendLabel}>Attending</Text><Text style={ss.attendValue}>{e.rsvp_confirmed}{hasCap ? <Text style={ss.attendSub}>{` / ${e.capacity}`}</Text> : null}</Text></View>
                          {hasCap && <View style={ss.meter}><View style={[ss.meterFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#E67E22' : '#6FAF8A' }]} /></View>}
                          {e.rsvp_waitlist > 0 && <Text style={ss.waitlistText}>{e.rsvp_waitlist} on the waitlist</Text>}
                          <View style={ss.cardActions}>
                            {(e.status === 'published' || e.status === 'draft') && <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => handleAdminCancelEvent(e.id)} disabled={busyEventId === e.id}><Ionicons name="close-circle-outline" size={12} color="#E07070" /><Text style={ss.smallBtnDangerText}>{busyEventId === e.id ? 'Cancelling…' : 'Force-cancel'}</Text></TouchableOpacity>}
                            {e.status === 'cancelled' && <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => handleAdminReinstateEvent(e.id)} disabled={busyEventId === e.id}><Ionicons name="refresh" size={12} color="#6FAF8A" /><Text style={ss.smallBtnSuccessText}>{busyEventId === e.id ? 'Reinstating…' : 'Reinstate'}</Text></TouchableOpacity>}
                            <TouchableOpacity style={[ss.smallBtn, ss.smallBtnGold]} onPress={() => openAttendees(e)}><Ionicons name="people-outline" size={12} color={ACCENT_GOLD} /><Text style={ss.smallBtnGoldText}>Attendees</Text></TouchableOpacity>
                          </View>
                        </View>
                      );
                    }} />
                )}
              </>
            )}

            {activeTab === 'safety' && (
              <>{renderFilterChips([{ id: 'all', label: 'All' }, { id: 'active', label: 'Active alerts' }, { id: 'needs_duration', label: 'Needs duration' }, { id: 'responded', label: 'Responded' }, { id: 'not_home_yet', label: 'Not home yet' }] as const, safetyFilter, setSafetyFilter, true)}
                <ScrollView contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}>
                  <Text style={ss.sectionLabel}>PERSONAL HIKES</Text>
                  {adminLoading ? <AdminListSkeleton rows={6} marginTop={0} /> : adminError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{adminError}</Text></View> : adminHikes.filter(matchesSafetyFilter).length === 0 ? <View style={ss.emptyState}><Text style={ss.emptyStateText}>No hike safety checks match.</Text></View> : adminHikes.filter(matchesSafetyFilter).map(renderSafetyRow)}
                  <Text style={ss.sectionLabel}>ORGANIZATION EVENTS</Text>
                  {adminLoading ? null : adminEvents.filter(matchesSafetyFilter).length === 0 ? <View style={ss.emptyState}><Text style={ss.emptyStateText}>No event safety checks match.</Text></View> : adminEvents.filter(matchesSafetyFilter).map(renderSafetyRow)}
                </ScrollView>
              </>
            )}

            {activeTab === 'emergencies' && (
              <ScrollView contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}>
                <View style={ss.alertBanner}><Ionicons name="alert-circle" size={16} color="#E07070" /><Text style={ss.alertBannerText}>{sosRows.length} recent SOS ping{sosRows.length === 1 ? '' : 's'}. Contact hikers and authorities if any are live.</Text></View>
                {sosLoading ? <AdminListSkeleton rows={6} /> : sosError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{sosError}</Text></View> : sosRows.length === 0 ? renderEmpty('shield-checkmark-outline', 'No SOS pings', 'Recent SOS locations will appear here.') : (
                  sosRows.map((row) => (
                    <View key={String(row.id)} style={[ss.card, { borderColor: 'rgba(224,112,112,0.35)' }]}>
                      <View style={ss.cardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={ss.rowTitle} numberOfLines={1}>SOS · {new Date(row.timestamp).toLocaleString()}</Text>
                          <Text style={ss.rowSub} numberOfLines={1}>{row.latitude.toFixed(5)}, {row.longitude.toFixed(5)} · ±{row.accuracy?.toFixed(0) ?? '?'}m</Text>
                        </View>
                        <View style={[ss.statusBadge, ss.statusRejected]}><Text style={ss.statusTextRejected}>SOS</Text></View>
                      </View>
                      {row.altitude != null && <Text style={ss.rowMeta}>Altitude {row.altitude.toFixed(0)}m</Text>}
                      {row.user_name && <Text style={ss.rowMeta}>User: {row.user_name}</Text>}
                      {!row.user_name && row.user_id && <Text style={ss.rowMeta}>User ID: {row.user_id}</Text>}
                      <View style={ss.cardActions}>
                        <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => resolveSos(String(row.id))}>
                          <Ionicons name="checkmark-circle-outline" size={12} color="#6FAF8A" />
                          <Text style={ss.smallBtnSuccessText}>Mark Resolved</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
                <Text style={ss.sectionLabel}>SAVED EMERGENCY CONTACTS</Text>
                <Text style={ss.rowMeta}>These are user-provided contact details for emergency response. Use only when needed.</Text>
                {emergencyContactsLoading ? <AdminListSkeleton rows={6} /> : emergencyContactsError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{emergencyContactsError}</Text></View> : emergencyContacts.length === 0 ? renderEmpty('people-outline', 'No saved contacts', 'Users have not added emergency contacts.') : (
                  emergencyContacts.map((row) => (
                    <View key={row.user_id} style={ss.card}>
                      <View style={ss.cardHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{row.user_name || row.user_email || row.user_id}</Text>{row.user_email ? <Text style={ss.rowSub} numberOfLines={1}>{row.user_email}</Text> : null}</View><Text style={ss.rowMeta}>Updated {new Date(row.updated_at).toLocaleDateString()}</Text></View>
                      {row.contacts.map((contact) => <View key={contact.id} style={ss.attendeeRow}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle}>{contact.name}</Text><Text style={ss.rowSub}>{[contact.relationship, contact.phone].filter(Boolean).join(' · ')}</Text></View></View>)}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {activeTab === 'managerChanges' && (
              <>
                {managerChanges.length === 0 ? renderEmpty('notifications-outline', 'No manager updates', 'Updates made by mountain managers will be listed here.') : (
                  <FlatList data={managerChanges} keyExtractor={(change) => change.id} contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}
                    renderItem={({ item: change }) => (
                      <View style={[ss.card, !change.read_at && ss.cardAlert]}>
                        <View style={ss.cardHeader}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={ss.rowTitle}>{getManagerChangeTitle(change)}</Text>
                            <Text style={ss.rowSub} numberOfLines={1}>{getManagerChangeSubtitle(change)}</Text>
                          </View>
                        </View>
                        <Text style={ss.rowMeta}>{new Date(change.created_at).toLocaleString()}</Text>
                      </View>
                    )} />
                )}
              </>
            )}

            {activeTab === 'auditLog' && (
              <>
                {auditLoading ? <AdminListSkeleton rows={6} /> : auditLog.length === 0 ? renderEmpty('list-outline', 'No actions logged', 'Admin actions will appear here.') : (
                  <FlatList data={auditLog} keyExtractor={(item) => String(item.id)} contentContainerStyle={ss.mainContent} showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <View style={ss.row}><View style={ss.rowDot} /><View style={{ flex: 1 }}><Text style={ss.rowTitle}>{item.action.replace(/_/g, ' ').toUpperCase()}</Text><Text style={ss.rowSub}>By: {item.actor?.full_name || item.actor?.email || 'System'}</Text><Text style={ss.rowMeta}>Target: {item.target_type} ({item.target_id})</Text></View><Text style={ss.rowMetaRight}>{new Date(item.created_at).toLocaleDateString()}</Text></View>
                    )} />
                )}
              </>
            )}

            {activeTab === 'systemHealth' && (
              <>
                {healthLoading ? <AdminListSkeleton rows={6} avatar={false} /> : systemHealth ? (
                  <ScrollView contentContainerStyle={ss.mainContent}>
                    {Object.entries(systemHealth).map(([key, data]) => (
                      <View key={key} style={ss.card}>
                        <View style={[ss.cardHeader, { alignItems: 'center' }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[ss.rowTitle, { textTransform: 'capitalize' }]}>{key.replace(/([A-Z])/g, ' $1')}</Text>
                            <Text style={ss.rowSub}>{data.message}</Text>
                          </View>
                          <View style={[ss.statusBadge, data.status === 'ok' ? ss.statusApproved : data.status === 'error' ? ss.statusRejected : ss.statusPending]}>
                            <Text style={[ss.statusText, data.status === 'ok' ? ss.statusTextApproved : data.status === 'error' ? ss.statusTextRejected : ss.statusText]}>{data.status}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : <View style={ss.emptyState}><Text style={ss.emptyStateText}>No health data available.</Text></View>}
              </>
            )}

            {activeTab === 'moderation' && (
              <><View style={[ss.chipRow, ss.chipRowCentered]}>
                  <View style={ss.journalTabControls}>
                    <TouchableOpacity onPress={() => setModerationTab('journal')} activeOpacity={0.75} style={[ss.chip, moderationTab === 'journal' && ss.chipActive]}>
                      <Text style={[ss.chipText, moderationTab === 'journal' && ss.chipTextActive]}>Journal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setModerationTab('journal');
                        setJournalFilterModalVisible(true);
                      }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Filter journal posts"
                      style={ss.journalFilterButton}
                    >
                      <Ionicons name="filter-outline" size={13} color={moderationTab === 'journal' ? ACCENT_GOLD : TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                  {([{ id: 'discoveries', label: 'Discoveries' }, { id: 'reports', label: 'Chat Reports' }] as const).map((tab) => (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setModerationTab(tab.id)}
                      activeOpacity={0.75}
                      style={[ss.chip, moderationTab === tab.id && ss.chipActive]}
                    >
                      <Text style={[ss.chipText, moderationTab === tab.id && ss.chipTextActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {moderationTab === 'journal' && (
                  <>{journalLoading && journal.length === 0 ? <AdminListSkeleton rows={6} marginTop={0} /> : journalError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{journalError}</Text></View> : journal.length === 0 ? renderEmpty('book-outline', 'No journal entries', 'Journal entries will appear here for moderation.') : (
                      <FlatList data={journal} keyExtractor={(j) => j.id} contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}
                        renderItem={({ item: j }) => (
                          <View style={ss.card}><View style={ss.cardHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{j.title || 'Untitled'}</Text><Text style={ss.rowSub} numberOfLines={1}>{j.author_name || j.author_email || 'Unknown'} · {new Date(j.created_at).toLocaleDateString()}</Text></View><View style={[ss.statusBadge, j.is_public ? ss.statusApproved : ss.statusPending]}><Text style={j.is_public ? ss.statusTextApproved : ss.statusText}>{j.is_public ? 'public' : 'private'}</Text></View></View><Text style={ss.rowMeta} numberOfLines={2}>{j.content}</Text><Text style={ss.rowMeta}>{j.images.length} photo{j.images.length === 1 ? '' : 's'} · ♥ {j.like_count}{j.rating ? ` · ★ ${j.rating}` : ''}</Text><View style={ss.cardActions}><TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => confirmDeleteJournal(j)}><Ionicons name="trash-outline" size={12} color="#E07070" /><Text style={ss.smallBtnDangerText}>Delete entry</Text></TouchableOpacity></View></View>
                        )}
                        ListFooterComponent={renderLoadMore(journalHasMore, journalLoading, () => fetchJournal(journalPage + 1))} />
                    )}
                  </>
                )}
                {moderationTab === 'discoveries' && (
                  <>{discoveriesLoading && discoveries.length === 0 ? <AdminListSkeleton rows={6} marginTop={0} /> : discoveriesError ? <View style={ss.emptyState}><Text style={[ss.emptyStateText, { color: '#E07070' }]}>{discoveriesError}</Text></View> : discoveries.length === 0 ? renderEmpty('leaf-outline', 'No discoveries', 'Species discoveries will appear here.') : (
                      <FlatList data={discoveries} keyExtractor={(d) => String(d.id)} contentContainerStyle={[ss.mainContent, ss.filteredListContent]} showsVerticalScrollIndicator={false}
                        renderItem={({ item: d }) => (
                          <View style={ss.row}><View style={ss.rowDot} /><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{d.species_name || d.species_scientific || `Species #${d.species_id}`}</Text><Text style={ss.rowSub} numberOfLines={1}>{d.species_scientific ?? '—'} · mountain {d.mountain_id}</Text><Text style={ss.rowMeta} numberOfLines={1}>user {d.user_id}</Text></View><Text style={ss.rowMetaRight}>{new Date(d.discovered_at).toLocaleDateString()}</Text></View>
                        )}
                        ListFooterComponent={renderLoadMore(discoveriesHasMore, discoveriesLoading, () => fetchDiscoveries(discoveriesPage + 1))} />
                    )}
                  </>
                )}
                {moderationTab === 'reports' && (
                  <>{chatReportsLoading ? <AdminListSkeleton rows={6} marginTop={0} /> : chatReports.length === 0 ? renderEmpty('flag-outline', 'No reports', 'User-submitted chat reports will appear here.') : (
                      <FlatList data={chatReports} keyExtractor={(r) => String(r.id)} contentContainerStyle={[ss.mainContent, ss.filteredListContent]}
                        renderItem={({ item: r }) => (
                          <View style={ss.card}>
                            <View style={ss.cardHeader}><View style={{ flex: 1 }}><Text style={ss.rowTitle}>Reported Message</Text><Text style={ss.rowSub}>{r.reason}</Text></View><View style={[ss.statusBadge, r.status === 'open' ? ss.statusRejected : ss.statusApproved]}><Text style={[ss.statusText, r.status === 'open' ? ss.statusTextRejected : ss.statusTextApproved]}>{r.status}</Text></View></View>
                            <Text style={[ss.rowMeta, { color: '#fff', marginVertical: 6 }]}>"{r.chat_messages?.content}"</Text>
                            <Text style={ss.rowMeta}>Reported by: {r.reporter?.full_name || r.reporter?.email}</Text>
                            {r.status === 'open' && (
                              <View style={ss.cardActions}>
                                <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => { void resolveChatReport(String(r.id), 'resolved'); }}><Text style={ss.smallBtnSuccessText}>Resolve</Text></TouchableOpacity>
                                <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={() => { void resolveChatReport(String(r.id), 'dismissed'); }}><Text style={ss.smallBtnDangerText}>Dismiss</Text></TouchableOpacity>
                              </View>
                            )}
                          </View>
                        )} />
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </SafeAreaView>

      {showLogoutConfirm && (
        <Modal
          transparent
          visible
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={dismissLogoutConfirm}
        >
          <View style={ss.logoutRoot}>
            <Animated.View style={[StyleSheet.absoluteFill, ss.logoutScrim, { opacity: logoutModalOpacity }]}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={dismissLogoutConfirm}
                accessibilityRole="button"
                accessibilityLabel="Cancel sign out"
              />
            </Animated.View>

            <Animated.View
              accessibilityViewIsModal
              style={[
                ss.logoutCard,
                {
                  width: Math.min(width - 48, 330),
                  opacity: logoutModalOpacity,
                  transform: [
                    { translateY: logoutModalY },
                    { scale: logoutModalOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                  ],
                },
              ]}
            >
              <View pointerEvents="none" style={ss.logoutContourAnchor}>
                {[96, 150, 210, 280].map((w, i) => (
                  <View
                    key={w}
                    style={{
                      position: 'absolute',
                      left: -w / 2,
                      top: -(w * 0.62) / 2,
                      width: w,
                      height: w * 0.62,
                      borderRadius: w / 2,
                      borderWidth: 1,
                      borderColor: `rgba(224,112,112,${0.14 - i * 0.03})`,
                      transform: [{ rotate: `${i % 2 === 0 ? -8 : 6}deg` }],
                    }}
                  />
                ))}
              </View>

              <View style={ss.logoutIconRing}>
                <View style={ss.logoutIconCircle}>
                  <Ionicons name="log-out-outline" size={26} color="#E07070" />
                </View>
              </View>

              <Text style={ss.logoutTitle} accessibilityRole="header">Sign out of Saka?</Text>
              <Text style={ss.logoutMsg}>You’ll be taken back to the login screen.</Text>

              <View style={ss.logoutPerf} />

              <View style={ss.logoutActions}>
                <Pressable
                  onPress={dismissLogoutConfirm}
                  accessibilityRole="button"
                  accessibilityLabel="Stay signed in"
                  style={({ pressed }) => [ss.logoutStay, pressed && { opacity: 0.7 }]}
                >
                  <Text style={ss.logoutStayText}>Stay</Text>
                </Pressable>
                <Pressable
                  onPress={confirmLogout}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  style={({ pressed }) => [
                    ss.logoutConfirm,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Text style={ss.logoutConfirmText}>Sign out</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      <Toast ref={toastRef} topOffset={insets.top + 10} widthRatio={0.78} />
    </>
  );
}

/* ─────────── SafetyRow ─────────── */
function SafetyRow({
  row,
  onMarkSeen,
  onSetDuration,
  contactNumber,
  contactNumberLoading,
  contactNumberError,
  emergencyContacts,
  emergencyContactsLoading,
  emergencyContactsError,
}: {
  row: AdminSafetyRow;
  onMarkSeen: (id: string) => Promise<void>;
  onSetDuration: (row: AdminSafetyRow) => void;
  contactNumber: string | null;
  contactNumberLoading: boolean;
  contactNumberError: string | null;
  emergencyContacts: AdminEmergencyContactRow['contacts'];
  emergencyContactsLoading: boolean;
  emergencyContactsError: string | null;
}) {
  const isActive = !!row.active_alert_id && !row.seen;
  const statusColor = row.response_status === 'got_home' ? '#6FAF8A' : row.response_status === 'not_home_yet' ? '#E07070' : TEXT_MUTED;
  return (
    <View style={[ss.card, isActive && ss.cardAlert]}>
      <View style={ss.cardHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={ss.rowTitle} numberOfLines={1}>{row.subject_name ?? row.subject_email ?? row.subject_user_id}</Text><Text style={ss.rowSub} numberOfLines={1}>{row.title}{row.event_id ? ` · event ${row.event_id.slice(0, 8)}…` : ''}</Text></View><View style={[ss.statusBadge, { borderColor: statusColor, backgroundColor: 'transparent' }]}><Text style={[ss.statusText, { color: statusColor, textTransform: 'none' }]}>{row.response_status.replace(/_/g, ' ')}</Text></View></View>
      <Text style={ss.rowMeta}>Planned finish {new Date(row.planned_finish_at).toLocaleString()}{row.responded_at ? ` · Responded ${new Date(row.responded_at).toLocaleTimeString()}` : ''}</Text>
      <Text style={ss.rowMeta}>Contact number: {contactNumberLoading ? 'Loading…' : contactNumberError ? 'Unable to load' : contactNumber || 'Not provided'}</Text>
      <Text style={ss.rowMeta}>
        Emergency contacts: {emergencyContactsLoading
          ? 'Loading…'
          : emergencyContactsError
            ? 'Unable to load'
            : emergencyContacts.length
              ? emergencyContacts.map((contact) => [contact.name, contact.relationship, contact.phone].filter(Boolean).join(' · ')).join('; ')
              : 'None saved'}
      </Text>
      {row.event_duration_hours ? <Text style={ss.rowMeta}>Duration {row.event_duration_hours}h</Text> : null}
      {row.needs_duration && <Text style={[ss.rowMeta, { color: ACCENT_GOLD }]}>Needs duration</Text>}
      {row.active_alert_id && (
        <View style={ss.cardActions}><View style={{ flex: 1 }}><Text style={{ color: isActive ? '#E07070' : TEXT_MUTED, fontSize: 10.5, fontWeight: '700' }}>{row.active_alert_type === 'not_home_yet' ? 'Not home yet' : 'No response (1h)'}{row.active_alert_triggered_at ? ` · ${new Date(row.active_alert_triggered_at).toLocaleTimeString()}` : ''}</Text></View>{isActive && row.response_status !== 'got_home' && <TouchableOpacity style={[ss.smallBtn, ss.smallBtnSuccess]} onPress={() => { void onMarkSeen(row.active_alert_id!); }}><Ionicons name="checkmark" size={12} color="#6FAF8A" /><Text style={ss.smallBtnSuccessText}>Mark seen</Text></TouchableOpacity>}</View>
      )}
      {row.needs_duration && row.event_id && (
        <View style={ss.cardActions}><TouchableOpacity style={[ss.smallBtn, ss.smallBtnGold]} onPress={() => onSetDuration(row)}><Ionicons name="timer-outline" size={12} color={ACCENT_GOLD} /><Text style={ss.smallBtnGoldText}>Set duration</Text></TouchableOpacity></View>
      )}
    </View>
  );
}

/* ─────────── Styles ─────────── */
const ss = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CHAT_BG }, shell: { flex: 1, flexDirection: 'row', backgroundColor: CHAT_BG },

  // Sidebar (icon rail)
  sidebar: { width: SIDEBAR_W, borderRightWidth: 1, borderRightColor: CHAT_BORDER, backgroundColor: CHAT_BG },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CHAT_BORDER },
  backBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sidebarTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CHAT_ONLINE },
  headerStatusText: { fontSize: 9.5, color: TEXT_MUTED, fontWeight: '500', letterSpacing: 0.2 },
  railContent: { padding: 8, gap: 2 },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 34, borderRadius: 9 },
  railItemActive: { backgroundColor: 'rgba(201,169,110,0.12)' },
  railLabel: { flex: 1, color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  railLabelActive: { color: TEXT_PRIMARY },
  railBadge: { minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: '#E07070', alignItems: 'center', justifyContent: 'center' },
  railBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  sidebarFooter: { padding: 8, gap: 6, borderTopWidth: 1, borderTopColor: CHAT_BORDER },
  footerBtn: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  footerBtnDanger: { backgroundColor: 'rgba(224,112,112,0.06)', borderColor: 'rgba(224,112,112,0.2)' },
  footerBtnText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  main: { flex: 1, minWidth: 0, backgroundColor: CHAT_BG },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: CHAT_BORDER },
  panelTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', letterSpacing: -0.1 },
  panelSubtitle: { color: TEXT_MUTED, fontSize: 10.5, marginTop: 1 },
  headerPill: { height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  headerPillText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },
  mainContent: { padding: 14, gap: 8 },
  filteredListContent: { paddingTop: 0 },
  searchRow: { paddingHorizontal: 14, paddingTop: 12 },
  searchBox: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 12, paddingVertical: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  chipRowCentered: { justifyContent: 'center', paddingBottom: 12 },
  journalTabControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  journalFilterButton: { width: 26, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  journalFilterModalCard: { maxWidth: 340, maxHeight: '75%' },
  journalFilterModalHeader: { paddingHorizontal: 12, paddingVertical: 9 },
  journalFilterModalBody: { padding: 10, gap: 8 },
  journalFilterLabel: { color: TEXT_MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  journalFilterChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  journalFilterChip: { height: 22, paddingHorizontal: 7 },
  journalFilterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journalFilterYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  journalFilterYearButton: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  journalFilterYearText: { minWidth: 80, color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  journalFilterDisabled: { opacity: 0.35 },
  chip: { height: 24, paddingHorizontal: 9, borderRadius: 8, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  chipActive: { backgroundColor: 'rgba(201,169,110,0.12)', borderColor: 'rgba(201,169,110,0.35)' },
  chipText: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '600' },
  chipTextActive: { color: ACCENT_GOLD },
  sectionLabel: { color: 'rgba(255,255,255,0.32)', fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginTop: 6, marginBottom: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statCardLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 8.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statCardValue: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowLast: { borderBottomWidth: 0 }, rowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT_GOLD },
  rowTitle: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  rowSub: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 }, rowMeta: { color: 'rgba(255,255,255,0.32)', fontSize: 9.5, marginTop: 2 }, rowMetaRight: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '600' },
  userRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  userInfo: { flex: 1, minWidth: 0, gap: 2 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, onlineDot: { width: 7, height: 7, borderRadius: 4 },
  userActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  userEmergencyContacts: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 2 },
  userEmergencyContactsLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 8.5, fontWeight: '700', letterSpacing: 0.5 },
  userEmergencyContact: { color: TEXT_MUTED, fontSize: 10, lineHeight: 14 },
  iconAction: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  card: { backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, gap: 4 },
  cardAlert: { borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'rgba(201,169,110,0.04)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, cardActions: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusPending: { backgroundColor: 'rgba(201,169,110,0.1)', borderColor: 'rgba(201,169,110,0.3)' },
  statusApproved: { backgroundColor: 'rgba(111,175,138,0.1)', borderColor: 'rgba(111,175,138,0.3)' },
  statusRejected: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.3)' },
  statusText: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: ACCENT_GOLD },
  statusTextApproved: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: '#6FAF8A' },
  statusTextRejected: { fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize', color: '#E07070' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  smallBtnSuccess: { backgroundColor: 'rgba(111,175,138,0.1)', borderColor: 'rgba(111,175,138,0.3)' },
  smallBtnDanger: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.3)' },
  smallBtnGold: { backgroundColor: 'rgba(201,169,110,0.1)', borderColor: 'rgba(201,169,110,0.3)' },
  smallBtnSuccessText: { color: '#6FAF8A', fontSize: 10.5, fontWeight: '700' },
  smallBtnDangerText: { color: '#E07070', fontSize: 10.5, fontWeight: '700' },
  smallBtnGoldText: { color: ACCENT_GOLD, fontSize: 10.5, fontWeight: '700' },
  loadMoreBtn: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { color: ACCENT_GOLD, fontSize: 12, fontWeight: '700' },
  attendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  attendLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  attendValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '800' },
  attendSub: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '600' },
  meter: { height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: 2 }, waitlistText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '600', marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: CHAT_BG },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(201,169,110,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 24 },
  emptyStateText: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center' },
  modalCard: { width: '100%', maxWidth: 460, flexShrink: 1, backgroundColor: CHAT_BG, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CHAT_BORDER },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  modalClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  modalBodyScroll: { flexShrink: 1 }, modalBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  modalDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },
  mgrRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 10, paddingRight: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  mgrRoleRowOn: { borderColor: 'rgba(111,175,138,0.35)', backgroundColor: 'rgba(111,175,138,0.07)' },
  mgrRoleTitle: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' }, mgrRoleSub: { color: TEXT_MUTED, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  mgrSectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mgrSectionLabel: { color: TEXT_MUTED, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7 }, mgrLink: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },
  mgrList: { maxHeight: 190, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' },
  mgrOption: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  mgrOptionOn: { backgroundColor: 'rgba(201,169,110,0.06)' }, mgrOptionText: { flex: 1, color: TEXT_MUTED, fontSize: 12, fontWeight: '500' },
  mgrCheck: { width: 17, height: 17, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  mgrCheckOn: { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD },
  mgrWarn: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, borderRadius: 8, backgroundColor: 'rgba(224,112,112,0.08)', borderWidth: 1, borderColor: 'rgba(224,112,112,0.25)' },
  mgrWarnText: { flex: 1, color: '#E07070', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  modalActionPrimary: { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD },
  modalActionDanger: { backgroundColor: '#E07070', borderColor: '#E07070' },
  modalActionText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  inputField: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, paddingVertical: 0 },
  userPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 10 },
  userPillAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(201,169,110,0.12)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)', justifyContent: 'center', alignItems: 'center' },
  userPillAvatarText: { color: ACCENT_GOLD, fontSize: 13, fontWeight: '700' },
  userPillName: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  userPillEmail: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  miniBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  miniBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  attendeeGuests: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },
  alertBanner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: 'rgba(224,112,112,0.08)', borderWidth: 1, borderColor: 'rgba(224,112,112,0.3)', borderRadius: 10, padding: 10 },
  alertBannerText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },
  logoutRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoutScrim: { backgroundColor: 'rgba(4,8,13,0.7)' },
  logoutCard: {
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
    fontFamily: Platform.select({ ios: 'Times New Roman', default: 'serif' }),
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  logoutMsg: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14.5,
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
});