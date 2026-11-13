// Manager.tsx — restyled to match Admin (same ChatScreen shell: sidebar rail + main panel,
// CHAT_* tokens, shared Toast notifications, and AdminModal popups). Data layer unchanged.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast, { type ToastHandle, type ToastType } from '../components/Toast';
import { useAuthStore } from '../store/authStore';
import { isMountainTips, managerService, type ManagedViewpoint, type ManagerMountainContent } from '../services/managerService';
import type {
  Alert,
  MountainTips,
  TrailGuide,
  TransportGuide,
  TransportKind,
  TransportOption,
} from '../data/mountainTips';
import { mountainService, type Mountain } from '../services/mountainService';
import MountainGuideEditor from './MountainGuideEditor';
import AdminModal from '../admin/AdminModal';
// Reused from the hiker-facing screen so the manager edits exactly what hikers see.
import { VerticalMediaCarousel, getViewpointMedia, PC, type MediaItem } from '../screens/viewpoint';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../theme/designTokens';

const SIDEBAR_W = 196;

type Tab = 'mountain' | 'logistics' | 'viewpoints';
type LogisticsTab = 'transportation' | 'preparation' | 'safety' | 'trail' | 'etiquette' | 'announcements';

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'mountain', label: 'Mountain info', icon: 'trail-sign-outline' },
  { id: 'logistics', label: 'Tips & logistics', icon: 'document-text-outline' },
  { id: 'viewpoints', label: 'Viewpoints', icon: 'eye-outline' },
];

const LOGISTICS_TABS: { id: LogisticsTab; label: string }[] = [
  { id: 'transportation', label: 'Transport' },
  { id: 'preparation', label: 'Preparation' },
  { id: 'safety', label: 'Safety' },
  { id: 'trail', label: 'Trail tips' },
  { id: 'etiquette', label: 'Etiquette' },
  { id: 'announcements', label: 'Announcements' },
];

