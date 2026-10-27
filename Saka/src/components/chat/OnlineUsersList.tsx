// components/chat/OnlineUsersList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_PANEL,
  CHAT_BORDER,
  CHAT_ONLINE,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

type OnlineUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: string | null;
  is_online: boolean | null;
};

function OnlineUserAvatar({
  user,
  name,
}: {
  user: OnlineUser;
  name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = user.avatar_url?.trim();

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: getAvatarColor(user.id) },
      ]}
    >
      {avatarUrl && !imageFailed ? (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatarImage}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

export default function OnlineUsersList() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, status, is_online')
        .eq('is_online', true)
        .order('full_name', { ascending: true })
        .limit(50);
      if (error) throw error;
      setUsers((data || []) as OnlineUser[]);
    } catch {
      // keep last known list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    const channel = supabase
      .channel(`online-users-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => load()
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const online = users.filter((u) => u.id !== currentUser?.id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Text style={styles.headerText}>Online ({online.length})</Text>
      </View>

      {loading && online.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={ACCENT_GOLD} />
        </View>
      ) : online.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="people-outline"
            size={22}
            color={TEXT_MUTED}
            style={{ opacity: 0.4 }}
          />
          <Text style={styles.emptyText}>No one online</Text>
        </View>
      ) : (
        <FlatList
          data={online}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const name = item.full_name || item.username || 'Anonymous';
            const status = item.status || 'Online';
            return (
              <View style={styles.row}>
                <View style={styles.avatarWrap}>
                  <OnlineUserAvatar user={item} name={name} />
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.status} numberOfLines={1}>
                    {status}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 168,
    height: '100%',
    backgroundColor: CHAT_PANEL,
    borderLeftWidth: 1,
    borderLeftColor: CHAT_BORDER,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CHAT_BORDER,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CHAT_ONLINE },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  emptyText: { fontSize: 10.5, color: TEXT_MUTED, opacity: 0.7 },

  listContent: { paddingVertical: 6, paddingHorizontal: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 9,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: CHAT_ONLINE,
    borderWidth: 2,
    borderColor: CHAT_PANEL,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 11, fontWeight: '700', color: TEXT_PRIMARY },
  status: { fontSize: 9.5, color: TEXT_MUTED, opacity: 0.75, marginTop: 1 },
});