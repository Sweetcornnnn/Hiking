import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';

interface ProfileCardProps {
  visible: boolean;
  onClose: () => void;
  profileImage?: string | null;
}

const MOUNTAINS_DATA = [
  { id: '1', name: 'Mt. Madja-as', unlocked: true },
  { id: '2', name: 'Mt. Guiting-Guiting', unlocked: false },
  { id: '3', name: 'Mt. Pulag', unlocked: false },
  { id: '4', name: 'Mt. Apo', unlocked: false },
  { id: '5', name: 'Mt. Mayon', unlocked: false },
  { id: '6', name: 'Mt. Batulao', unlocked: false },
  { id: '7', name: 'Mt. Maculot', unlocked: false },
  { id: '8', name: 'Mt. Ulap', unlocked: false },
  { id: '9', name: 'Mt. Pinatubo', unlocked: false },
  { id: '10', name: 'Mt. Kanlaon', unlocked: false },
];

const screenDimensions = Dimensions.get('screen');

export default function ProfileCard({ visible, onClose, profileImage }: ProfileCardProps) {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [location, setLocation] = useState<string>('Loading...');
  const [unlockedCount, setUnlockedCount] = useState(0);

  useEffect(() => {
    if (visible) {
      const count = MOUNTAINS_DATA.filter(m => m.unlocked).length;
      setUnlockedCount(count);
      setLocation('Mountain Trail');
    }
  }, [visible]);

  const handleLogout = async () => {
    onClose();
    await signOut();
  };

  const handleSettings = () => {
    onClose();
    router.push('/settings');
  };

  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'H';

  const progressPercent = (unlockedCount / MOUNTAINS_DATA.length) * 100;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.centerContainer}>
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={onClose}>

          {/* ── Left panel ── */}
          <View style={styles.leftPanel}>
            {/* Avatar */}
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>

            {/* Name / email */}
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Hiker'}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email || 'email@example.com'}</Text>

            {/* Location */}
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color="#8A9BB0" />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
            </View>

            {/* Divider */}
            <View style={styles.dividerH} />

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{unlockedCount}</Text>
                <Text style={styles.statLbl}>done</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{MOUNTAINS_DATA.length - unlockedCount}</Text>
                <Text style={styles.statLbl}>left</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{unlockedCount} of {MOUNTAINS_DATA.length} peaks</Text>

            {/* Spacer pushes buttons to bottom */}
            <View style={{ flex: 1 }} />

            {/* Action buttons */}
            <TouchableOpacity style={styles.settingsBtn} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.settingsBtnText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={13} color="#E07070" />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* ── Vertical divider ── */}
          <View style={styles.dividerV} />

          {/* ── Right panel: mountains list ── */}
          <View style={styles.rightPanel}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Mountains</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              {MOUNTAINS_DATA.map((mountain, index) => (
                <View
                  key={mountain.id}
                  style={[
                    styles.mountainRow,
                    index === MOUNTAINS_DATA.length - 1 && styles.mountainRowLast,
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      mountain.unlocked && styles.dotUnlocked,
                    ]}
                  />
                  <Text
                    style={[
                      styles.mountainName,
                      !mountain.unlocked && styles.mountainNameLocked,
                    ]}
                    numberOfLines={1}
                  >
                    {mountain.name}
                  </Text>
                  {mountain.unlocked && (
                    <Text style={styles.summitedTag}>summit</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  // ── Card ────────────────────────────────────
  card: {
    flexDirection: 'row',
    width: '78%',
    maxWidth: 560,
    height: 280,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // ── Left panel ──────────────────────────────
  leftPanel: {
    width: 160,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'flex-start',
    backgroundColor: '#111927',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E2D42',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.4)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#C9A96E',
    fontSize: 14,
    fontWeight: '700',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  email: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    marginBottom: 6,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 10,
  },
  locationText: {
    color: '#8A9BB0',
    fontSize: 10,
  },

  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 0,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statSep: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  statLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    alignSelf: 'stretch',
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C9A96E',
    borderRadius: 2,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 9,
    marginBottom: 0,
  },

  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 5,
    justifyContent: 'center',
  },
  settingsBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 7,
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

  // ── Vertical divider ─────────────────────────
  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // ── Right panel ──────────────────────────────
  rightPanel: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 14,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingHorizontal: 14,
  },

  mountainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  mountainRowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotUnlocked: {
    backgroundColor: '#C9A96E',
  },
  mountainName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  mountainNameLocked: {
    color: 'rgba(255,255,255,0.35)',
  },
  summitedTag: {
    color: '#6FAF8A',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});