export default function ManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, isLoading: authLoading, signOut, clearError } = useAuthStore();
  const userId = user?.id;
  const profileRole = profile?.role;
  const [activeTab, setActiveTab] = useState<Tab>('mountain');
  const [activeLogisticsTab, setActiveLogisticsTab] = useState<LogisticsTab>('transportation');
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [content, setContent] = useState<ManagerMountainContent | null>(null);
  const [viewpoints, setViewpoints] = useState<ManagedViewpoint[]>([]);
  const [selectedViewpointId, setSelectedViewpointId] = useState('');
  // Viewpoints edited since the last save, so switching between stops never drops changes
  const [dirtyViewpointIds, setDirtyViewpointIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [dashboardRetry, setDashboardRetry] = useState(0);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [elevation, setElevation] = useState('');
  const [difficulty, setDifficulty] = useState<Mountain['difficulty']>('Moderate');

  // Modal: confirm save (replaces the old Alert-style feedback with an Admin-style popup)
  const [confirmSaveVisible, setConfirmSaveVisible] = useState(false);

  const selectedMountain = useMemo(
    () => mountains.find((mountain) => mountain.id === selectedId) ?? null,
    [mountains, selectedId],
  );
  const selectedViewpoint = viewpoints.find((point) => point.id === selectedViewpointId) ?? null;
  // Keyed on ids only: media doesn't change while typing, and a new array identity
  // on every keystroke would reset the carousel.
  const selectedViewpointMedia = useMemo<MediaItem[]>(
    () => selectedViewpoint
      ? getViewpointMedia({
          data: selectedViewpoint,
          viewpointId: selectedViewpoint.id,
          mountainId: selectedMountain?.id,
          mountainName: selectedMountain?.name,
          viewpointNumber: NaN, // falls back to the record's own sort_order / id
        })
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedViewpoint?.id, selectedMountain?.id, selectedMountain?.name],
  );

  const toastRef = useRef<ToastHandle>(null);
  const showToast = useCallback((type: ToastType, title: string, msg: string) => {
    toastRef.current?.show({ type, title, message: msg });
  }, []);

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const openLogoutConfirm = () => setLogoutConfirmVisible(true);
  const confirmLogout = async () => {
    setLogoutConfirmVisible(false);
    try {
      clearError();
      await signOut();
      const logoutError = useAuthStore.getState().error;
      if (logoutError) {
        showToast('error', 'Sign out failed', logoutError);
        return;
      }
      router.replace('/Login');
    } catch (logoutError: unknown) {
      showToast(
        'error',
        'Sign out failed',
        logoutError instanceof Error ? logoutError.message : 'Unable to sign out. Please try again.',
      );
    }
  };

  // ── Data ──
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.replace('/Login');
      return;
    }
    if (profileRole !== 'manager') {
      router.replace('/Home');
      return;
    }
    let active = true;
    setLoading(true);
    setDashboardLoadError(null);
    void managerService.fetchAssignedMountains(userId)
      .then((rows) => {
        if (!active) return;
        setMountains(rows);
        if (rows[0]) setSelectedId(rows[0].id);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setDashboardLoadError(
            loadError instanceof Error ? loadError.message : 'Unable to load manager dashboard.',
          );
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, dashboardRetry, profileRole, router, userId]);

  useEffect(() => {
    if (loading || !dashboardLoadError) return;
    showToast('error', 'Dashboard failed to load', dashboardLoadError);
  }, [dashboardLoadError, loading, showToast]);

  useEffect(() => {
    if (!selectedMountain || !userId) return;
    let active = true;
    setContent(null);
    setSelectedViewpointId('');
    setDirtyViewpointIds([]);
    void Promise.all([
      managerService.fetchContent(selectedMountain.id, selectedMountain.name),
      managerService.fetchViewpoints(selectedMountain.id),
    ]).then(([nextContent, nextViewpoints]) => {
      if (!active) return;
      setContent(nextContent);
      setViewpoints(nextViewpoints);
      setSelectedViewpointId(nextViewpoints[0]?.id ?? '');
      setDescription(selectedMountain.description ?? '');
      setName(selectedMountain.name ?? '');
      setLocation(selectedMountain.location ?? '');
      setElevation(String(selectedMountain.elevation ?? 0));
    }).catch((loadError: unknown) => {
      if (active) {
        showToast(
          'error',
          'Mountain details failed to load',
          loadError instanceof Error ? loadError.message : 'Unable to load mountain details.',
        );
      }
    });
    return () => { active = false; };
  }, [selectedMountain, showToast, userId]);

  const updateViewpoint = (field: Exclude<keyof ManagedViewpoint, 'tags' | 'features' | 'trail_notes'>, value: string) => {
    if (!selectedViewpoint) return;
    setViewpoints((items) => items.map((item) => item.id === selectedViewpoint.id
      ? { ...item, [field]: value }
      : item));
    setDirtyViewpointIds((ids) => ids.includes(selectedViewpoint.id) ? ids : [...ids, selectedViewpoint.id]);
  };
  const updateViewpointList = (field: 'tags' | 'trail_notes', value: string[]) => {
    if (!selectedViewpoint) return;
    setViewpoints((items) => items.map((item) => item.id === selectedViewpoint.id
      ? { ...item, [field]: value }
      : item));
    setDirtyViewpointIds((ids) => ids.includes(selectedViewpoint.id) ? ids : [...ids, selectedViewpoint.id]);
  };
  const updateViewpointFeatures = (value: ManagedViewpoint['features']) => {
    if (!selectedViewpoint) return;
    setViewpoints((items) => items.map((item) => item.id === selectedViewpoint.id
      ? { ...item, features: value }
      : item));
    setDirtyViewpointIds((ids) => ids.includes(selectedViewpoint.id) ? ids : [...ids, selectedViewpoint.id]);
  };

  const updateTips = (update: (tips: MountainTips) => MountainTips) => {
    setContent((current) => current
      ? { ...current, tips_data: update(current.tips_data) }
      : current);
  };

  // Validate first (toast), then ask for confirmation (modal)
  const requestSave = () => {
    if (!selectedMountain || !content) return;
    const numericElevation = Number(elevation);
    if (!Number.isFinite(numericElevation) || numericElevation < 0) {
      showToast('warning', 'Invalid elevation', 'Enter a valid non-negative elevation in meters.');
      setActiveTab('mountain');
      return;
    }
    if (!isMountainTips(content.tips_data)) {
      showToast('warning', 'Invalid guide data', 'Review the guide fields and try again.');
      return;
    }
    setConfirmSaveVisible(true);
  };

  const save = async () => {
    if (!selectedMountain || !content) return;
    const numericElevation = Number(elevation);
    setSaving(true);
    toastRef.current?.show({
      type: 'loading',
      title: 'Saving changes',
      message: 'Updating mountain information, tips, and viewpoints.',
    });
    try {
      await managerService.saveMountain(selectedMountain.id, {
        name,
        description,
        difficulty,
        elevation: numericElevation,
        location,
      });
      await managerService.saveContent({
        mountain_id: selectedMountain.id,
        tips_data: {
          ...content.tips_data,
          id: selectedMountain.id,
          mountainName: name || selectedMountain.name,
        },
      });
      for (const point of viewpoints.filter((item) => dirtyViewpointIds.includes(item.id))) {
        await managerService.saveViewpoint(point);
      }
      setDirtyViewpointIds([]);
      const refreshed = await mountainService.refreshMountainById(selectedMountain.id);
      if (refreshed) setMountains((rows) => rows.map((row) => row.id === refreshed.id ? refreshed : row));
      showToast('success', 'Saved', 'Mountain information, tips, and viewpoint changes were saved.');
    } catch (saveError: unknown) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save changes.';
      showToast('error', 'Save Failed', message);
    } finally {
      setSaving(false);
    }
  };

  const submitSave = async () => {
    setConfirmSaveVisible(false);
    await save();
  };

  // ── Building blocks (same as Admin) ──
  const renderTabIcon = (t: typeof TABS[number]) => {
    const isActive = activeTab === t.id;
    return (
      <TouchableOpacity
        key={t.id}
        onPress={() => setActiveTab(t.id)}
        activeOpacity={0.75}
        style={[ss.railItem, isActive && ss.railItemActive]}
      >
        <Ionicons name={t.icon} size={16} color={isActive ? ACCENT_GOLD : TEXT_MUTED} />
        <Text style={[ss.railLabel, isActive && ss.railLabelActive]} numberOfLines={1}>{t.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string, action?: React.ReactNode) => (
    <View style={ss.emptyState}>
      <View style={ss.emptyIconWrap}>
        <Ionicons name={icon} size={44} color={ACCENT_GOLD} />
      </View>
      <Text style={ss.emptyTitle}>{title}</Text>
      <Text style={ss.emptySubtitle}>{subtitle}</Text>
      {action ?? null}
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

  const renderModalShell = (
    visible: boolean,
    onClose: () => void,
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    children: React.ReactNode,
    footer?: React.ReactNode,
    locked = false,
  ) => (
    <AdminModal visible={visible} onClose={onClose} locked={locked}>
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
        <ScrollView
          style={ss.modalBodyScroll}
          contentContainerStyle={ss.modalBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={ss.modalFooter}>{footer}</View> : null}
      </View>
    </AdminModal>
  );

  const renderModalAction = (
    label: string,
    onPress: () => void,
    variant: 'ghost' | 'primary' | 'danger' = 'ghost',
    icon?: keyof typeof Ionicons.glyphMap,
  ) => (
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

  const renderChips = <T extends string>(
    items: ReadonlyArray<{ id: T; label: string }>,
    current: T | '',
    onChange: (id: T) => void,
    scroll = false,
  ) => {
    const chips = items.map((f) => (
      <TouchableOpacity
        key={f.id}
        onPress={() => onChange(f.id)}
        activeOpacity={0.75}
        style={[ss.chip, current === f.id && ss.chipActive]}
      >
        <Text style={[ss.chipText, current === f.id && ss.chipTextActive]}>{f.label}</Text>
      </TouchableOpacity>
    ));
    return scroll ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.chipScroll} contentContainerStyle={ss.chipRowScroll}>
        {chips}
      </ScrollView>
    ) : (
      <View style={ss.chipRowInline}>{chips}</View>
    );
  };

  const saveDisabled = saving || !selectedMountain || !content;
  const savePill = (
    <TouchableOpacity
      onPress={requestSave}
      disabled={saveDisabled}
      activeOpacity={0.85}
      style={[ss.savePill, saveDisabled && { opacity: 0.5 }]}
    >
      <Ionicons name="checkmark" size={12} color={CHAT_BG} />
      <Text style={ss.savePillText}>{saving ? 'Saving…' : 'Save'}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={ss.screen} edges={['top']}>
        <View style={ss.emptyState}>
          <Ionicons name="hourglass-outline" size={20} color={TEXT_MUTED} />
          <Text style={ss.emptySubtitle}>Loading manager dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Manager';

  return (
    <>
      {/* Confirm save popup (AdminModal, same card as Admin's popups) */}
      {renderModalShell(
        confirmSaveVisible,
        () => setConfirmSaveVisible(false),
        'Save changes',
        'trail-sign-outline',
        <>
          <View style={ss.userPill}>
            <View style={ss.userPillAvatar}>
              <Ionicons name="trail-sign-outline" size={15} color={ACCENT_GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.userPillName} numberOfLines={1}>{name || selectedMountain?.name || 'Mountain'}</Text>
              <Text style={ss.userPillEmail} numberOfLines={1}>{location || 'No location set'}</Text>
            </View>
          </View>
          <Text style={ss.modalDesc}>
            This updates the public mountain information, tips and announcements
            {dirtyViewpointIds.length > 0
              ? `, and ${dirtyViewpointIds.length} edited viewpoint ${dirtyViewpointIds.length === 1 ? 'page' : 'pages'}`
              : ''}.
          </Text>
        </>,
        <>
          {renderModalAction('Cancel', () => setConfirmSaveVisible(false))}
          {renderModalAction('Save changes', submitSave, 'primary', 'checkmark')}
        </>,
      )}
      {renderModalShell(
        logoutConfirmVisible,
        () => setLogoutConfirmVisible(false),
        'Sign out?',
        'log-out-outline',
        <Text style={ss.modalDesc}>You'll be logged out of the manager panel.</Text>,
        <>
          {renderModalAction('Cancel', () => setLogoutConfirmVisible(false))}
          {renderModalAction('Sign out', () => { void confirmLogout(); }, 'danger', 'log-out-outline')}
        </>,
      )}

      {/* MAIN SHELL — same as Admin */}
      <SafeAreaView style={ss.screen} edges={['top']}>
        <View style={ss.shell}>
          {/* ── SIDEBAR (rail) ── */}
          <View style={ss.sidebar}>
            <View style={ss.sidebarHeader}>
              <TouchableOpacity
                onPress={() => router.replace('/Home')}
                style={ss.backBtn}
                hitSlop={8}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Browse as hiker"
              >
                <Ionicons name="compass-outline" size={16} color={ACCENT_GOLD} />
              </TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ss.sidebarTitle} numberOfLines={1}>Manager</Text>
                <View style={ss.statusRow}>
                  <View style={ss.statusDot} />
                  <Text style={ss.headerStatusText}>Signed in</Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.railContent}>
              {TABS.map(renderTabIcon)}
            </ScrollView>

            <View style={ss.sidebarFooter}>
              <TouchableOpacity onPress={() => router.replace('/Home')} activeOpacity={0.85} style={ss.footerBtn}>
                <Ionicons name="compass-outline" size={13} color={TEXT_MUTED} />
                <Text style={ss.footerBtnText}>Browse app</Text>
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
              activeLabel,
              selectedMountain ? selectedMountain.name : 'Edit only the mountains assigned to you',
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={ss.headerPill}>
                  <Text style={ss.headerPillText}>{mountains.length} {mountains.length === 1 ? 'mountain' : 'mountains'}</Text>
                </View>
                {mountains.length > 0 ? savePill : null}
              </View>,
            )}

            {dashboardLoadError ? (
              renderEmpty(
                'alert-circle-outline',
                'Dashboard unavailable',
                dashboardLoadError,
                <TouchableOpacity
                  onPress={() => setDashboardRetry((retry) => retry + 1)}
                  activeOpacity={0.85}
                  style={ss.emptyAction}
                >
                  <Text style={ss.emptyActionText}>Try again</Text>
                </TouchableOpacity>,
              )
            ) : mountains.length === 0 ? (
              renderEmpty(
                'trail-sign-outline',
                'No mountains assigned',
                'An administrator must assign one or more mountains to your account.',
                <TouchableOpacity onPress={() => router.replace('/Home')} activeOpacity={0.85} style={ss.emptyAction}>
                  <Text style={ss.emptyActionText}>Browse as a hiker</Text>
                </TouchableOpacity>,
              )
            ) : (
              <>
                {/* Managed mountain picker (shown on every tab) */}
                {mountains.length > 1 && renderChips(
                  mountains.map((m) => ({ id: m.id, label: m.name })),
                  selectedId,
                  setSelectedId,
                  true,
                )}

                {/* ── VIEWPOINTS: the real viewpoint page, editable in place ── */}
                {activeTab === 'viewpoints' ? (
                  <View style={{ flex: 1, minHeight: 0 }}>
                    {!content ? (
                      <Text style={ss.emptyStateText}>Loading details…</Text>
                    ) : viewpoints.length === 0 ? (
                      <Text style={ss.emptyStateText}>No viewpoints are set up for this mountain yet.</Text>
                    ) : (
                      <>
                        {renderChips(
                          viewpoints.map((p) => ({ id: p.id, label: p.name })),
                          selectedViewpointId,
                          setSelectedViewpointId,
                          true,
                        )}
                        {selectedViewpoint ? (
                          <ViewpointLiveEditor
                            key={selectedViewpoint.id}
                            viewpoint={selectedViewpoint}
                            media={selectedViewpointMedia}
                            onChange={updateViewpoint}
                            onChangeList={updateViewpointList}
                            onChangeFeatures={updateViewpointFeatures}
                          />
                        ) : null}
                      </>
                    )}
                  </View>
                ) : activeTab === 'mountain' ? (
                  /* ── MOUNTAIN INFO: the Home screen look, editable in place ── */
                  <View style={{ flex: 1, minHeight: 0 }}>
                    {!content ? (
                      <Text style={ss.emptyStateText}>Loading details…</Text>
                    ) : (
                      <MountainLiveEditor
                        heroImage={selectedMountain ? MOUNTAIN_HERO_IMAGES[selectedMountain.id] : undefined}
                        funnyWarning={selectedMountain?.funny_warning}
                        name={name}
                        onChangeName={setName}
                        location={location}
                        onChangeLocation={setLocation}
                        elevation={elevation}
                        onChangeElevation={setElevation}
                        description={description}
                        onChangeDescription={setDescription}
                        difficulty={difficulty}
                        onChangeDifficulty={setDifficulty}
                        onOpenGuide={() => setActiveTab('logistics')}
                      />
                    )}
                  </View>
                ) : (
                <ScrollView
                  contentContainerStyle={ss.mainContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── TIPS & LOGISTICS ── */}
                  {activeTab === 'logistics' && (
                    !content ? (
                      <Text style={ss.emptyStateText}>Loading details…</Text>
                    ) : (
                      <>
                        <Text style={ss.sectionLabel}>EDIT MOUNTAIN GUIDE</Text>
                        <View style={ss.logisticsTabBar}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={ss.logisticsTabRow}
                          >
                            {LOGISTICS_TABS.map((tab) => {
                              const selected = activeLogisticsTab === tab.id;
                              return (
                                <TouchableOpacity
                                  key={tab.id}
                                  onPress={() => setActiveLogisticsTab(tab.id)}
                                  activeOpacity={0.75}
                                  accessibilityRole="tab"
                                  accessibilityState={{ selected }}
                                  style={ss.logisticsTab}
                                >
                                  <Text style={[ss.logisticsTabText, selected && ss.logisticsTabTextActive]}>
                                    {tab.label}
                                  </Text>
                                  <View style={[ss.logisticsTabIndicator, selected && ss.logisticsTabIndicatorActive]} />
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>

                        <MountainGuideEditor
                          tips={content.tips_data}
                          activeTab={activeLogisticsTab}
                          updateTips={updateTips}
                        />

                        {/* Legacy form replaced by MountainGuideEditor.
                        <>
                        {activeLogisticsTab === 'transportation' && (
                          <>
                        <Text style={ss.sectionLabel}>TRANSPORTATION</Text>
                        <Field
                          label="Transportation information (one item per line)"
                          value={content.tips_data.transportation.join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, transportation: parseLines(value) }))}
                          multiline
                        />
                        <Field
                          label="Starting point"
                          value={content.tips_data.transportGuide?.startPoint ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            transportGuide: { ...(tips.transportGuide ?? emptyTransportGuide()), startPoint: value },
                          }))}
                        />
                        <Field
                          label="Transport options (one per line: vehicle | type | fare | note)"
                          value={formatTransportOptions(content.tips_data.transportGuide?.options ?? [])}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            transportGuide: {
                              ...(tips.transportGuide ?? emptyTransportGuide()),
                              options: parseTransportOptions(value),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Transportation reminder"
                          value={content.tips_data.transportGuide?.tip ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            transportGuide: { ...(tips.transportGuide ?? emptyTransportGuide()), tip: value },
                          }))}
                          multiline
                        />
                          </>
                        )}

                        {activeLogisticsTab === 'preparation' && (
                          <>
                        <Text style={ss.sectionLabel}>PREPARATION & REQUIREMENTS</Text>
                        <Field
                          label="Preparation tips (one item per line)"
                          value={content.tips_data.preparation.join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, preparation: parseLines(value) }))}
                          multiline
                        />
                        <Field
                          label="Quick facts (one per line: label | value)"
                          value={formatPairRows(content.tips_data.preparationGuide?.facts ?? [], (item) => item.value)}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            preparationGuide: {
                              ...(tips.preparationGuide ?? {}),
                              facts: parsePairRows(value).filter(([label, detail]) => label && detail).map(([label, value]) => ({ label, value })),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Permits and fees (one per line: label | amount)"
                          value={formatPairRows(content.tips_data.preparationGuide?.fees ?? [], (item) => item.amount)}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            preparationGuide: {
                              ...(tips.preparationGuide ?? {}),
                              fees: parsePairRows(value).filter(([label, amount]) => label && amount).map(([label, amount]) => ({ label, amount })),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="What to bring (one item per line)"
                          value={(content.tips_data.preparationGuide?.bring ?? []).join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            preparationGuide: {
                              ...(tips.preparationGuide ?? {}),
                              bring: parseLines(value),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Preparation note"
                          value={content.tips_data.preparationGuide?.note ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            preparationGuide: { ...(tips.preparationGuide ?? {}), note: value },
                          }))}
                          multiline
                        />
                          </>
                        )}

                        {activeLogisticsTab === 'safety' && (
                          <>
                        <Text style={ss.sectionLabel}>SAFETY</Text>
                        <Field
                          label="Safety advisories (one item per line)"
                          value={content.tips_data.safety.join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, safety: parseLines(value) }))}
                          multiline
                        />
                        <Field
                          label="Hazards (one per line: hazard | details)"
                          value={formatPairRows(content.tips_data.safetyGuide?.hazards ?? [], (item) => item.detail ?? '')}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            safetyGuide: {
                              ...(tips.safetyGuide ?? {}),
                              hazards: parsePairRows(value).filter(([label]) => label).map(([label, detail]) => detail ? { label, detail } : { label }),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Weather guidance"
                          value={content.tips_data.safetyGuide?.weather ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            safetyGuide: { ...(tips.safetyGuide ?? {}), weather: value },
                          }))}
                          multiline
                        />
                        <Field
                          label="Emergency and check-in information"
                          value={content.tips_data.safetyGuide?.emergency ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            safetyGuide: { ...(tips.safetyGuide ?? {}), emergency: value },
                          }))}
                          multiline
                        />
                        <Field
                          label="Safety note"
                          value={content.tips_data.safetyGuide?.note ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            safetyGuide: { ...(tips.safetyGuide ?? {}), note: value },
                          }))}
                          multiline
                        />
                          </>
                        )}

                        {activeLogisticsTab === 'trail' && (
                          <>
                        <Text style={ss.sectionLabel}>TRAIL TIPS & NAVIGATION</Text>
                        <Field
                          label="Trail tips (one item per line)"
                          value={content.tips_data.trailTips.join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, trailTips: parseLines(value) }))}
                          multiline
                        />
                        <Field
                          label="Trail starting point"
                          value={content.tips_data.trailGuide?.startPoint ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: { ...(tips.trailGuide ?? emptyTrailGuide()), startPoint: value },
                          }))}
                        />
                        <Field
                          label="Drop-off point"
                          value={content.tips_data.trailGuide?.dropOff ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: { ...(tips.trailGuide ?? emptyTrailGuide()), dropOff: value },
                          }))}
                        />
                        <Field
                          label="Trail stops (one per line: place | details)"
                          value={formatPairRows(content.tips_data.trailGuide?.stops ?? [], (item) => item.detail ?? '')}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: {
                              ...(tips.trailGuide ?? emptyTrailGuide()),
                              stops: parsePairRows(value).filter(([label]) => label).map(([label, detail]) => detail ? { label, detail } : { label }),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Landmarks (one per line)"
                          value={(content.tips_data.trailGuide?.landmarks ?? []).join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: { ...(tips.trailGuide ?? emptyTrailGuide()), landmarks: parseLines(value) },
                          }))}
                          multiline
                        />
                        <Field
                          label="Water source information"
                          value={content.tips_data.trailGuide?.water ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: { ...(tips.trailGuide ?? emptyTrailGuide()), water: value },
                          }))}
                          multiline
                        />
                        <Field
                          label="Trail note"
                          value={content.tips_data.trailGuide?.tip ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            trailGuide: { ...(tips.trailGuide ?? emptyTrailGuide()), tip: value },
                          }))}
                          multiline
                        />
                          </>
                        )}

                        {activeLogisticsTab === 'etiquette' && (
                          <>
                        <Text style={ss.sectionLabel}>ENVIRONMENTAL ETIQUETTE</Text>
                        <Field
                          label="Etiquette tips (one item per line)"
                          value={content.tips_data.etiquette.join('\n')}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, etiquette: parseLines(value) }))}
                          multiline
                        />
                        <Field
                          label="Rules (one per line: rule | details)"
                          value={formatPairRows(content.tips_data.etiquetteGuide?.rules ?? [], (item) => item.detail ?? '')}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            etiquetteGuide: {
                              ...(tips.etiquetteGuide ?? {}),
                              rules: parsePairRows(value).filter(([label]) => label).map(([label, detail]) => detail ? { label, detail } : { label }),
                            },
                          }))}
                          multiline
                        />
                        <Field
                          label="Local customs and community guidance"
                          value={content.tips_data.etiquetteGuide?.local ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            etiquetteGuide: { ...(tips.etiquetteGuide ?? {}), local: value },
                          }))}
                          multiline
                        />
                        <Field
                          label="Etiquette note"
                          value={content.tips_data.etiquetteGuide?.note ?? ''}
                          onChangeText={(value) => updateTips((tips) => ({
                            ...tips,
                            etiquetteGuide: { ...(tips.etiquetteGuide ?? {}), note: value },
                          }))}
                          multiline
                        />
                          </>
                        )}

                        {activeLogisticsTab === 'announcements' && (
                          <>
                        <Text style={ss.sectionLabel}>OFFICIAL ANNOUNCEMENTS</Text>
                        <Field
                          label="Announcements (one per line: info / warning / danger | title | message | optional date)"
                          value={formatAlerts(content.tips_data.alerts)}
                          onChangeText={(value) => updateTips((tips) => ({ ...tips, alerts: parseAlerts(value) }))}
                          multiline
                        />
                          </>
                        )}
                        </>
                        */}
                      </>
                    )
                  )}
                </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </SafeAreaView>

      <Toast ref={toastRef} position="top-right" topOffset={insets.top + 10} />
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={ss.field}>
      <Text style={ss.fieldLabel}>{label}</Text>
      <View style={[ss.inputWrapper, multiline && ss.inputWrapperMultiline]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={[ss.inputField, multiline && ss.inputFieldMultiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

/* ─────────── Live viewpoint editor ───────────
 * Mirrors the hiker-facing Viewpoint screen (media rail on the left, header card +
 * "About this Stop" on the right) but every piece of text the manager owns is an
 * inline input. Read-only mirrors (elevation / best-time chips) update live, just
 * like they do on the real page. */
const noop = () => {};
const FEATURE_ICON_OPTIONS = [
  'information-circle-outline',
  'water-outline',
  'leaf-outline',
  'warning-outline',
  'people-outline',
  'home-outline',
  'eye-outline',
  'camera-outline',
  'sunny-outline',
  'trail-sign-outline',
] as const satisfies readonly React.ComponentProps<typeof Ionicons>['name'][];

// Same hero photos Home uses for each mountain (same relative path as Home.tsx).
const MOUNTAIN_HERO_IMAGES: Record<string, ImageSourcePropType> = {
  '2cd5666c-1deb-4499-812e-eb95a992ef68': require('../../assets/HomeScreenFallbackImages/Mt. Balinsayaw.png'),
  'd39ff04a-069b-4d90-b448-f66e6ae05772': require('../../assets/HomeScreenFallbackImages/Mount. M.png'),
  '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6': require('../../assets/HomeScreenFallbackImages/Mt. Madja-as.png'),
  'f2173971-80bf-40dd-96e9-c6b015be194b': require('../../assets/HomeScreenFallbackImages/Pandan Hills.png'),
  'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65': require('../../assets/HomeScreenFallbackImages/Mt. Nangtud.png'),
};

const DIFFICULTY_OPTIONS = ['Easy', 'Moderate', 'Hard', 'Expert'] as const;
const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF81',
  Moderate: '#F0A500',
  Hard: '#E05C3A',
  Expert: '#C0392B',
};

/** TextInput that lights up while focused. Purely presentational. */
function InlineInput({
  focusStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}: React.ComponentProps<typeof TextInput> & {
  focusStyle?: React.ComponentProps<typeof TextInput>['style'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[style, focused && (focusStyle ?? vp.editableFocused)]}
    />
  );
}

/* ─────────── Live mountain editor ─────────── */
function MountainLiveEditor({
  heroImage,
  funnyWarning,
  name,
  onChangeName,
  location,
  onChangeLocation,
  elevation,
  onChangeElevation,
  description,
  onChangeDescription,
  difficulty,
  onChangeDifficulty,
  onOpenGuide,
}: {
  heroImage?: ImageSourcePropType;
  funnyWarning?: string | null;
  name: string;
  onChangeName: (value: string) => void;
  location: string;
  onChangeLocation: (value: string) => void;
  elevation: string;
  onChangeElevation: (value: string) => void;
  description: string;
  onChangeDescription: (value: string) => void;
  difficulty: Mountain['difficulty'];
  onChangeDifficulty: (value: Mountain['difficulty']) => void;
  onOpenGuide: () => void;
}) {
  const diffColor = DIFFICULTY_COLORS[difficulty] ?? '#FFFFFF';

  return (
    <ScrollView
      style={mt.scroll}
      contentContainerStyle={mt.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={mt.hero}>
        {heroImage ? (
          <Image source={heroImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={mt.heroPlaceholder}>
            <Ionicons name="image-outline" size={42} color="#8B7355" />
          </View>
        )}
        <View pointerEvents="none" style={mt.heroShade} />
        <View style={mt.previewMeta}>
          <View style={[mt.previewBadge, { borderColor: diffColor }]}>
            <View style={[mt.badgeDot, { backgroundColor: diffColor }]} />
            <Text style={[mt.badgeText, { color: diffColor }]}>{difficulty}</Text>
          </View>
          <Text style={mt.previewLocation} numberOfLines={1}>{location || 'Location not set'}</Text>
        </View>
        <Text style={mt.previewName} numberOfLines={2}>{name || 'Mountain name'}</Text>
        {funnyWarning ? <Text style={mt.funnyWarning} numberOfLines={2}>{funnyWarning}</Text> : null}
      </View>

      <View style={mt.editCard}>
        <View style={mt.sectionHeading}>
          <View style={mt.sectionIcon}>
            <Ionicons name="trail-sign-outline" size={15} color={PC.gold} />
          </View>
          <View style={mt.sectionHeadingCopy}>
            <Text style={mt.sectionTitle}>Mountain details</Text>
            <Text style={mt.sectionSubtitle}>Update the information hikers see on Home.</Text>
          </View>
        </View>

        <View style={mt.field}>
          <Text style={mt.fieldLabel}>Mountain name</Text>
          <InlineInput
            value={name}
            onChangeText={onChangeName}
            placeholder="Enter mountain name"
            placeholderTextColor={PC.textFaint}
            selectionColor={PC.gold}
            style={mt.fieldInput}
            focusStyle={mt.fieldInputFocused}
            accessibilityLabel="Edit mountain name"
          />
        </View>

        <View style={mt.fieldRow}>
          <View style={[mt.field, mt.fieldHalf]}>
            <Text style={mt.fieldLabel}>Location</Text>
            <View style={mt.inputWithIcon}>
              <Ionicons name="location-outline" size={14} color={PC.textFaint} />
              <InlineInput
                value={location}
                onChangeText={onChangeLocation}
                placeholder="Location"
                placeholderTextColor={PC.textFaint}
                selectionColor={PC.gold}
                style={mt.compactFieldInput}
                focusStyle={mt.compactFieldInputFocused}
                accessibilityLabel="Edit location"
              />
            </View>
          </View>
          <View style={[mt.field, mt.fieldHalf]}>
            <Text style={mt.fieldLabel}>Elevation (meters)</Text>
            <View style={mt.inputWithIcon}>
              <Ionicons name="trending-up-outline" size={14} color={PC.textFaint} />
              <InlineInput
                value={elevation}
                onChangeText={onChangeElevation}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={PC.textFaint}
                selectionColor={PC.gold}
                style={mt.compactFieldInput}
                focusStyle={mt.compactFieldInputFocused}
                accessibilityLabel="Edit elevation in meters"
              />
            </View>
          </View>
        </View>

        <View style={mt.field}>
          <Text style={mt.fieldLabel}>Difficulty</Text>
          <View style={mt.difficultyOptions}>
            {DIFFICULTY_OPTIONS.map((option) => {
              const color = DIFFICULTY_COLORS[option];
              const active = option === difficulty;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => onChangeDifficulty(option)}
                  activeOpacity={0.8}
                  style={[mt.difficultyOption, active && { borderColor: color, backgroundColor: `${color}18` }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[mt.badgeDot, { backgroundColor: color }]} />
                  <Text style={[mt.difficultyOptionText, active && { color }]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={mt.field}>
          <Text style={mt.fieldLabel}>Description</Text>
          <InlineInput
            value={description}
            onChangeText={onChangeDescription}
            placeholder="Describe this mountain for hikers…"
            placeholderTextColor={PC.textFaint}
            selectionColor={PC.gold}
            multiline
            textAlignVertical="top"
            style={[mt.fieldInput, mt.descriptionInput]}
            focusStyle={mt.fieldInputFocused}
            accessibilityLabel="Edit mountain description"
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={onOpenGuide}
        activeOpacity={0.8}
        style={mt.guideCard}
        accessibilityRole="button"
        accessibilityLabel="Open tips and logistics"
      >
        <View style={mt.guideIcon}>
          <Ionicons name="information-circle-outline" size={17} color={PC.gold} />
        </View>
        <View style={mt.sectionHeadingCopy}>
          <Text style={mt.guideTitle}>Tips & logistics</Text>
          <Text style={mt.guideSubtitle}>Manage transportation, preparation, safety, and trail guidance.</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={PC.textFaint} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function EditableText({
  value,
  onChangeText,
  onBlur,
  placeholder,
  style,
  multiline = false,
  placeholderColor = 'rgba(255,255,255,0.28)',
}: {
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  style?: React.ComponentProps<typeof TextInput>['style'];
  multiline?: boolean;
  placeholderColor?: string;
}) {
  return (
    <InlineInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      multiline={multiline}
      scrollEnabled={!multiline}
      selectionColor={PC.gold}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[vp.editable, style]}
    />
  );
}

function ViewpointLiveEditor({
  viewpoint,
  media,
  onChange,
  onChangeList,
  onChangeFeatures,
}: {
  viewpoint: ManagedViewpoint;
  media: MediaItem[];
  onChange: (field: Exclude<keyof ManagedViewpoint, 'tags' | 'features' | 'trail_notes'>, value: string) => void;
  onChangeList: (field: 'tags' | 'trail_notes', value: string[]) => void;
  onChangeFeatures: (value: ManagedViewpoint['features']) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [iconPickerIndex, setIconPickerIndex] = useState<number | null>(null);
  return (
    <>
    <View
      style={vp.body}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.height > 0 && (
        <>
          {/* LEFT: same media rail hikers see */}
          <View style={[vp.leftColumn, { width: size.width * 0.35 }]}>
            <VerticalMediaCarousel
              media={media}
              height={size.height}
              fallbackLabel={viewpoint.name}
              onPressImage={noop}
              onActiveImageReady={noop}
            />
          </View>

          {/* RIGHT: info panel, editable in place */}
          <ScrollView
            style={vp.rightColumn}
            contentContainerStyle={vp.rightContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={vp.hintRow}>
              <Ionicons name="create-outline" size={11} color={PC.gold} />
              <Text style={vp.hintText}>Gold-highlighted text is editable. Tap a value and type directly in its place.</Text>
            </View>

            <View style={vp.headerCard}>
              <View style={vp.headerTopRow}>
                <View style={{ flex: 1 }}>
                  <EditableText
                    value={viewpoint.subtitle ?? ''}
                    onChangeText={(v) => onChange('subtitle', v)}
                    placeholder="Subtitle"
                    style={vp.subtitleInput}
                  />
                  <EditableText
                    value={viewpoint.name ?? ''}
                    onChangeText={(v) => onChange('name', v)}
                    placeholder="Viewpoint name"
                    style={vp.titleInput}
                  />
                </View>
                <View style={vp.elevBadge}>
                  <Ionicons name="trending-up-outline" size={10} color={PC.bgCard} />
                  <InlineInput
                    value={viewpoint.elevation ?? ''}
                    onChangeText={(value) => onChange('elevation', value)}
                    placeholder="Elevation"
                    placeholderTextColor="rgba(14,21,32,0.45)"
                    selectionColor={PC.bgCard}
                    style={[vp.elevInput, vp.elevationEditable]}
                    focusStyle={vp.elevFocused}
                    accessibilityLabel="Edit elevation"
                  />
                </View>
              </View>

              <View style={vp.statsGrid}>
                <View style={vp.statChip}>
                  <Ionicons name="walk-outline" size={14} color={PC.gold} />
                  <Text style={vp.statChipLabel}>Distance</Text>
                  <EditableText
                    value={viewpoint.distance_from_start ?? ''}
                    onChangeText={(v) => onChange('distance_from_start', v)}
                    placeholder="e.g. 2.4 km"
                    style={vp.statChipInput}
                  />
                </View>
                <View style={vp.statChip}>
                  <Ionicons name="time-outline" size={14} color={PC.gold} />
                  <Text style={vp.statChipLabel}>Est. hike</Text>
                  <EditableText
                    value={viewpoint.estimated_hike ?? ''}
                    onChangeText={(v) => onChange('estimated_hike', v)}
                    placeholder="e.g. 1 hr"
                    style={vp.statChipInput}
                  />
                </View>
                <View style={vp.statChip}>
                  <Ionicons name="trending-up-outline" size={14} color={PC.gold} />
                  <Text style={vp.statChipLabel}>Elevation</Text>
                  <EditableText
                    value={viewpoint.elevation ?? ''}
                    onChangeText={(value) => onChange('elevation', value)}
                    placeholder="e.g. 1,200 m"
                    style={vp.statChipInput}
                  />
                </View>
                <View style={vp.statChip}>
                  <Ionicons name="sunny-outline" size={14} color={PC.gold} />
                  <Text style={vp.statChipLabel}>Best time</Text>
                  <EditableText
                    value={viewpoint.best_time ?? ''}
                    onChangeText={(value) => onChange('best_time', value)}
                    placeholder="e.g. Morning"
                    style={vp.statChipInput}
                  />
                </View>
              </View>
            </View>

            <View style={vp.panel}>
              <View style={vp.panelHeader}>
                <View style={vp.panelAccent} />
                <Text style={vp.panelTitle}>Trail tags</Text>
              </View>
              <View style={vp.tagRow}>
                {viewpoint.tags.map((tag, index) => (
                  <View key={`tag-${index}`} style={vp.tagChip}>
                    <InlineInput
                      value={tag}
                      onChangeText={(value) => onChangeList(
                        'tags',
                        viewpoint.tags.map((item, itemIndex) => itemIndex === index ? value : item),
                      )}
                      placeholder="Tag"
                      placeholderTextColor={PC.textFaint}
                      selectionColor={PC.gold}
                      style={vp.tagInput}
                      focusStyle={vp.tagInputFocused}
                      accessibilityLabel={`Edit trail tag ${index + 1}`}
                    />
                    <TouchableOpacity
                      onPress={() => onChangeList('tags', viewpoint.tags.filter((_, itemIndex) => itemIndex !== index))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove trail tag ${index + 1}`}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={13} color={PC.textFaint} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => onChangeList('tags', [...viewpoint.tags, ''])}
                  activeOpacity={0.8}
                  style={vp.addItemChip}
                  accessibilityRole="button"
                  accessibilityLabel="Add trail tag"
                >
                  <Ionicons name="add" size={12} color={PC.gold} />
                  <Text style={vp.addItemText}>Add tag</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={vp.panel}>
              <View style={vp.panelHeader}>
                <View style={vp.panelAccent} />
                <Text style={vp.panelTitle}>About this Stop</Text>
              </View>
              <InlineInput
                value={viewpoint.description ?? ''}
                onChangeText={(value) => onChange('description', value)}
                placeholder="No description yet."
                placeholderTextColor={PC.textFaint}
                multiline
                scrollEnabled
                selectionColor={PC.gold}
                textAlignVertical="top"
                style={[vp.editable, vp.descriptionInput]}
                accessibilityLabel="Edit stop description"
              />

              <View style={vp.innerDivider} />

              <View style={vp.bestTimeInline}>
                <Ionicons name="alarm-outline" size={13} color={PC.gold} />
                <InlineInput
                  value={viewpoint.best_time ?? ''}
                  onChangeText={(value) => onChange('best_time', value)}
                  placeholder="Any time"
                  placeholderTextColor={PC.textFaint}
                  selectionColor={PC.gold}
                  style={[vp.editable, vp.bestTimeInlineText]}
                  accessibilityLabel="Edit best time"
                />
              </View>

              <View style={vp.innerDivider} />

              <View style={vp.difficultyRowInline}>
                <View style={vp.difficultyChip}>
                  <Ionicons name="flag-outline" size={12} color={PC.gold} />
                  <Text style={vp.difficultyLabel}>Difficulty</Text>
                  <InlineInput
                    value={viewpoint.difficulty ?? ''}
                    onChangeText={(value) => onChange('difficulty', value)}
                    placeholder="Moderate"
                    placeholderTextColor={PC.textFaint}
                    selectionColor={PC.gold}
                    style={[vp.editable, vp.difficultyValue]}
                    accessibilityLabel="Edit difficulty"
                  />
                </View>
                <View style={vp.statDividerV} />
                <View style={vp.difficultyChip}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={PC.green} />
                  <Text style={vp.difficultyLabel}>Status</Text>
                  <InlineInput
                    value={viewpoint.trail_status ?? ''}
                    onChangeText={(value) => onChange('trail_status', value)}
                    placeholder="Open"
                    placeholderTextColor={PC.green}
                    selectionColor={PC.gold}
                    style={[vp.editable, vp.difficultyValue, vp.statusEditable]}
                    accessibilityLabel="Edit trail status"
                  />
                </View>
                <View style={vp.statDividerV} />
                <View style={vp.difficultyChip}>
                  <Ionicons name="people-outline" size={12} color={PC.textFaint} />
                  <Text style={vp.difficultyLabel}>Crowd</Text>
                  <InlineInput
                    value={viewpoint.crowd_level ?? ''}
                    onChangeText={(value) => onChange('crowd_level', value)}
                    placeholder="Low"
                    placeholderTextColor={PC.textFaint}
                    selectionColor={PC.gold}
                    style={[vp.editable, vp.difficultyValue]}
                    accessibilityLabel="Edit crowd level"
                  />
                </View>
              </View>
            </View>

            <View style={vp.panel}>
              <View style={vp.panelHeader}>
                <View style={vp.panelAccent} />
                <Text style={vp.panelTitle}>What to Expect</Text>
              </View>
              {viewpoint.features.map((feature, index) => (
                <View key={`feature-${index}`}>
                  <View style={vp.featureRow}>
                    <TouchableOpacity
                      onPress={() => setIconPickerIndex(iconPickerIndex === index ? null : index)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose icon for feature ${index + 1}`}
                      style={vp.featureIconButton}
                    >
                      <Ionicons
                        name={(feature.icon || 'information-circle-outline') as React.ComponentProps<typeof Ionicons>['name']}
                        size={14}
                        color={feature.safe ? '#77C89B' : '#E5A45C'}
                      />
                    </TouchableOpacity>
                    <InlineInput
                      value={feature.text}
                      onChangeText={(value) => onChangeFeatures(viewpoint.features.map(
                        (item, itemIndex) => itemIndex === index ? { ...item, text: value } : item,
                      ))}
                      placeholder="Describe this trail feature"
                      placeholderTextColor={PC.textFaint}
                      selectionColor={PC.gold}
                      multiline
                      style={[vp.editable, vp.featureInput, !feature.safe && vp.featureInputCaution]}
                      accessibilityLabel={`Edit trail feature ${index + 1}`}
                    />
                    <TouchableOpacity
                      onPress={() => onChangeFeatures(viewpoint.features.map(
                        (item, itemIndex) => itemIndex === index ? { ...item, safe: !item.safe } : item,
                      ))}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Change feature ${index + 1} safety`}
                      style={[vp.featureStatusButton, !feature.safe && vp.featureStatusButtonCaution]}
                    >
                      <Text style={[vp.featureStatus, !feature.safe && vp.featureStatusCaution]}>
                        {feature.safe ? 'Good' : 'Caution'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        onChangeFeatures(viewpoint.features.filter((_, itemIndex) => itemIndex !== index));
                        setIconPickerIndex(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove trail feature ${index + 1}`}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={14} color={PC.textFaint} />
                    </TouchableOpacity>
                  </View>
                  {iconPickerIndex === index && (
                    <View style={vp.iconPicker}>
                      {FEATURE_ICON_OPTIONS.map((icon) => (
                        <TouchableOpacity
                          key={icon}
                          onPress={() => {
                            onChangeFeatures(viewpoint.features.map(
                              (item, itemIndex) => itemIndex === index ? { ...item, icon } : item,
                            ));
                            setIconPickerIndex(null);
                          }}
                          activeOpacity={0.75}
                          style={[vp.iconOption, feature.icon === icon && vp.iconOptionActive]}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${icon.replace(/-outline$/, '').replace(/-/g, ' ')} icon`}
                        >
                          <Ionicons name={icon} size={15} color={feature.icon === icon ? PC.gold : PC.textSecondary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => {
                  const newIndex = viewpoint.features.length;
                  onChangeFeatures([...viewpoint.features, {
                    icon: 'information-circle-outline',
                    text: '',
                    safe: true,
                  }]);
                  setIconPickerIndex(newIndex);
                }}
                activeOpacity={0.8}
                style={vp.addItemButton}
                accessibilityRole="button"
                accessibilityLabel="Add trail feature"
              >
                <Ionicons name="add-circle-outline" size={14} color={PC.gold} />
                <Text style={vp.addItemText}>Add feature</Text>
              </TouchableOpacity>
            </View>

            <View style={vp.panel}>
              <View style={vp.panelHeader}>
                <View style={vp.panelAccent} />
                <Text style={vp.panelTitle}>Trail notes</Text>
              </View>
              {viewpoint.trail_notes.map((note, index) => (
                <View key={`note-${index}`} style={vp.noteRow}>
                  <Ionicons name="information-circle-outline" size={14} color={PC.gold} style={vp.noteIcon} />
                  <InlineInput
                    value={note}
                    onChangeText={(value) => onChangeList(
                      'trail_notes',
                      viewpoint.trail_notes.map((item, itemIndex) => itemIndex === index ? value : item),
                    )}
                    placeholder="Add a trail note"
                    placeholderTextColor={PC.textFaint}
                    selectionColor={PC.gold}
                    multiline
                    style={[vp.editable, vp.noteInput]}
                    accessibilityLabel={`Edit trail note ${index + 1}`}
                  />
                  <TouchableOpacity
                    onPress={() => onChangeList(
                      'trail_notes',
                      viewpoint.trail_notes.filter((_, itemIndex) => itemIndex !== index),
                    )}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove trail note ${index + 1}`}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle" size={14} color={PC.textFaint} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => onChangeList('trail_notes', [...viewpoint.trail_notes, ''])}
                activeOpacity={0.8}
                style={vp.addItemButton}
                accessibilityRole="button"
                accessibilityLabel="Add trail note"
              >
                <Ionicons name="add-circle-outline" size={14} color={PC.gold} />
                <Text style={vp.addItemText}>Add trail note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </>
      )}
    </View>
    </>
  );
}

function parseLines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parsePairRows(value: string): [string, string][] {
  return parseLines(value).map((line) => {
    const separator = line.indexOf('|');
    return separator < 0
      ? [line.trim(), '']
      : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });
}

function formatPairRows<T extends { label: string }>(items: readonly T[], getValue: (item: T) => string): string {
  return items.map((item) => `${item.label} | ${getValue(item)}`).join('\n');
}

function emptyTransportGuide(): TransportGuide {
  return { startPoint: '', options: [] };
}

function emptyTrailGuide(): TrailGuide {
  return { startPoint: '' };
}

function isTransportKind(value: string): value is TransportKind {
  return ['jeepney', 'bus', 'van', 'car', 'tricycle', 'motorcycle', 'boat', 'walk'].includes(value);
}

function formatTransportOptions(options: readonly TransportOption[]): string {
  return options.map((option) => [
    option.vehicle,
    option.kind ?? '',
    option.pricePerPerson ?? '',
    option.note ?? '',
  ].join(' | ')).join('\n');
}

function parseTransportOptions(value: string): TransportOption[] {
  return parseLines(value).flatMap((line) => {
    const [vehicle = '', rawKind = '', rawPrice = '', ...noteParts] = line.split('|').map((part) => part.trim());
    if (!vehicle) return [];
    const kind = isTransportKind(rawKind) ? rawKind : undefined;
    const note = noteParts.join(' | ').trim();
    return [{
      vehicle,
      ...(kind ? { kind } : {}),
      ...(rawPrice ? { pricePerPerson: rawPrice } : {}),
      ...(note ? { note } : {}),
    }];
  });
}

function formatAlerts(alerts: readonly Alert[]): string {
  return alerts.map((alert) => [
    alert.type,
    alert.title,
    alert.message,
    alert.date ?? '',
  ].join(' | ')).join('\n');
}

function parseAlerts(value: string): Alert[] {
  return parseLines(value).flatMap((line) => {
    const [rawType = '', title = '', ...messageAndDate] = line.split('|').map((part) => part.trim());
    if (!title || messageAndDate.length === 0) return [];
    const date = messageAndDate.length > 1 ? messageAndDate.pop()?.trim() : '';
    const message = messageAndDate.join(' | ').trim();
    if (!message) return [];
    const type: Alert['type'] = rawType === 'danger' || rawType === 'warning' ? rawType : 'info';
    return [{ type, title, message, ...(date ? { date } : {}) }];
  });
}

/* ─────────── Styles (shared look with Admin) ─────────── */
const ss = StyleSheet.create({
  // Shell
  screen: { flex: 1, backgroundColor: CHAT_BG },
  shell: { flex: 1, flexDirection: 'row', marginHorizontal: 16, backgroundColor: CHAT_BG },

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
  headerStatusText: { fontSize: 9.5, color: TEXT_MUTED, fontWeight: '500', letterSpacing: 0.2 },

  railContent: { padding: 8, gap: 2 },
  railItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, height: 34, borderRadius: 9,
  },
  railItemActive: { backgroundColor: 'rgba(201,169,110,0.12)' },
  railLabel: { flex: 1, color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  railLabelActive: { color: TEXT_PRIMARY },

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
  savePill: {
    height: 26, paddingHorizontal: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ACCENT_GOLD,
  },
  savePillText: { color: CHAT_BG, fontSize: 11, fontWeight: '800' },

  mainContent: { padding: 14, gap: 8, paddingBottom: 28 },
  logisticsTabBar: {
    marginHorizontal: -14,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  logisticsTabRow: { paddingHorizontal: 14, gap: 20 },
  logisticsTab: { minHeight: 40, justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  logisticsTabText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  logisticsTabTextActive: { color: ACCENT_GOLD, fontWeight: '700' },
  logisticsTabIndicator: { width: '100%', height: 2, backgroundColor: 'transparent', borderRadius: 2 },
  logisticsTabIndicatorActive: { backgroundColor: ACCENT_GOLD },

  // Chips
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRowScroll: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  chipRowInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    height: 24, paddingHorizontal: 9, borderRadius: 8, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(201,169,110,0.12)', borderColor: 'rgba(201,169,110,0.35)' },
  chipText: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '600' },
  chipTextActive: { color: ACCENT_GOLD },

  // Sections, fields, cards
  sectionLabel: {
    color: 'rgba(255,255,255,0.32)', fontSize: 9, fontWeight: '600',
    letterSpacing: 0.6, marginTop: 6, marginBottom: 4,
  },
  field: { marginBottom: 4 },
  fieldLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9.5, fontWeight: '600', letterSpacing: 0.3, marginBottom: 5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, height: 42, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  inputWrapperMultiline: { height: undefined, minHeight: 88, alignItems: 'flex-start', paddingVertical: 8 },
  inputField: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, paddingVertical: 0 },
  inputFieldMultiline: { minHeight: 70, paddingTop: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 12, gap: 4, marginTop: 8,
  },

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
  emptyStateText: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', paddingVertical: 12 },
  emptyAction: {
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.3)',
  },
  emptyActionText: { color: ACCENT_GOLD, fontSize: 12, fontWeight: '700' },

  // Modals (identical to Admin)
  modalCard: {
    width: '100%', maxWidth: 460, flexShrink: 1,
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
  modalBodyScroll: { flexShrink: 1 },
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
  userPillName: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  userPillEmail: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 },

});


/* ─────────── Live editor styles ─────────── */
const GOOD = '#77C89B';
const CAUTION = '#E5A45C';

// One card recipe for every section so spacing stays consistent.
const CARD = {
  marginHorizontal: 10,
  backgroundColor: PC.bgPanel,
  borderRadius: PC.radius,
  borderWidth: 1,
  borderColor: PC.border,
  padding: 12,
} as const;

const vp = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row', minHeight: 0, marginTop: 6, backgroundColor: PC.bgCard },
  leftColumn: { backgroundColor: PC.bgCard, borderRightWidth: 1, borderRightColor: PC.border },
  rightColumn: { flex: 1, minWidth: 0 },
  rightContent: { paddingTop: 4, paddingBottom: 18, gap: 10 },

  hintRow: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.08)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)',
  },
  hintText: { flexShrink: 1, color: 'rgba(201,169,110,0.85)', fontSize: 9.5 },

  // Inline-editable text: a quiet gold tint at rest, a clear gold outline while typing
  editable: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, includeFontPadding: false,
    backgroundColor: 'rgba(201,169,110,0.07)',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.28)',
  },
  editableFocused: { backgroundColor: 'rgba(201,169,110,0.13)', borderColor: PC.gold },

  // Header card
  headerCard: { ...CARD },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subtitleInput: { fontSize: 9, color: PC.textFaint, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  titleInput: { fontSize: 18, fontWeight: '800', color: PC.textPrimary },
  elevBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: PC.radiusBtn, backgroundColor: PC.gold,
  },
  elevInput: { color: PC.bgCard, fontSize: 10, fontWeight: '700', minWidth: 52, padding: 0 },
  elevationEditable: {
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(14,21,32,0.10)', borderWidth: 1, borderColor: 'rgba(14,21,32,0.28)',
  },
  elevFocused: { backgroundColor: 'rgba(14,21,32,0.2)', borderColor: PC.bgCard },

  statsGrid: { flexDirection: 'row', gap: 6, marginTop: 10 },
  statChip: {
    flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: PC.border,
  },
  statChipLabel: { fontSize: 8, color: PC.textFaint, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statChipInput: { fontSize: 10, color: PC.textPrimary, fontWeight: '700', textAlign: 'center', alignSelf: 'stretch' },

  // Section cards
  panel: { ...CARD },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  panelAccent: { width: 3, height: 14, borderRadius: 2, backgroundColor: PC.gold },
  panelTitle: { fontSize: 11, fontWeight: '700', color: PC.textPrimary, letterSpacing: 0.3 },
  innerDivider: { height: 1, backgroundColor: PC.border, marginVertical: 12 },

  descriptionInput: {
    fontSize: 12, color: PC.textSecondary, lineHeight: 18, minHeight: 72,
    paddingVertical: 6, margin: 0,
  },
  bestTimeInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bestTimeInlineText: {
    fontSize: 11, fontWeight: '600', color: PC.gold, flex: 1,
    margin: 0, minHeight: 24,
  },
  difficultyRowInline: { flexDirection: 'row', gap: 6 },
  difficultyChip: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  difficultyLabel: {
    fontSize: 8, color: PC.textFaint, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  difficultyValue: {
    fontSize: 10, color: PC.textPrimary, fontWeight: '700', textAlign: 'center',
    margin: 0, minWidth: 0, alignSelf: 'stretch', minHeight: 26,
  },
  statusEditable: { color: PC.green },
  statDividerV: { width: 1, alignSelf: 'stretch', backgroundColor: PC.borderSubtle },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 8, paddingRight: 6, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.07)', borderWidth: 1, borderColor: PC.borderGold,
  },
  tagInput: {
    minWidth: 34, maxWidth: 120, padding: 0, paddingVertical: 1, includeFontPadding: false,
    borderBottomWidth: 1, borderBottomColor: 'transparent',
    color: PC.gold, fontSize: 10, fontWeight: '600',
  },
  tagInputFocused: { borderBottomColor: PC.gold },

  // "Add" affordances
  addItemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(201,169,110,0.4)',
  },
  addItemButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 8, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(201,169,110,0.4)',
  },
  addItemText: { color: PC.gold, fontSize: 9.5, fontWeight: '700' },

  // What to expect
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: PC.border,
  },
  featureIconButton: {
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201,169,110,0.35)',
    backgroundColor: 'rgba(201,169,110,0.08)',
  },
  iconPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6, marginLeft: 38,
    padding: 8, borderRadius: 10, backgroundColor: PC.bgSubtle, borderWidth: 1, borderColor: PC.border,
  },
  iconOption: {
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: PC.borderSubtle, backgroundColor: PC.bgSubtle,
  },
  iconOptionActive: { borderColor: PC.gold, backgroundColor: 'rgba(201,169,110,0.16)' },
  featureInput: { flex: 1, minWidth: 0, color: PC.textSecondary, fontSize: 10, lineHeight: 14, paddingVertical: 4 },
  featureInputCaution: { color: CAUTION },
  featureStatusButton: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(119,200,155,0.35)', backgroundColor: 'rgba(119,200,155,0.1)',
  },
  featureStatusButtonCaution: { borderColor: 'rgba(229,164,92,0.4)', backgroundColor: 'rgba(229,164,92,0.1)' },
  featureStatus: { color: GOOD, fontSize: 8.5, fontWeight: '700' },
  featureStatusCaution: { color: CAUTION },

  // Trail notes
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  noteIcon: { marginTop: 8 },
  noteInput: { flex: 1, minWidth: 0, color: PC.textSecondary, fontSize: 10, lineHeight: 14, paddingVertical: 4 },
});

// Mountain info tab: mirrors a Home slide (photo + floating info)
const mt = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 20, gap: 10 },
  hero: {
    height: 190, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: PC.border,
    justifyContent: 'flex-end', padding: 16,
  },
  heroPlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,13,0.3)' },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  previewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  previewLocation: { flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '600' },
  previewName: {
    color: '#FFFFFF', fontSize: 26, lineHeight: 31, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  funnyWarning: { color: 'rgba(255,255,220,0.8)', fontSize: 10, fontStyle: 'italic', marginTop: 4 },
  editCard: {
    padding: 14, gap: 12, borderRadius: 14, backgroundColor: PC.bgPanel,
    borderWidth: 1, borderColor: PC.border,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  sectionIcon: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  sectionHeadingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: PC.textPrimary, fontSize: 13, fontWeight: '800' },
  sectionSubtitle: { color: PC.textFaint, fontSize: 10, marginTop: 2 },
  field: { gap: 5 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1, minWidth: 0 },
  fieldLabel: { color: PC.textFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase' },
  fieldInput: {
    minHeight: 40, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9,
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.32)', backgroundColor: PC.bgCard,
    color: PC.textPrimary, fontSize: 12,
  },
  fieldInputFocused: { borderColor: PC.gold, backgroundColor: 'rgba(201,169,110,0.06)' },
  inputWithIcon: {
    minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, borderRadius: 9, borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.32)', backgroundColor: PC.bgCard,
  },
  compactFieldInput: { flex: 1, minWidth: 0, paddingVertical: 8, color: PC.textPrimary, fontSize: 11 },
  compactFieldInputFocused: { borderBottomWidth: 1, borderBottomColor: PC.gold },
  difficultyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  difficultyOption: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7,
    borderRadius: 18, borderWidth: 1, borderColor: PC.borderSubtle, backgroundColor: PC.bgCard,
  },
  difficultyOptionText: { color: PC.textFaint, fontSize: 10, fontWeight: '600' },
  descriptionInput: { minHeight: 100, lineHeight: 18 },
  guideCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.06)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  guideIcon: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)',
  },
  guideTitle: { color: PC.textPrimary, fontSize: 11, fontWeight: '700' },
  guideSubtitle: { color: PC.textFaint, fontSize: 9, lineHeight: 13, marginTop: 2 },
});