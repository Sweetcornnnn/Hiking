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
  Modal,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
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
  is_edited: boolean;
  reply_to_id: number | null;
  reply_to_sender: string | null;
  reply_to_content: string | null;
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

const SELECT_COLS = `
  id,
  sender_id,
  recipient_id,
  content,
  type,
  media_url,
  is_read,
  read_at,
  created_at,
  updated_at,
  is_edited,
  reply_to_id,
  reply_to_sender,
  reply_to_content
`;

const isEdited = (message: Pick<Message, 'is_edited'>) => message.is_edited;

const isSameDay = (first: string, second: string) => {
  const firstDate = new Date(first);
  const secondDate = new Date(second);
  if (isNaN(firstDate.getTime()) || isNaN(secondDate.getTime())) return false;
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
};

const formatDateDivider = (timestamp: string) => {
  const messageDate = new Date(timestamp);
  if (isNaN(messageDate.getTime())) return '';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageStart = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );
  const dayDifference = Math.round(
    (todayStart.getTime() - messageStart.getTime()) / 86_400_000
  );

  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  return messageDate.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    ...(messageDate.getFullYear() !== now.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  });
};

const REPLY_THRESHOLD = 56;
const REPLY_MAX = 76;

// ── Swipe-to-reply wrapper ─────────────────────────────────
function SwipeableRow({
  onReply,
  disabled,
  children,
}: {
  onReply: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const springBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !disabled &&
        Math.abs(g.dx) > 12 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const dx = Math.max(0, Math.min(g.dx, REPLY_MAX));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx >= REPLY_THRESHOLD) onReply();
        springBack();
      },
      onPanResponderTerminate: () => springBack(),
    })
  ).current;

  const iconOpacity = translateX.interpolate({
    inputRange: [0, REPLY_THRESHOLD * 0.45, REPLY_THRESHOLD],
    outputRange: [0, 0.35, 1],
    extrapolate: 'clamp',
  });

  const iconScale = translateX.interpolate({
    inputRange: [0, REPLY_THRESHOLD],
    outputRange: [0.55, 1],
    extrapolate: 'clamp',
  });

  const iconBg = translateX.interpolate({
    inputRange: [0, REPLY_THRESHOLD],
    outputRange: ['rgba(201,169,110,0.10)', 'rgba(201,169,110,0.22)'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeIconWrap,
          { opacity: iconOpacity, backgroundColor: iconBg },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <Ionicons name="arrow-undo" size={16} color={ACCENT_GOLD} />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={{ width: '100%', transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

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
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const user = useAuthStore((state) => state.user);
  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const isNearBottomRef = useRef(true);
  const initialScrollIndexRef = useRef<number | null>(null);
  const initialPositionPendingRef = useRef(false);
  const initialPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'You';

  const otherDisplayName =
    otherUser?.full_name || otherUser?.username || 'User';

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
        listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.85 });
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
          listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.85 });
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
      const { error: rpcError } = await supabase
        .from('private_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (rpcError) {
        console.warn('[markAllAsRead] error:', rpcError.message, rpcError);
      }
    } catch (err) {
      console.warn('[markAllAsRead] threw:', err);
    }
  }, [user, userId]);

  const loadUserProfile = useCallback(async () => {
    if (!userId) {
      console.warn('[loadUserProfile] no userId param');
      return;
    }
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url, status, is_online, last_seen')
        .eq('id', userId)
        .single();
      if (profileError) {
        console.warn('[loadUserProfile] error:', profileError.message, profileError);
        return;
      }
      setOtherUser(data);
    } catch (err) {
      console.warn('[loadUserProfile] threw:', err);
    }
  }, [userId]);

  const loadMessages = useCallback(
    async (refresh = false) => {
      if (!user || !userId) {
        console.warn('[loadMessages] missing user or userId', { user: !!user, userId });
        setError('Missing user or conversation id');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setError(null);
        if (!refresh) setLoading(true);

        const { data, error: queryError } = await supabase
          .from('private_messages')
          .select(SELECT_COLS)
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),` +
              `and(sender_id.eq.${userId},recipient_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true })
          .limit(200);

        if (queryError) {
          console.error('[loadMessages] Supabase error:', {
            message: queryError.message,
            details: queryError.details,
            hint: queryError.hint,
            code: queryError.code,
          });
          throw queryError;
        }

        const newMessages: Message[] = data || [];
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
      } catch (err: any) {
        console.error('[loadMessages] caught:', err);
        setError(
          err?.message ? `Failed to load: ${err.message}` : 'Failed to load messages'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, userId, markAllAsRead]
  );

  // ─── SEND ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!user || !userId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const reply = replyingTo;
    const repliedToName = reply
      ? reply.sender_id === user.id
        ? myDisplayName
        : otherDisplayName
      : null;

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
      is_edited: false,
      reply_to_id: reply?.id ?? null,
      reply_to_sender: repliedToName,
      reply_to_content: reply?.content ?? null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);
    setTimeout(() => scrollToEnd(true), 100);

    try {
      const { data, error: insertError } = await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          content: text,
          type: 'text',
          reply_to_id: reply?.id ?? null,
          reply_to_sender: repliedToName,
          reply_to_content: reply?.content ?? null,
        })
        .select(SELECT_COLS)
        .single();

      if (insertError) {
        console.error('[sendMessage] error:', insertError);
        throw insertError;
      }

      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? data : msg)));
    } catch (err: any) {
      console.error('[sendMessage] caught:', err);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      Alert.alert('Error', err?.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ─── EDIT ──────────────────────────────────────────────────
  const openEditFromSheet = () => {
    if (!selectedMessage || selectedMessage.sender_id !== user?.id) return;
    const target = selectedMessage;
    setReplyingTo(null);
    setEditingMessage(target);
    setInputText(target.content);
    setShowDeleteSheet(false);
    setSelectedMessage(null);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const saveEdit = async () => {
    if (
      !editingMessage ||
      editingMessage.sender_id !== user?.id ||
      !inputText.trim() ||
      sending
    ) return;

    const newContent = inputText.trim();
    if (newContent === editingMessage.content) {
      cancelEdit();
      return;
    }

    const targetId = editingMessage.id;
    const backup = messages;
    const now = new Date().toISOString();

    setSending(true);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetId
          ? { ...m, content: newContent, updated_at: now, is_edited: true }
          : m
      )
    );

    try {
      const { data, error: updateError } = await supabase
        .from('private_messages')
        .update({ content: newContent, updated_at: now, is_edited: true })
        .eq('id', targetId)
        .eq('sender_id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('[saveEdit] error:', updateError);
        throw updateError;
      }
      if (!data) throw new Error('Message could not be updated (no row returned)');

      setEditingMessage(null);
      setInputText('');
    } catch (err: any) {
      console.error('[saveEdit] caught:', err);
      setMessages(backup);
      Alert.alert('Error', err?.message || 'Failed to edit message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ─── REPLY ─────────────────────────────────────────────────
  const startReply = useCallback((msg: Message) => {
    if (editingMessage) {
      setEditingMessage(null);
      setInputText('');
    }
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [editingMessage]);

  const cancelReply = () => setReplyingTo(null);

  const handleSendOrSave = () => {
    if (editingMessage) return saveEdit();
    return sendMessage();
  };

  // ─── DELETE ────────────────────────────────────────────────
  const openDeleteSheet = useCallback((message: Message) => {
    if (message.sender_id !== user?.id) return;
    setSelectedMessage(message);
    setShowDeleteSheet(true);
  }, [user?.id]);

  const closeDeleteSheet = () => {
    if (deleting) return;
    setShowDeleteSheet(false);
    setSelectedMessage(null);
  };

  const confirmDeleteMessage = async () => {
    if (!selectedMessage || !user || selectedMessage.sender_id !== user.id) return;
    const msgId = selectedMessage.id;
    setDeleting(true);

    const backup = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setShowDeleteSheet(false);
    setSelectedMessage(null);

    try {
      const { data, error: deleteError } = await supabase
        .from('private_messages')
        .delete()
        .eq('id', msgId)
        .eq('sender_id', user.id)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        console.error('[confirmDeleteMessage] error:', deleteError);
        throw deleteError;
      }
      if (!data) throw new Error('Message could not be deleted (no row returned)');
    } catch (err: any) {
      console.error('[confirmDeleteMessage] caught:', err);
      setMessages(backup);
      Alert.alert('Error', err?.message || 'Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── REALTIME ──────────────────────────────────────────────
  const handleNewMessage = useCallback(
    async (payload: any) => {
      if (!mountedRef.current) return;
      const newMessage = payload.new;

      if (
        (newMessage.sender_id === user?.id && newMessage.recipient_id === userId) ||
        (newMessage.sender_id === userId && newMessage.recipient_id === user?.id)
      ) {
        const { data, error: fetchError } = await supabase
          .from('private_messages')
          .select(SELECT_COLS)
          .eq('id', newMessage.id)
          .single();

        if (fetchError) {
          console.warn('[handleNewMessage] fetch error:', fetchError.message);
          return;
        }

        if (data && mountedRef.current) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });

          if (isNearBottomRef.current) setTimeout(() => scrollToEnd(true), 100);

          if (data.recipient_id === user?.id && !data.is_read) {
            const { error: readError } = await supabase
              .from('private_messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', data.id);

            if (readError) {
              console.warn('[handleNewMessage] mark-read error:', readError.message);
            } else {
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
      }
    },
    [user, userId, scrollToEnd]
  );

  const handleUpdatedMessage = useCallback((payload: any) => {
    if (!mountedRef.current) return;
    const updated = payload.new;
    if (!updated?.id) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === updated.id
          ? {
              ...msg,
              content: updated.content ?? msg.content,
              is_read: updated.is_read ?? msg.is_read,
              read_at: updated.read_at ?? msg.read_at,
              updated_at: updated.updated_at ?? msg.updated_at,
              is_edited: updated.is_edited ?? msg.is_edited,
              reply_to_id: updated.reply_to_id ?? msg.reply_to_id,
              reply_to_sender: updated.reply_to_sender ?? msg.reply_to_sender,
              reply_to_content: updated.reply_to_content ?? msg.reply_to_content,
            }
          : msg
      )
    );
  }, []);

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
        handleUpdatedMessage
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
      .subscribe();

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
  }, [user, userId, loadUserProfile, loadMessages, handleNewMessage, handleDeletedMessage, handleUpdatedMessage]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  const goBack = async () => {
    await markAllAsRead();
    router.back();
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const time = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const showDivider = firstUnreadId !== null && item.id === firstUnreadId;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateDivider =
      !previousMessage || !isSameDay(previousMessage.created_at, item.created_at);
    const dateLabel = showDateDivider ? formatDateDivider(item.created_at) : '';
    const edited = isEdited(item);
    const hasReply = !!item.reply_to_id;

    const replyCaption = isMe
      ? `You replied to ${otherDisplayName}`
      : `${otherDisplayName} replied to you`;
    const repliedMessage = hasReply
      ? messages.find((message) => message.id === item.reply_to_id)
      : null;
    const replyPreview =
      repliedMessage?.content ?? item.reply_to_content ?? 'Original message unavailable';
    return (
      <>
        {dateLabel ? (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{dateLabel}</Text>
            </View>
            <View style={styles.dateDividerLine} />
          </View>
        ) : null}

        {showDivider && (
          <View style={styles.unreadDivider}>
            <View style={styles.unreadDividerLine} />
            <Text style={styles.unreadDividerText}>NEW</Text>
            <View style={styles.unreadDividerLine} />
          </View>
        )}

        <SwipeableRow onReply={() => startReply(item)} disabled={sending}>
          <Pressable
            onLongPress={isMe ? () => openDeleteSheet(item) : undefined}
            delayLongPress={350}
            style={[styles.messageRow, isMe ? styles.messageRight : styles.messageLeft]}
          >
            <MessageBubble
              content={item.content}
              time={time}
              isMe={isMe}
              isRead={item.is_read}
              edited={edited}
              hasReply={hasReply}
              replyCaption={replyCaption}
              replyPreview={replyPreview}
              avatarUri={otherUser?.avatar_url}
              avatarLabel={otherDisplayName}
              avatarColorSeed={userId || ''}
            />
          </Pressable>
        </SwipeableRow>
      </>
    );
  }, [firstUnreadId, messages, openDeleteSheet, otherDisplayName, otherUser?.avatar_url, sending, startReply, user?.id, userId]);

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </SafeAreaView>
    );
  }

  const canSave = inputText.trim().length > 0 && !sending;
  const replyingSenderLabel = replyingTo
    ? replyingTo.sender_id === user?.id
      ? 'You'
      : otherDisplayName
    : '';

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
                  { backgroundColor: otherUser?.is_online ? CHAT_ONLINE : CHAT_OFFLINE },
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

        {/* Reply bar */}
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarAccent} />
            <View style={styles.replyBarText}>
              <Text style={styles.replyBarLabel}>
                REPLYING TO {replyingSenderLabel.toUpperCase()}
              </Text>
              <Text style={styles.replyBarPreview} numberOfLines={1}>
                {replyingTo.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={cancelReply}
              hitSlop={8}
              style={styles.replyBarClose}
            >
              <Ionicons name="close" size={15} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit bar */}
        {editingMessage && (
          <View style={styles.editingBar}>
            <Ionicons name="create-outline" size={13} color={ACCENT_GOLD} />
            <View style={styles.editingBarText}>
              <Text style={styles.editingBarLabel}>EDITING MESSAGE</Text>
              <Text style={styles.editingBarPreview} numberOfLines={1}>
                {editingMessage.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={cancelEdit}
              hitSlop={8}
              style={styles.editingBarClose}
            >
              <Ionicons name="close" size={15} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                editingMessage
                  ? 'Edit message…'
                  : replyingTo
                  ? 'Reply…'
                  : 'Type a message…'
              }
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
            onPress={handleSendOrSave}
            style={[
              styles.sendButton,
              { backgroundColor: canSave ? ACCENT_GOLD : 'rgba(255,255,255,0.06)' },
            ]}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color={CHAT_BG} />
            ) : (
              <Ionicons
                name={editingMessage ? 'checkmark' : 'send'}
                size={14}
                color={canSave ? CHAT_BG : 'rgba(255,255,255,0.3)'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Message options sheet */}
      <Modal
        visible={showDeleteSheet}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeDeleteSheet}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Message options</Text>

            <View style={styles.sheetBtnRow}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnEdit]}
                onPress={openEditFromSheet}
                disabled={deleting}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={14} color={TEXT_PRIMARY} />
                <Text style={styles.sheetBtnEditText}>Edit</Text>
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
                  <>
                    <Ionicons name="trash-outline" size={14} color="#fff" />
                    <Text style={styles.sheetBtnDeleteText}>Unsend</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={closeDeleteSheet}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
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

  // ── Swipe wrapper ──
  swipeContainer: {
    width: '100%',
    marginVertical: 2,
    justifyContent: 'center',
  },
  swipeIconWrap: {
    position: 'absolute',
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    top: '50%',
    marginTop: -15,
  },

  messageRow: { alignSelf: 'stretch' },
  messageLeft: { alignItems: 'flex-start' },
  messageRight: { alignItems: 'flex-end' },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  messageContentRowMe: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  messageContentRowOther: {
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -20 }],
  },
  messageAvatarImage: {
    width: '100%',
    height: '100%',
  },
  messageAvatarText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  messageStack: { flexShrink: 1 },
  messageStackMe: { alignItems: 'flex-end' },
  messageStackOther: { alignItems: 'flex-start' },

  replyPreview: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginTop: 4,
    marginBottom: -8,
    borderRadius: 6,
  },
  replyPreviewMe: { backgroundColor: 'rgba(217,221,227,0.84)' },
  replyPreviewOther: { backgroundColor: 'rgba(217,221,227,0.84)' },
  replyPreviewAccent: { width: 2, borderRadius: 1, backgroundColor: ACCENT_GOLD },
  replyPreviewText: { flex: 1, minWidth: 0 },
  replyCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 2,
    opacity: 0.55,
    transform: [{ translateY: 3 }],
  },
  replyCaption: {
    fontSize: 9,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  replyPreviewContent: { fontSize: 11, marginTop: 2, flexShrink: 1 },
  replyPreviewContentMe: { color: '#252A31' },
  replyPreviewContentOther: { color: '#252A31' },

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
  messageText: { fontSize: CHAT_FS_BODY, lineHeight: 17 },
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
  messageEdited: {
    fontSize: CHAT_FS_META,
    color: TEXT_MUTED,
    opacity: 0.6,
  },
  readReceiptSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: CHAT_BORDER,
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: CHAT_BORDER,
  },
  datePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

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

  // ── Reply bar (above input) ──
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: 'rgba(201,169,110,0.06)',
  },
  replyBarAccent: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
    backgroundColor: ACCENT_GOLD,
  },
  replyBarText: { flex: 1, minWidth: 0 },
  replyBarLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: ACCENT_GOLD,
  },
  replyBarPreview: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  replyBarClose: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // ── Edit bar (above input) ──
  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: 'rgba(201,169,110,0.06)',
  },
  editingBarText: { flex: 1, minWidth: 0 },
  editingBarLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: ACCENT_GOLD,
  },
  editingBarPreview: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  editingBarClose: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    maxWidth: 320,
    backgroundColor: CHAT_BG,
    borderRadius: CHAT_RADIUS_MODAL,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    height: 38,
    borderRadius: CHAT_RADIUS_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sheetBtnEdit: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sheetBtnEditText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  sheetBtnDelete: { backgroundColor: CHAT_DANGER },
  sheetBtnDeleteText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sheetCancelBtn: {
    marginTop: 8,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CHAT_RADIUS_BTN,
  },
  sheetCancelText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
});