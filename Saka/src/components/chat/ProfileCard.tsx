// components/chat/ProfileCard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_PANEL,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_MODAL,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  created_at?: string | null;
  bio?: string | null;
};

export default function ProfileCard({
  userId,
  visible,
  onClose,
  onMessagePress,
}: {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
  onMessagePress?: (userId: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url, status, is_online, last_seen, created_at')
          .eq('id', userId)
          .single();
        if (error) throw error;
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.warn('ProfileCard load error:', err);
        if (!cancelled) setError('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, userId]);

  const name = profile?.full_name || profile?.username || 'Anonymous';
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(userId || '');
  const isOnline = !!profile?.is_online;

  const formatLastSeen = (ts: string | null) => {
    if (!ts) return 'Last seen unknown';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={14} color={TEXT_MUTED} />
          </Pressable>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={ACCENT_GOLD} />
              <Text style={styles.loadingText}>Loading profile…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={28} color="#E07070" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                <View style={styles.leftColumn}>
                  <View style={styles.avatarWrap}>
                    <View
                      style={[
                        styles.avatarRing,
                        {
                          backgroundColor: avatarColor + '22',
                          borderColor: avatarColor + '55',
                        },
                      ]}
                    >
                      <View
                        style={[styles.avatar, { backgroundColor: avatarColor }]}
                      >
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                    </View>
                    {isOnline && <View style={styles.onlineDot} />}
                  </View>

                  <Text style={styles.name} numberOfLines={2}>{name}</Text>
                  {profile?.username && (
                    <Text style={styles.username} numberOfLines={1}>
                      @{profile.username}
                    </Text>
                  )}

                  <View
                    style={[
                      styles.statusPill,
                      isOnline
                        ? styles.statusPillOnline
                        : styles.statusPillOffline,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isOnline
                            ? CHAT_ONLINE
                            : 'rgba(255,255,255,0.4)',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isOnline ? CHAT_ONLINE : TEXT_MUTED,
                        },
                      ]}
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </View>

                <View style={styles.verticalDivider} />

                <View style={styles.rightColumn}>
                  <View style={styles.infoRow}>
                    <Ionicons name="at-outline" size={12} color={TEXT_MUTED} />
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>Username</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {profile?.username || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="mail-outline" size={12} color={TEXT_MUTED} />
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {profile?.email || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={12}
                      color={TEXT_MUTED}
                    />
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>
                        {profile?.status ||
                          (isOnline
                            ? 'Active now'
                            : `Last seen ${formatLastSeen(profile?.last_seen || null)}`)}
                      </Text>
                    </View>
                  </View>

                  {profile?.created_at && (
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={12} color={TEXT_MUTED} />
                      <View style={styles.infoText}>
                        <Text style={styles.infoLabel}>Joined</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {new Date(profile.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {onMessagePress && (
                <View style={styles.footer}>
                  <Pressable
                    onPress={() => onMessagePress(profile!.id)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="chatbubble" size={12} color={CHAT_BG} />
                    <Text style={styles.primaryBtnText}>Message</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
  flex: 1,
  backgroundColor: 'transparent',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 16,
},
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: CHAT_BG,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  loadingText: { fontSize: 11, color: TEXT_MUTED },
  errorText: { fontSize: 11, color: '#E07070', fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center' },
  leftColumn: { width: 130, alignItems: 'center', paddingRight: 12 },
  rightColumn: { flex: 1, paddingLeft: 12, gap: 8 },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: CHAT_BORDER,
  },

  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    padding: 3,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CHAT_ONLINE,
    borderWidth: 2.5,
    borderColor: CHAT_BG,
  },

  name: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  username: { fontSize: 10, color: TEXT_MUTED, opacity: 0.75, marginTop: 1 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  statusPillOnline: { backgroundColor: 'rgba(111,175,138,0.12)' },
  statusPillOffline: { backgroundColor: 'rgba(255,255,255,0.05)' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoText: { flex: 1, minWidth: 0 },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: TEXT_MUTED,
    opacity: 0.75,
    textTransform: 'uppercase',
  },
  infoValue: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 1 },

  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAT_BORDER,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: ACCENT_GOLD,
  },
  primaryBtnText: { color: CHAT_BG, fontSize: 12, fontWeight: '700' },
});