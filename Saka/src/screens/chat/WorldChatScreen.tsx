// screens/WorldChatScreen.tsx - WITH UNIQUE CHANNEL + SCROLL-TO-LATEST FIX
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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ChatMessage from '../../components/chat/ChatMessage';
import MessageInput from '../../components/chat/MessageInput';
import {
  BG_PANEL,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../../theme/designTokens';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

export default function WorldChatScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((state) => state.user);

  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const pendingMessagesRef = useRef(new Map<string, number[]>());

  // ✅ Scroll tracking
  const isNearBottomRef = useRef(true);
  const initialPositionPendingRef = useRef(false);
  const initialPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================
  // SCROLL HELPERS
  // ============================================

  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const paddingToBottom = 80;
    isNearBottomRef.current = contentOffset.y <= paddingToBottom;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (initialPositionPendingRef.current && messages.length > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      if (initialPositionTimerRef.current) {
        clearTimeout(initialPositionTimerRef.current);
      }
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

  // ============================================
  // LOAD MESSAGES
  // ============================================

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

      // Recalculate the initial position whenever the screen is opened or refreshed.
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

      if (!error && count !== null) {
        setOnlineCount(count);
      }
    } catch (err) {
      console.warn('Failed to fetch online count:', err);
    }
  }, []);

  // ============================================
  // HANDLE NEW MESSAGE (REALTIME)
  // ============================================

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
        if (pendingIds?.length === 0) {
          pendingMessagesRef.current.delete(pendingKey);
        }

        if (pendingId !== undefined) {
          return prev.map((message) =>
            message.id === pendingId ? data : message
          );
        }

        return [...prev, data];
      });

      // ✅ Only auto-scroll if user is already near the bottom
      if (isNearBottomRef.current) {
        setTimeout(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    }
  }, []);

  // ============================================
  // SEND MESSAGE
  // ============================================

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
        .insert({
          user_id: user.id,
          content: text,
        });

      if (error) throw error;
    } catch (err) {
      console.warn('Send failed:', err);
      const pendingIds = pendingMessagesRef.current.get(pendingKey) || [];
      const pendingIndex = pendingIds.indexOf(tempId);
      if (pendingIndex !== -1) pendingIds.splice(pendingIndex, 1);
      if (pendingIds.length === 0) {
        pendingMessagesRef.current.delete(pendingKey);
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError('Failed to send message');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages(true);
    await fetchOnlineCount();
  }, [loadMessages, fetchOnlineCount]);

  // ============================================
  // EFFECT: INITIAL LOAD + REALTIME
  // ============================================

  useEffect(() => {
    mountedRef.current = true;

    loadMessages(true);
    fetchOnlineCount();

    const channelName = `chat-channel-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
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

  // ============================================
  // LOADING / EMPTY
  // ============================================

  if (loading && messages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </View>
    );
  }

  if (!loading && messages.length === 0 && !error) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="chatbubbles-outline" size={42} color={TEXT_MUTED} />
        </View>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Be the first to say hello 👋</Text>
      </View>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>World Chat</Text>
        <View style={styles.onlineStatus}>
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
          <ChatMessage message={item} currentUserId={user?.id} />
        )}
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
        // ✅ Scroll to newest ONCE after the list has measured content
        onContentSizeChange={handleContentSizeChange}
        // ✅ Safety net in case content size change hasn't fired yet
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
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.1,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(74,222,128,0.10)',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ADE80',
  },
  onlineText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13.5, color: TEXT_MUTED },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: TEXT_MUTED },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexGrow: 1,
  },
  inputWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: BG_PANEL,
  },
  errorBanner: {
    backgroundColor: 'rgba(239,107,107,0.10)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,107,107,0.25)',
  },
  errorText: { color: '#EF6B6B', fontSize: 12, textAlign: 'center' },
});