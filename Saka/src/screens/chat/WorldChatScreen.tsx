// screens/WorldChatScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ChatMessage from '../../components/chat/ChatMessage';
import MessageInput from '../../components/chat/MessageInput';
import ProfileCard from '../../components/chat/ProfileCard';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_RADIUS_BTN,
} from '../../theme/designTokens';
import { Ionicons } from '@expo/vector-icons';

export default function WorldChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);

  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((state) => state.user);

  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const pendingMessagesRef = useRef(new Map<string, number[]>());

  const isNearBottomRef = useRef(true);
  const initialPositionPendingRef = useRef(false);
  const initialPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const paddingToBottom = 80;
    isNearBottomRef.current = contentOffset.y <= paddingToBottom;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (initialPositionPendingRef.current && messages.length > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      if (initialPositionTimerRef.current) clearTimeout(initialPositionTimerRef.current);
      initialPositionTimerRef.current = setTimeout(() => {
        initialPositionPendingRef.current = false;
      }, 750);
    }
  }, [messages.length]);

  const handleLayout = useCallback(() => {
    if (initialPositionPendingRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [messages.length]);

  const openProfile = useCallback(
    (uid: string) => {
      if (uid === user?.id) return;
      setProfileUserId(uid);
      setShowProfile(true);
    },
    [user?.id]
  );

  const closeProfile = () => {
    setShowProfile(false);
    setProfileUserId(null);
  };

  const handleProfileMessage = (uid: string) => {
    setShowProfile(false);
    setProfileUserId(null);
    router.push({
      pathname: '/chat/Conversation',
      params: { userId: uid },
    } as any);
  };

  const loadMessages = useCallback(async (refresh = false) => {
    try {
      setError(null);
      if (!refresh) setLoading(true);

      const { data, error: queryError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          user_id,
          content,
          type,
          media_url,
          created_at,
          updated_at,
          profiles:profiles!inner (
            full_name,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: true })
        .limit(200);

      if (queryError) throw queryError;

      initialPositionPendingRef.current = true;

      setMessages(data || []);
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 300);
    } catch (err) {
      console.error('WorldChat load error:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOnlineCount = useCallback(async () => {
    try {
      await supabase.rpc('cleanup_stale_users');

      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true);

      if (!error && count !== null) setOnlineCount(count);
    } catch (err) {
      console.warn('Failed to fetch online count:', err);
    }
  }, []);

  const handleNewMessage = useCallback(async (payload: any) => {
    if (!mountedRef.current) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        user_id,
        content,
        type,
        media_url,
        created_at,
        updated_at,
        profiles:profiles!inner (
          full_name,
          username,
          avatar_url
        )
      `)
      .eq('id', payload.new.id)
      .single();

    if (!error && data && mountedRef.current) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;

        const pendingKey = `${data.user_id}:${data.content}`;
        const pendingIds = pendingMessagesRef.current.get(pendingKey);
        const pendingId = pendingIds?.shift();
        if (pendingIds?.length === 0) pendingMessagesRef.current.delete(pendingKey);

        if (pendingId !== undefined) {
          return prev.map((message) => (message.id === pendingId ? data : message));
        }

        return [...prev, data];
      });

      if (isNearBottomRef.current) {
        setTimeout(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    }
  }, []);

  const handleSend = async (text: string) => {
    if (!user) return;

    const tempId = Date.now();
    const optimisticMessage = {
      id: tempId,
      user_id: user.id,
      content: text,
      type: 'text',
      media_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
        avatar_url: null,
      },
    };

    const pendingKey = `${user.id}:${text}`;
    const pendingIds = pendingMessagesRef.current.get(pendingKey) || [];
    pendingIds.push(tempId);
    pendingMessagesRef.current.set(pendingKey, pendingIds);
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 50);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, content: text });

      if (error) throw error;
    } catch (err) {
      console.warn('Send failed:', err);
      const pids = pendingMessagesRef.current.get(pendingKey) || [];
      const idx = pids.indexOf(tempId);
      if (idx !== -1) pids.splice(idx, 1);
      if (pids.length === 0) pendingMessagesRef.current.delete(pendingKey);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError('Failed to send message');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages(true);
    await fetchOnlineCount();
  }, [loadMessages, fetchOnlineCount]);

  useEffect(() => {
    mountedRef.current = true;

    loadMessages(true);
    fetchOnlineCount();

    const channelName = `chat-channel-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        handleNewMessage
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    subscriptionRef.current = channel;

    const interval = setInterval(fetchOnlineCount, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  if (loading && messages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </View>
    );
  }

  if (!loading && messages.length === 0 && !error) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="chatbubbles-outline" size={28} color={TEXT_MUTED} />
        </View>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Be the first to say hello 👋</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Compact section header — same recipe as Discoveries */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <Ionicons name="earth-outline" size={12} color={ACCENT_GOLD} />
          <Text style={styles.sectionTitle}>WORLD CHAT</Text>
        </View>
        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlineCount} online</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ChatMessage
            message={item}
            currentUserId={user?.id}
            onAvatarPress={openProfile}
          />
        )}
        style={styles.list}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT_GOLD}
            colors={[ACCENT_GOLD]}
          />
        }
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScrollToIndexFailed={() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      <View style={styles.inputWrapper}>
        <MessageInput onSend={handleSend} allowSend={!!user} />
      </View>

      <ProfileCard
        userId={profileUserId}
        visible={showProfile}
        onClose={closeProfile}
        onMessagePress={handleProfileMessage}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_BG },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CHAT_SUBTLE,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CHAT_ONLINE,
  },
  onlineText: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, color: TEXT_MUTED, marginTop: 4 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CHAT_SUBTLE,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  emptySubtext: { fontSize: 11, color: TEXT_MUTED, opacity: 0.7 },

  list: { flex: 1 },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },

  inputWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: CHAT_BG,
  },
  errorBanner: {
    backgroundColor: 'rgba(224,112,112,0.10)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.22)',
  },
  errorText: { color: '#E07070', fontSize: 11, textAlign: 'center' },
});