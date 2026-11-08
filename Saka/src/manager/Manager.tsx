// Manager.tsx — restyled to match Admin (same ChatScreen shell: sidebar rail + main panel,
// CHAT_* tokens, feedback/logout toasts, AdminModal popups). Data layer unchanged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import AdminModal from '../admin/AdminModal';
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

type ToastType = 'success' | 'error' | 'warning';

export default function ManagerScreen() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('mountain');
  const [activeLogisticsTab, setActiveLogisticsTab] = useState<LogisticsTab>('transportation');
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [content, setContent] = useState<ManagerMountainContent | null>(null);
  const [viewpoints, setViewpoints] = useState<ManagedViewpoint[]>([]);
  const [selectedViewpointId, setSelectedViewpointId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // ── Feedback toast (same as Admin) ──
  const [toast, setToast] = useState<{ type: ToastType; title: string; msg: string } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(8)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (type: ToastType, title: string, msg: string) => {
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
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── Logout confirm (same as Admin) ──
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

  // ── Data ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/Login');
      return;
    }
    if (!profile || profile.role !== 'manager') {
      router.replace('/Home');
      return;
    }
    let active = true;
    void managerService.fetchAssignedMountains(user.id)
      .then((rows) => {
        if (!active) return;
        setMountains(rows);
        if (rows[0]) setSelectedId(rows[0].id);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load manager dashboard.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, profile, router, user]);

  useEffect(() => {
    if (!selectedMountain || !user) return;
    let active = true;
    setError(null);
    setContent(null);
    setSelectedViewpointId('');
    void Promise.all([
      managerService.fetchContent(selectedMountain.id, selectedMountain.name),
      managerService.fetchViewpoints(selectedMountain.id),
    ]).then(([nextContent, nextViewpoints]) => {
      if (!active) return;
      setContent(nextContent);
      setViewpoints(nextViewpoints);
      setDescription(selectedMountain.description ?? '');
      setName(selectedMountain.name ?? '');
      setLocation(selectedMountain.location ?? '');
      setElevation(String(selectedMountain.elevation ?? 0));
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load mountain details.');
    });
    return () => { active = false; };
  }, [selectedMountain, user]);

  const updateViewpoint = (field: keyof ManagedViewpoint, value: string) => {
    if (!selectedViewpoint) return;
    setViewpoints((items) => items.map((item) => item.id === selectedViewpoint.id
      ? { ...item, [field]: value }
      : item));
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
    setError(null);
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
      if (selectedViewpoint) await managerService.saveViewpoint(selectedViewpoint);
      const refreshed = await mountainService.refreshMountainById(selectedMountain.id);
      if (refreshed) setMountains((rows) => rows.map((row) => row.id === refreshed.id ? refreshed : row));
      showToast('success', 'Saved', 'Mountain information, tips, and any selected viewpoint changes were saved.');
    } catch (saveError: unknown) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save changes.';
      setError(message);
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.chipRowScroll}>
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
      <SafeAreaView style={ss.screen} edges={['top', 'left', 'right']}>
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
            {selectedViewpoint ? `, and the “${selectedViewpoint.name}” viewpoint page` : ''}.
          </Text>
        </>,
        <>
          {renderModalAction('Cancel', () => setConfirmSaveVisible(false))}
          {renderModalAction('Save changes', submitSave, 'primary', 'checkmark')}
        </>,
      )}

      {/* MAIN SHELL — same as Admin */}
      <SafeAreaView style={ss.screen} edges={['top', 'left', 'right']}>
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

            {error ? (
              <View style={[ss.alertBanner, { margin: 14, marginBottom: 0 }]}>
                <Ionicons name="alert-circle-outline" size={13} color="#E07070" />
                <Text style={ss.alertBannerText}>{error}</Text>
              </View>
            ) : null}

            {mountains.length === 0 ? (
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

                <ScrollView
                  contentContainerStyle={ss.mainContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── MOUNTAIN INFO ── */}
                  {activeTab === 'mountain' && (
                    <>
                      <Text style={ss.sectionLabel}>HOME MOUNTAIN INFORMATION</Text>
                      <Field label="Mountain name" value={name} onChangeText={setName} />
                      <Field label="Location" value={location} onChangeText={setLocation} />
                      <Field label="Elevation (meters)" value={elevation} onChangeText={setElevation} keyboardType="numeric" />
                      <Field label="Description" value={description} onChangeText={setDescription} multiline />
                      <Text style={ss.fieldLabel}>Difficulty</Text>
                      {renderChips(
                        (['Easy', 'Moderate', 'Hard', 'Expert'] as const).map((v) => ({ id: v, label: v })),
                        difficulty,
                        setDifficulty,
                      )}
                    </>
                  )}

                  {/* ── TIPS & LOGISTICS ── */}
                  {activeTab === 'logistics' && (
                    !content ? (
                      <Text style={ss.emptyStateText}>Loading details…</Text>
                    ) : (
                      <>
                        <Text style={ss.sectionLabel}>EDIT MOUNTAIN GUIDE</Text>
                        <View style={ss.logisticsTabBar}>
                          {renderChips(LOGISTICS_TABS, activeLogisticsTab, setActiveLogisticsTab, true)}
                        </View>

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
                    )
                  )}

                  {/* ── VIEWPOINTS ── */}
                  {activeTab === 'viewpoints' && (
                    <>
                      <Text style={ss.sectionLabel}>VIEWPOINT PAGES</Text>
                      {viewpoints.length === 0 ? (
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
                            <View style={ss.card}>
                              <Field label="Viewpoint name" value={selectedViewpoint.name} onChangeText={(value) => updateViewpoint('name', value)} />
                              <Field label="Subtitle" value={selectedViewpoint.subtitle} onChangeText={(value) => updateViewpoint('subtitle', value)} />
                              <Field label="Description" value={selectedViewpoint.description ?? ''} onChangeText={(value) => updateViewpoint('description', value)} multiline />
                              <Field label="Elevation" value={selectedViewpoint.elevation ?? ''} onChangeText={(value) => updateViewpoint('elevation', value)} />
                              <Field label="Distance from start" value={selectedViewpoint.distance_from_start ?? ''} onChangeText={(value) => updateViewpoint('distance_from_start', value)} />
                              <Field label="Estimated hike" value={selectedViewpoint.estimated_hike ?? ''} onChangeText={(value) => updateViewpoint('estimated_hike', value)} />
                              <Field label="Best time" value={selectedViewpoint.best_time ?? ''} onChangeText={(value) => updateViewpoint('best_time', value)} />
                            </View>
                          ) : (
                            <Text style={ss.emptyStateText}>Select a viewpoint above to edit it.</Text>
                          )}
                        </>
                      )}
                    </>
                  )}
                </ScrollView>
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
            <Text style={ss.logoutToastMsg}>You'll be logged out of the manager panel.</Text>
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

  // Chips
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

  // Error banner
  alertBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(224,112,112,0.08)', borderWidth: 1, borderColor: 'rgba(224,112,112,0.3)',
    borderRadius: 10, padding: 10,
  },
  alertBannerText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },

  // Toasts (identical to Admin)
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