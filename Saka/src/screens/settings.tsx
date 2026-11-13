// Settings.tsx — desktop-style layout (sidebar + main panel, same shell as Admin/Manager).
// Native Alert.alert popups are replaced by in-app toasts and AdminModal dialogs.
// Behaviour and data layer are unchanged.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useLocationTracking } from '../hooks/useLocationTracking';
import {
  getNotificationPermissionStatus,
  requestPermissions as requestNotificationPermissions,
} from '../services/hikeSafetyNotifications';
import {
  getOfflineStatusSnapshot,
  type OfflineStatusSnapshot,
} from '../services/offlineStatusService';
import { retryJournalWriteQueue } from '../services/journalService';
import { flushSakagramLikeQueue } from '../services/sakagramService';
import { retryTextMessageQueue } from '../services/offlineMessageQueue';
import { retryProfileUpdateQueue } from '../services/offlineProfileService';
import locationService from '../services/locationService';
import AdminModal from '../admin/AdminModal';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../theme/designTokens';

const EMPTY_OFFLINE_STATUS: OfflineStatusSnapshot = { queues: [], savedData: [] };
const SIDEBAR_W = 220;
const CONTENT_MAX_W = 760;
const GREEN = '#6FAF8A';
const RED = '#E07070';

type Section = 'safety' | 'notifications' | 'offline' | 'privacy' | 'account' | 'about' | 'credits';
type ToastType = 'success' | 'error' | 'warning';

const SECTIONS: { id: Section; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'safety', label: 'Hiking safety', subtitle: 'Emergency contacts and location tracking', icon: 'shield-checkmark-outline' },
  { id: 'notifications', label: 'Notifications', subtitle: 'Safety reminders on this device', icon: 'notifications-outline' },
  { id: 'offline', label: 'Offline & sync', subtitle: 'Items saved on this device waiting for a connection', icon: 'cloud-offline-outline' },
  { id: 'privacy', label: 'Privacy', subtitle: 'How your data is used', icon: 'lock-closed-outline' },
  { id: 'account', label: 'Account', subtitle: 'Password and sign out', icon: 'person-outline' },
  { id: 'about', label: 'About', subtitle: 'Version and app information', icon: 'information-circle-outline' },
  { id: 'credits', label: 'Credits', subtitle: 'The people behind Saka', icon: 'ribbon-outline' },
];

/* ─────────── Row: icon, text, trailing action (desktop list row) ─────────── */
function SettingRow({
  icon,
  label,
  description,
  onPress,
  trailing,
  danger = false,
  last = false,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[ss.row, last && ss.rowLast, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
    >
      <View style={[ss.rowIcon, danger && ss.rowIconDanger]}>
        <Ionicons name={icon} size={15} color={danger ? RED : ACCENT_GOLD} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ss.rowLabel, danger && { color: RED }]}>{label}</Text>
        <Text style={ss.rowDesc}>{description}</Text>
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />}
    </TouchableOpacity>
  );
}

