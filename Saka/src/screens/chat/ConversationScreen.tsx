// screens/chat/ConversationScreen.tsx - WITH REALTIME STATUS
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  BG_PANEL,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  type: 'text' | 'image' | 'file';
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string | null;
  is_online: boolean | null;
  last_seen?: string | null;
};

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<Profile | null>(null);

  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((state) => state.user);
  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // ============================================
  // MARK ALL AS READ
  // ============================================

  const markAllAsRead = useCallback(async () => {
    if (!user || !userId) return;
    try {
      await supabase
        .from('private_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.warn('Mark as read failed:', err);
    }
  }, [user, userId]);

  // ============================================
  // LOAD USER PROFILE
  // ============================================

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url, status, is_online, last_seen')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setOtherUser(data);
    } catch (err) {
      console.error('Load user profile error:', err);
    }
  }, [userId]);

  // ============================================
  // LOAD MESSAGES
  // ============================================

  const loadMessages = useCallback(
    async (refresh = false) => {
      if (!user || !userId) return;

      try {
        setError(null);
        if (!refresh) setLoading(true);

        await markAllAsRead();

        const { data, error: queryError } = await supabase
          .from('private_messages')
          .select(`
            id,
            sender_id,
            recipient_id,
            content,
            type,
            media_url,
            is_read,
            read_at,
            created_at,
            updated_at
          `)
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),` +
              `and(sender_id.eq.${userId},recipient_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true })
          .limit(200);

        if (queryError) throw queryError;
        setMessages(data || []);
      } catch (err) {
        console.error('Load messages error:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, userId, markAllAsRead]
  );

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = async () => {
    if (!user || !userId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = Date.now();
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: user.id,
      recipient_id: userId,
      content: text,
      type: 'text',
      media_url: null,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          content: text,
          type: 'text',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? data : msg))
      );
    } catch (err) {
      console.error('Send message error:', err);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ============================================
  // HANDLE NEW MESSAGE (REALTIME)
  // ============================================

  const handleNewMessage = useCallback(
    async (payload: any) => {
      if (!mountedRef.current) return;

      const newMessage = payload.new;

      if (
        (newMessage.sender_id === user?.id &&
          newMessage.recipient_id === userId) ||
        (newMessage.sender_id === userId && newMessage.recipient_id === user?.id)
      ) {
        const { data, error } = await supabase
          .from('private_messages')
          .select(`
            id,
            sender_id,
            recipient_id,
            content,
            type,
            media_url,
            is_read,
            read_at,
            created_at,
            updated_at
          `)
          .eq('id', newMessage.id)
          .single();

        if (!error && data && mountedRef.current) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

          if (data.recipient_id === user?.id && !data.is_read) {
            await supabase
              .from('private_messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', data.id);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === data.id
                  ? { ...msg, is_read: true, read_at: new Date().toISOString() }
                  : msg
              )
            );
          }
        }
      }
    },
    [user, userId]
  );

  // ============================================
  // EFFECT: INITIAL LOAD + REALTIME
  // ============================================

  useEffect(() => {
    mountedRef.current = true;

    loadUserProfile();
    loadMessages(true);

    const statusInterval = setInterval(loadUserProfile, 15000);
    const channelName = `private-messages-${user?.id}-${userId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages' },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'private_messages' },
        (payload) => {
          if (payload.new.is_read && mountedRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id
                  ? { ...msg, is_read: true, read_at: payload.new.read_at }
                  : msg
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (mountedRef.current) {
            console.log('🟢 Profile updated:', payload.new.is_online);
            setOtherUser((prev) =>
              prev
                ? {
                    ...prev,
                    is_online: payload.new.is_online,
                    status: payload.new.status,
                    last_seen: payload.new.last_seen,
                  }
                : prev
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('Private chat subscription status:', status);
      });

    subscriptionRef.current = channel;

    return () => {
      mountedRef.current = false;
      clearInterval(statusInterval);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, userId, loadUserProfile, loadMessages, handleNewMessage]);

  // ============================================
  // MARK AS READ WHEN FOCUSED
  // ============================================

  useFocusEffect(
    useCallback(() => {
      markAllAsRead();
    }, [markAllAsRead])
  );

  // ============================================
  // GO BACK
  // ============================================

  const goBack = async () => {
    await markAllAsRead();
    router.back();
  };

  // ============================================
  // RENDER MESSAGE
  // ============================================

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const time = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRight : styles.messageLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isMe ? '#fff' : TEXT_PRIMARY },
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                { color: isMe ? 'rgba(255,255,255,0.72)' : TEXT_MUTED },
              ]}
            >
              {time}
            </Text>
            {isMe && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.is_read ? '#4CAF50' : 'rgba(255,255,255,0.4)'}
                style={styles.readReceipt}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // ============================================
  // LOADING
  // ============================================

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: getAvatarColor(userId || '') },
            ]}
          >
            <Text style={styles.headerAvatarText}>
              {getInitials(otherUser?.full_name || otherUser?.username || '?')}
            </Text>
          </View>
          <View style={styles.headerUserInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherUser?.full_name || otherUser?.username || 'Unknown User'}
            </Text>
            <View style={styles.headerStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: otherUser?.is_online
                      ? '#4ADE80'
                      : 'rgba(255,255,255,0.35)',
                  },
                ]}
              />
              <Text style={styles.headerStatus}>
                {otherUser?.is_online ? 'Onlinee' : 'Offlinee'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMessages(true);
                loadUserProfile();
              }}
              tintColor={ACCENT_GOLD}
              colors={[ACCENT_GOLD]}
            />
          }
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: false });
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={[styles.input, { color: TEXT_PRIMARY }]}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            {inputText.length > 0 && (
              <TouchableOpacity
                onPress={() => setInputText('')}
                style={styles.clearButton}
                hitSlop={6}
              >
                <Ionicons
                  name="close-circle"
                  size={17}
                  color="rgba(255,255,255,0.35)"
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={sendMessage}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim() && !sending
                    ? ACCENT_GOLD
                    : 'rgba(255,255,255,0.07)',
              },
            ]}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? '#fff' : 'rgba(255,255,255,0.3)'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13.5, color: TEXT_MUTED, marginTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: BG_PANEL,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minWidth: 0,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerUserInfo: { marginLeft: 10, flex: 1, minWidth: 0 },
  headerName: { fontSize: 15.5, fontWeight: '700', color: TEXT_PRIMARY },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatus: { fontSize: 11.5, color: TEXT_MUTED, opacity: 0.8 },

  errorBanner: {
    backgroundColor: 'rgba(239,107,107,0.10)',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,107,107,0.25)',
  },
  errorText: { color: '#EF6B6B', fontSize: 12.5, textAlign: 'center' },

  keyboardContainer: { flex: 1 },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  messageRow: { marginVertical: 2 },
  messageLeft: { alignItems: 'flex-start' },
  messageRight: { alignItems: 'flex-end' },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    marginVertical: 1,
  },
  messageBubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  messageText: { fontSize: 14.5, lineHeight: 20 },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 4,
  },
  messageTime: { fontSize: 10, opacity: 0.7 },
  readReceipt: { marginLeft: 2 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: BG_PANEL,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 4,
    paddingRight: 6,
    minHeight: 40,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14.5,
    lineHeight: 19,
    maxHeight: 100,
    minHeight: 38,
  },
  clearButton: { padding: 4 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});