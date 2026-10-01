// screens/ConversationScreen.tsx
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
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_BORDER_STRONG,
  CHAT_ONLINE,
  CHAT_DANGER,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_MODAL,
  CHAT_RADIUS_BUBBLE,
  CHAT_FS_BODY,
  CHAT_FS_META,
  CHAT_OFFLINE,
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
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((state) => state.user);
  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const isNearBottomRef = useRef(true);
  const initialScrollIndexRef = useRef<number | null>(null);
  const initialPositionPendingRef = useRef(false);
  const initialPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 80;
    isNearBottomRef.current =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (initialPositionPendingRef.current && messages.length > 0) {
      const index = initialScrollIndexRef.current;
      if (index !== null && index < messages.length) {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.85,
        });
        initialScrollIndexRef.current = null;
      } else {
        listRef.current?.scrollToEnd({ animated: false });
      }
      if (initialPositionTimerRef.current) clearTimeout(initialPositionTimerRef.current);
      initialPositionTimerRef.current = setTimeout(() => {
        initialPositionPendingRef.current = false;
        initialScrollIndexRef.current = null;
      }, 750);
    }
  }, [messages.length]);

  const handleLayout = useCallback(() => {
    if (initialPositionPendingRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        const index = initialScrollIndexRef.current;
        if (index !== null && index < messages.length) {
          listRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0.85,
          });
          initialScrollIndexRef.current = null;
        } else {
          listRef.current?.scrollToEnd({ animated: false });
        }
      });
    }
  }, [messages.length]);

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

  const loadMessages = useCallback(
    async (refresh = false) => {
      if (!user || !userId) return;

      try {
        setError(null);
        if (!refresh) setLoading(true);

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

        const newMessages = data || [];
        const firstUnreadIndex = newMessages.findIndex(
          (message) => message.sender_id === userId && !message.is_read
        );
        initialScrollIndexRef.current = firstUnreadIndex >= 0 ? firstUnreadIndex : null;
        setFirstUnreadId(firstUnreadIndex >= 0 ? newMessages[firstUnreadIndex].id : null);

        await markAllAsRead();
        initialPositionPendingRef.current = true;
        setMessages(newMessages);

        setTimeout(() => {
          if (firstUnreadIndex >= 0) {
            listRef.current?.scrollToIndex({
              index: firstUnreadIndex,
              animated: false,
              viewPosition: 0.85,
            });
          } else {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }, 300);
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
    setTimeout(() => scrollToEnd(true), 100);

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

      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? data : msg)));
    } catch (err) {
      console.error('Send message error:', err);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const openDeleteSheet = (message: Message) => {
    setSelectedMessage(message);
    setShowDeleteSheet(true);
  };

  const closeDeleteSheet = () => {
    if (deleting) return;
    setShowDeleteSheet(false);
    setSelectedMessage(null);
  };

  const confirmDeleteMessage = async () => {
    if (!selectedMessage || !user) return;
    const msgId = selectedMessage.id;
    setDeleting(true);

    const backup = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setShowDeleteSheet(false);
    setSelectedMessage(null);

    try {
      const { error } = await supabase.from('private_messages').delete().eq('id', msgId);
      if (error) throw error;
    } catch (err) {
      console.error('Delete message error:', err);
      setMessages(backup);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleNewMessage = useCallback(
    async (payload: any) => {
      if (!mountedRef.current) return;
      const newMessage = payload.new;

      if (
        (newMessage.sender_id === user?.id && newMessage.recipient_id === userId) ||
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

          if (isNearBottomRef.current) setTimeout(() => scrollToEnd(true), 100);

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
    [user, userId, scrollToEnd]
  );

  const handleDeletedMessage = useCallback((payload: any) => {
    if (!mountedRef.current) return;
    const deletedId = payload.old?.id;
    if (deletedId === undefined) return;
    setMessages((prev) => prev.filter((m) => m.id !== deletedId));
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    loadUserProfile();
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
        { event: 'DELETE', schema: 'public', table: 'private_messages' },
        handleDeletedMessage
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
      if (initialPositionTimerRef.current) clearTimeout(initialPositionTimerRef.current);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, userId, loadUserProfile, loadMessages, handleNewMessage, handleDeletedMessage]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  const goBack = async () => {
    await markAllAsRead();
    router.back();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const bubbleWidth = Math.min(
      Math.max(48, item.content.length * 7.2 + 24),
      windowWidth * 0.75
    );
    const time = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const showDivider = firstUnreadId !== null && item.id === firstUnreadId;

    return (
      <>
        {showDivider && (
          <View style={styles.unreadDivider}>
            <View style={styles.unreadDividerLine} />
            <Text style={styles.unreadDividerText}>NEW</Text>
            <View style={styles.unreadDividerLine} />
          </View>
        )}
        <Pressable
          onLongPress={() => openDeleteSheet(item)}
          delayLongPress={350}
          style={[styles.messageRow, isMe ? styles.messageRight : styles.messageLeft]}
        >
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
              { maxWidth: bubbleWidth },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: isMe ? CHAT_BG : TEXT_PRIMARY },
                isMe && { fontWeight: '600' },
              ]}
            >
              {item.content}
            </Text>
          </View>
          <View style={styles.messageFooter} pointerEvents="none">
            <Text style={styles.messageTime}>{time}</Text>
            {isMe && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={11}
                color={item.is_read ? CHAT_ONLINE : 'rgba(255,255,255,0.35)'}
                style={styles.readReceipt}
              />
            )}
          </View>
        </Pressable>
      </>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
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
                      ? CHAT_ONLINE
                      : CHAT_OFFLINE,
                  },
                ]}
              />
              <Text style={styles.headerStatus}>
                {otherUser?.is_online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.backBtn} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={16} color={TEXT_PRIMARY} />
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index,
                animated: false,
                viewPosition: 0.85,
              });
            }, 100);
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          maintainVisibleContentPosition={
            Platform.OS === 'ios' ? { minIndexForVisible: 0 } : undefined
          }
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message…"
              placeholderTextColor="rgba(255,255,255,0.28)"
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
                <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.3)" />
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
                    : 'rgba(255,255,255,0.06)',
              },
            ]}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color={CHAT_BG} />
            ) : (
              <Ionicons
                name="send"
                size={14}
                color={inputText.trim() ? CHAT_BG : 'rgba(255,255,255,0.3)'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Delete Confirmation */}
      <Modal
        visible={showDeleteSheet}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeDeleteSheet}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Unsend this message?</Text>
            <View style={styles.sheetBtnRow}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnCancel]}
                onPress={closeDeleteSheet}
                disabled={deleting}
                activeOpacity={0.85}
              >
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnDelete]}
                onPress={confirmDeleteMessage}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sheetBtnDeleteText}>Unsend</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 11, color: TEXT_MUTED, marginTop: 6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
    backgroundColor: CHAT_BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 0,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  headerUserInfo: { marginLeft: 9, flex: 1, minWidth: 0 },
  headerName: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatus: { fontSize: 10, color: TEXT_MUTED, opacity: 0.85, flex: 1 },

  errorBanner: {
    backgroundColor: 'rgba(224,112,112,0.10)',
    padding: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.22)',
  },
  errorText: { color: CHAT_DANGER, fontSize: 11, textAlign: 'center' },

  keyboardContainer: { flex: 1 },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexGrow: 1,
  },
  messageRow: { alignSelf: 'stretch', marginVertical: 2 },
  messageLeft: { alignItems: 'flex-start' },
  messageRight: { alignItems: 'flex-end' },
  messageBubble: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: CHAT_RADIUS_BUBBLE,
    marginVertical: 1,
  },
  messageBubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  messageBubbleOther: {
    backgroundColor: CHAT_SUBTLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    alignSelf: 'flex-start',
  },
  messageText: { fontSize: CHAT_FS_BODY, lineHeight: 17, flexShrink: 1 },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  messageTime: {
    fontSize: CHAT_FS_META,
    color: TEXT_MUTED,
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  readReceipt: { marginLeft: 2 },

  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginVertical: 10,
  },
  unreadDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(201,169,110,0.30)',
  },
  unreadDividerText: {
    fontSize: 9,
    fontWeight: '800',
    color: ACCENT_GOLD,
    letterSpacing: 1.2,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: CHAT_BG,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingLeft: 4,
    paddingRight: 6,
    minHeight: 36,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: CHAT_FS_BODY,
    lineHeight: 16,
    maxHeight: 96,
    minHeight: 34,
  },
  clearButton: { padding: 4 },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: CHAT_RADIUS_BTN,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: CHAT_BG,
    borderRadius: CHAT_RADIUS_MODAL,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 14,
  },
  sheetBtnRow: { flexDirection: 'row', gap: 8 },
  sheetBtn: {
    flex: 1,
    height: 36,
    borderRadius: CHAT_RADIUS_BTN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetBtnCancelText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  sheetBtnDelete: { backgroundColor: CHAT_DANGER },
  sheetBtnDeleteText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});