function ActionPill({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'danger' | 'ghost' }) {
  return (
    <View style={[ss.pill, tone === 'gold' && ss.pillGold, tone === 'danger' && ss.pillDanger]}>
      <Text style={[ss.pillText, tone === 'gold' && { color: ACCENT_GOLD }, tone === 'danger' && { color: RED }]}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, resetPassword, signOut } = useAuthStore();
  const { trackingStatus, permissions } = useLocationTracking();
  const [activeSection, setActiveSection] = useState<Section>('safety');
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);
  const [offlineStatus, setOfflineStatus] = useState(EMPTY_OFFLINE_STATUS);
  const [loadingOfflineStatus, setLoadingOfflineStatus] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Dialogs (AdminModal)
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [notifDeniedVisible, setNotifDeniedVisible] = useState(false);

  // ── Feedback toast (same look as Admin / Manager) ──
  const [toast, setToast] = useState<{ type: ToastType; title: string; msg: string } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(8)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((type: ToastType, title: string, msg: string) => {
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
    }, 3200);
  }, [toastOpacity, toastY]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const refreshSettingsStatus = useCallback(async (): Promise<OfflineStatusSnapshot | null> => {
    setLoadingOfflineStatus(true);
    const [notificationResult, offlineResult] = await Promise.allSettled([
      getNotificationPermissionStatus(),
      getOfflineStatusSnapshot(),
    ]);

    if (notificationResult.status === 'fulfilled') {
      setNotificationPermission(notificationResult.value);
    } else {
      console.warn('[Settings] Failed to read notification permission:', notificationResult.reason);
    }

    if (offlineResult.status === 'fulfilled') {
      setOfflineStatus(offlineResult.value);
    } else {
      console.warn('[Settings] Failed to read offline sync status:', offlineResult.reason);
      showToast('error', 'Status unavailable', 'Unable to read offline sync status from this device.');
    }
    setLoadingOfflineStatus(false);
    return offlineResult.status === 'fulfilled' ? offlineResult.value : null;
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      void refreshSettingsStatus();
    }, [refreshSettingsStatus]),
  );

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('[Settings] Unable to open device settings:', error);
      showToast('error', 'Unable to open settings', 'Please manage Saka permissions in your device settings.');
    }
  };

  const handleNotificationPermission = async () => {
    try {
      if (notificationPermission === null) {
        showToast('warning', 'Notifications unavailable', 'Safety reminder notifications are not available in this app runtime.');
        return;
      }

      if (notificationPermission === true) {
        await openDeviceSettings();
        return;
      }

      const granted = await requestNotificationPermissions();
      setNotificationPermission(granted);
      if (!granted) setNotifDeniedVisible(true);
    } catch (error) {
      console.error('[Settings] Unable to update notification permissions:', error);
      showToast('error', 'Unable to open settings', 'Please manage Saka notifications in your device settings.');
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email?.trim();
    if (!email) {
      showToast('warning', 'Email unavailable', 'Add an email address to your account before requesting a password reset.');
      return;
    }

    setSendingReset(true);
    try {
      const result = await resetPassword(email);
      if (!result.success) throw new Error(result.error || 'Unable to send password reset email.');
      showToast('success', 'Check your email', `We sent a password reset link to ${email}.`);
    } catch (error) {
      console.error('[Settings] Password reset request failed:', error);
      showToast('error', 'Could not send reset link', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setSendingReset(false);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      if (useAuthStore.getState().isAuthenticated) {
        setSignOutVisible(false);
        showToast('error', 'Sign out failed', 'You are still signed in. Please try again.');
        return;
      }
      setSignOutVisible(false);
      router.replace('/Login');
    } finally {
      setSigningOut(false);
    }
  };

  const handleRetrySync = async () => {
    setRetryingSync(true);
    const results = await Promise.allSettled([
      retryJournalWriteQueue(),
      flushSakagramLikeQueue(),
      retryTextMessageQueue(),
      retryProfileUpdateQueue(),
      locationService.retryQueuedUploads(),
    ]);
    const failures = results.filter((result) => result.status === 'rejected');
    const latestStatus = await refreshSettingsStatus();
    setRetryingSync(false);

    const stillPending = latestStatus?.queues.some((queue) => queue.count > 0) ?? true;

    if (failures.length > 0 || stillPending) {
      console.warn('[Settings] Some offline items could not be synced:', failures);
      showToast('warning', 'Some items are still pending', 'Check your connection and try again. Your saved items remain on this device.');
    } else {
      showToast('success', 'Sync complete', 'Pending offline items have been retried.');
    }
  };

  const pendingCount = offlineStatus.queues.reduce((total, queue) => total + queue.count, 0);
  const trackingActive = trackingStatus.isForegroundActive || trackingStatus.isBackgroundActive;
  const version = Constants.expoConfig?.version ?? 'Unavailable';
  const displayName = profile?.full_name || user?.email || 'Your account';
  const displayEmail = profile?.email || user?.email || '';
  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  // ── Modal shell (same card as Admin popups) ──
  const renderModalShell = (
    visible: boolean,
    onClose: () => void,
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    children: React.ReactNode,
    footer: React.ReactNode,
    locked = false,
    danger = false,
  ) => (
    <AdminModal visible={visible} onClose={onClose} locked={locked}>
      <View style={ss.modalCard}>
        <View style={ss.modalHeader}>
          <View style={ss.modalTitleRow}>
            <View style={[ss.modalIconWrap, danger && ss.modalIconWrapDanger]}>
              <Ionicons name={icon} size={13} color={danger ? RED : ACCENT_GOLD} />
            </View>
            <Text style={ss.modalTitle} numberOfLines={1}>{title}</Text>
          </View>
          <TouchableOpacity onPress={() => { if (!locked) onClose(); }} style={ss.modalClose}>
            <Ionicons name="close" size={13} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>
        <View style={ss.modalBody}>{children}</View>
        <View style={ss.modalFooter}>{footer}</View>
      </View>
    </AdminModal>
  );

  const renderModalAction = (
    label: string,
    onPress: () => void,
    variant: 'ghost' | 'primary' | 'danger' = 'ghost',
    icon?: keyof typeof Ionicons.glyphMap,
    disabled = false,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        ss.modalActionBtn,
        variant === 'primary' && ss.modalActionPrimary,
        variant === 'danger' && ss.modalActionDanger,
        disabled && { opacity: 0.6 },
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

  // ── Sections ──
  const renderSection = () => {
    switch (activeSection) {
      case 'safety':
        return (
          <>
            <View style={ss.card}>
              <SettingRow
                icon="people-outline"
                label="Emergency contacts"
                description="Manage the people you would contact for help"
                onPress={() => router.push('/EmergencyContacts')}
                trailing={<ActionPill label="Manage" tone="ghost" />}
              />
              <SettingRow
                icon="navigate-outline"
                label="Location tracker"
                description={trackingActive
                  ? 'Tracking is active. Open controls or stop tracking.'
                  : permissions.foreground
                    ? 'Tracking is paused. Start it when you need it.'
                    : 'Location permission is needed to record a hike.'}
                onPress={() => router.push('/Location')}
                last
                trailing={(
                  <View style={ss.statusTrailing}>
                    <View style={[ss.statusDot, { backgroundColor: trackingActive ? CHAT_ONLINE : 'rgba(255,255,255,0.25)' }]} />
                    <Text style={[ss.statusText, trackingActive && { color: GREEN }]}>{trackingActive ? 'Active' : 'Paused'}</Text>
                    <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
                  </View>
                )}
              />
            </View>
            <Text style={ss.note}>
              Tracking is controlled from the Location screen. Safety check reminders are scheduled for hikes and events.
            </Text>
          </>
        );

      case 'notifications':
        return (
          <View style={ss.card}>
            <SettingRow
              icon="notifications-outline"
              label={notificationPermission === true ? 'Notifications allowed' : 'Notification permission'}
              description={notificationPermission === null
                ? 'Safety reminder notifications are unavailable in this app runtime'
                : notificationPermission
                  ? 'Safety reminders can appear on this device'
                  : 'Enable notifications for hike and event safety reminders'}
              onPress={() => { void handleNotificationPermission(); }}
              last
              trailing={<ActionPill label={notificationPermission === true ? 'Manage' : 'Enable'} tone="gold" />}
            />
          </View>
        );

      case 'offline':
        return (
          <>
            <View style={ss.card}>
              {loadingOfflineStatus ? (
                <View style={ss.cardPad}>
                  <ActivityIndicator color={ACCENT_GOLD} />
                </View>
              ) : pendingCount === 0 ? (
                <View style={[ss.cardPad, ss.inlineRow]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={GREEN} />
                  <Text style={ss.rowLabel}>No items are waiting to sync.</Text>
                </View>
              ) : (
                <>
                  <View style={[ss.cardPad, ss.cardPadBorder]}>
                    <Text style={ss.rowLabel}>
                      {pendingCount} item{pendingCount === 1 ? '' : 's'} waiting to sync
                    </Text>
                  </View>
                  {offlineStatus.queues.map((queue, index) => (
                    <View
                      key={queue.label}
                      style={[ss.queueRow, index === offlineStatus.queues.length - 1 && ss.rowLast]}
                    >
                      <Text style={ss.rowDesc}>{queue.label}</Text>
                      <View style={ss.inlineRow}>
                        {queue.failed > 0 && (
                          <View style={[ss.miniBadge, { borderColor: 'rgba(224,112,112,0.35)' }]}>
                            <Text style={[ss.miniBadgeText, { color: RED }]}>{queue.failed} failed</Text>
                          </View>
                        )}
                        <Text style={ss.queueCount}>{queue.count}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={ss.cardFooter}>
                    <TouchableOpacity
                      style={[ss.primaryBtn, retryingSync && { opacity: 0.6 }]}
                      onPress={() => { void handleRetrySync(); }}
                      disabled={retryingSync}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      {retryingSync ? (
                        <ActivityIndicator size="small" color={CHAT_BG} />
                      ) : (
                        <>
                          <Ionicons name="sync-outline" size={13} color={CHAT_BG} />
                          <Text style={ss.primaryBtnText}>Retry sync</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            <Text style={ss.note}>
              GPS tracks, journal entries and photos, messages, likes, and profile changes may wait here until a connection is available.
            </Text>
          </>
        );

      case 'privacy':
        return (
          <View style={[ss.card, ss.cardPad, ss.inlineRow, { alignItems: 'flex-start', gap: 12 }]}>
            <View style={ss.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={15} color={ACCENT_GOLD} />
            </View>
            <Text style={[ss.rowDesc, { flex: 1, lineHeight: 18 }]}>
              Location is used for hike tracking and safety. Emergency contacts are saved to your account. Journal entries have their own visibility setting.
            </Text>
          </View>
        );

      case 'account':
        return (
          <>
            <View style={[ss.card, ss.cardPad, ss.inlineRow, { gap: 12 }]}>
              <View style={ss.avatar}>
                <Text style={ss.avatarText}>{(displayName[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ss.accountName} numberOfLines={1}>{displayName}</Text>
                <Text style={ss.rowDesc} numberOfLines={1}>{displayEmail}</Text>
              </View>
            </View>
            <View style={ss.card}>
              <SettingRow
                icon="key-outline"
                label="Reset password"
                description="Send a secure password reset link to your account email"
                onPress={() => { void handlePasswordReset(); }}
                disabled={sendingReset}
                trailing={sendingReset
                  ? <ActivityIndicator size="small" color={ACCENT_GOLD} />
                  : <ActionPill label="Send link" tone="gold" />}
              />
              <SettingRow
                icon="log-out-outline"
                label="Sign out"
                description="Sign out of this Saka account"
                onPress={() => setSignOutVisible(true)}
                danger
                last
                trailing={<ActionPill label="Sign out" tone="danger" />}
              />
            </View>
          </>
        );

      case 'about':
        return (
          <View style={ss.card}>
            <View style={[ss.cardPad, ss.cardPadBorder, ss.inlineRow, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={ss.rowLabel}>Saka version</Text>
                <Text style={ss.rowDesc}>Version {version}</Text>
              </View>
              <View style={ss.headerPill}>
                <Text style={ss.headerPillText}>v{version}</Text>
              </View>
            </View>
            <View style={ss.cardPad}>
              <Text style={ss.aboutTitle}>Your companion for the outdoors</Text>
              <Text style={[ss.rowDesc, { lineHeight: 18, marginTop: 4 }]}>
                Saka helps you explore mountains, discover wildlife, plan hikes, and stay safer on the trail with location tracking, emergency contacts, and hike check-ins.
              </Text>
            </View>
          </View>
        );

      case 'credits':
        return (
          <>
            <View style={ss.card}>
              <View style={[ss.cardPad, ss.cardPadBorder]}>
                <Text style={ss.aboutTitle}>Saka</Text>
                <Text style={[ss.rowDesc, { marginTop: 2 }]}>Peaks Around Aklan: First Steps</Text>
              </View>
              {['Angel Lanorias', 'Joy Dagohoy', 'Renz Ibañez', 'Carlos Conanan', 'Jered Asuncion'].map((owner, index, list) => (
                <View key={owner} style={[ss.row, index === list.length - 1 && ss.rowLast]}>
                  <View style={ss.avatar}>
                    <Text style={ss.avatarText}>{owner[0]}</Text>
                  </View>
                  <Text style={ss.rowLabel}>{owner}</Text>
                </View>
              ))}
            </View>
            <Text style={ss.note}>All rights reserved by the owners listed above.</Text>
          </>
        );
    }
  };

  return (
    <>
      {/* Sign out confirm */}
      {renderModalShell(
        signOutVisible,
        () => setSignOutVisible(false),
        'Sign out of Saka?',
        'log-out-outline',
        <>
          <View style={ss.userPill}>
            <View style={ss.avatar}>
              <Text style={ss.avatarText}>{(displayName[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ss.userPillName} numberOfLines={1}>{displayName}</Text>
              <Text style={ss.userPillEmail} numberOfLines={1}>{displayEmail}</Text>
            </View>
          </View>
          <Text style={ss.modalDesc}>You will need to sign in again to access your account.</Text>
        </>,
        <>
          {renderModalAction('Cancel', () => setSignOutVisible(false), 'ghost', undefined, signingOut)}
          {renderModalAction(signingOut ? 'Signing out…' : 'Sign out', () => { void confirmSignOut(); }, 'danger', 'log-out-outline', signingOut)}
        </>,
        signingOut,
        true,
      )}

      {/* Notifications not enabled */}
      {renderModalShell(
        notifDeniedVisible,
        () => setNotifDeniedVisible(false),
        'Notifications not enabled',
        'notifications-off-outline',
        <Text style={ss.modalDesc}>
          Allow notifications in your device settings to receive hike and event safety reminders.
        </Text>,
        <>
          {renderModalAction('Not now', () => setNotifDeniedVisible(false))}
          {renderModalAction('Open settings', () => { setNotifDeniedVisible(false); void openDeviceSettings(); }, 'primary', 'settings-outline')}
        </>,
      )}

      <SafeAreaView style={ss.screen} edges={['top', 'left', 'right']}>
        <View style={ss.shell}>
          {/* ── SIDEBAR ── */}
          <View style={ss.sidebar}>
            <View style={ss.sidebarHeader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={ss.backBtn}
                hitSlop={8}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={16} color={ACCENT_GOLD} />
              </TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ss.sidebarTitle} numberOfLines={1}>Settings</Text>
                <View style={ss.statusRow}>
                  <View style={[ss.statusDot, { backgroundColor: CHAT_ONLINE }]} />
                  <Text style={ss.headerStatusText} numberOfLines={1}>{displayEmail || 'Signed in'}</Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.railContent}>
              {SECTIONS.map((s) => {
                const isActive = activeSection === s.id;
                const needsAttention =
                  (s.id === 'offline' && pendingCount > 0) ||
                  (s.id === 'notifications' && notificationPermission === false);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setActiveSection(s.id)}
                    activeOpacity={0.75}
                    style={[ss.railItem, isActive && ss.railItemActive]}
                  >
                    <Ionicons name={s.icon} size={16} color={isActive ? ACCENT_GOLD : TEXT_MUTED} />
                    <Text style={[ss.railLabel, isActive && ss.railLabelActive]} numberOfLines={1}>{s.label}</Text>
                    {needsAttention && (
                      <View style={ss.railBadge}>
                        <Text style={ss.railBadgeText}>
                          {s.id === 'offline' ? (pendingCount > 99 ? '99+' : pendingCount) : '!'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={ss.sidebarFooter}>
              <TouchableOpacity onPress={() => { void refreshSettingsStatus(); }} activeOpacity={0.85} style={ss.footerBtn}>
                <Ionicons name="refresh" size={13} color={TEXT_MUTED} />
                <Text style={ss.footerBtnText}>Refresh status</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── MAIN PANEL ── */}
          <View style={ss.main}>
            <View style={ss.panelHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ss.panelTitle} numberOfLines={1}>{section.label}</Text>
                <Text style={ss.panelSubtitle} numberOfLines={1}>{section.subtitle}</Text>
              </View>
              <View style={ss.headerPill}>
                <Text style={ss.headerPillText}>Saka {version}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={ss.mainScroll} showsVerticalScrollIndicator={false}>
              <View style={ss.mainContent}>{renderSection()}</View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>

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
            toast.type === 'success' && { backgroundColor: GREEN },
            toast.type === 'error' && { backgroundColor: RED },
            toast.type === 'warning' && { backgroundColor: ACCENT_GOLD },
          ]} />
          <View style={ss.feedbackToastIcon}>
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'warning'}
              size={15}
              color={toast.type === 'success' ? GREEN : toast.type === 'error' ? RED : ACCENT_GOLD}
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

/* ─────────── Styles (shared look with Admin / Manager) ─────────── */
const ss = StyleSheet.create({
  // Shell
  screen: { flex: 1, backgroundColor: CHAT_BG },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: CHAT_BG },

  // Sidebar
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
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  headerStatusText: { flexShrink: 1, fontSize: 9.5, color: TEXT_MUTED, fontWeight: '500', letterSpacing: 0.2 },

  railContent: { padding: 8, gap: 2 },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 34, borderRadius: 9 },
  railItemActive: { backgroundColor: 'rgba(201,169,110,0.12)' },
  railLabel: { flex: 1, color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  railLabelActive: { color: TEXT_PRIMARY },
  railBadge: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: ACCENT_GOLD, alignItems: 'center', justifyContent: 'center',
  },
  railBadgeText: { color: CHAT_BG, fontSize: 9, fontWeight: '800' },

  sidebarFooter: { padding: 8, gap: 6, borderTopWidth: 1, borderTopColor: CHAT_BORDER },
  footerBtn: {
    height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  footerBtnText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },

  // Main
  main: { flex: 1, minWidth: 0, backgroundColor: CHAT_BG },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 52, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: CHAT_BORDER,
  },
  panelTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  panelSubtitle: { color: TEXT_MUTED, fontSize: 10.5, marginTop: 1 },
  headerPill: {
    height: 22, paddingHorizontal: 8, borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerPillText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },
  mainScroll: { padding: 20, paddingBottom: 32 },
  mainContent: { width: '100%', maxWidth: CONTENT_MAX_W, alignSelf: 'flex-start', gap: 10 },

  // Cards + rows
  card: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  cardPad: { padding: 14 },
  cardPadBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)',
  },
  rowIconDanger: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.25)' },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: '700' },
  rowDesc: { color: TEXT_MUTED, fontSize: 11, marginTop: 2, lineHeight: 15 },
  note: { color: 'rgba(255,255,255,0.32)', fontSize: 10.5, lineHeight: 15, paddingHorizontal: 2 },

  pill: {
    paddingHorizontal: 10, height: 24, borderRadius: 8, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillGold: { backgroundColor: 'rgba(201,169,110,0.1)', borderColor: 'rgba(201,169,110,0.3)' },
  pillDanger: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.3)' },
  pillText: { color: TEXT_MUTED, fontSize: 10.5, fontWeight: '700' },

  statusTrailing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700' },

  queueRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  queueCount: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '800' },
  miniBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  miniBadgeText: { fontSize: 9, fontWeight: '700' },

  primaryBtn: {
    height: 30, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT_GOLD,
  },
  primaryBtnText: { color: CHAT_BG, fontSize: 11.5, fontWeight: '800' },

  avatar: {
    width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.12)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)',
  },
  avatarText: { color: ACCENT_GOLD, fontSize: 14, fontWeight: '700' },
  accountName: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  aboutTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },

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
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  modalIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalIconWrapDanger: { backgroundColor: 'rgba(224,112,112,0.1)', borderColor: 'rgba(224,112,112,0.25)' },
  modalTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, flexShrink: 1 },
  modalClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  modalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  modalDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalActionPrimary: { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD },
  modalActionDanger: { backgroundColor: RED, borderColor: RED },
  modalActionText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  userPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 10,
  },
  userPillName: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  userPillEmail: { color: TEXT_MUTED, fontSize: 10, marginTop: 1 },

  // Toast (identical to Admin / Manager)
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