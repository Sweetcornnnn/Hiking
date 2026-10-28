// screens/ConversationScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Pressable,
  Animated,
  PanResponder,
  Clipboard,
  Image, // <-- Imported Image
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import type { ReactionType } from '../../utils/reactionTypes';
import MessageActionSheet from '../../components/chat/MessageActionSheet';
import ReactionsList from '../../components/chat/ReactionsList';
import ProfileCard from '../../components/chat/ProfileCard'; 
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_PANEL,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_DANGER,
  CHAT_RADIUS_BTN,
  CHAT_FS_BODY,
  CHAT_OFFLINE,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import { ReactionRow, summarizeReactions } from '../../utils/reactions';
import {
  getQueuedTextMessages,
  queueTextMessage,
  subscribeToQueuedMessages,
} from '../../services/offlineMessageQueue';

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
  reaction: ReactionType | null;
  sync_status?: 'pending' | 'failed';
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
  reply_to_content,
  reaction
`;

const REACTIONS_SELECT = `
  id,
  message_id,
  user_id,
  reaction,
  created_at,
  profiles:profiles (
    full_name,
    username,
    avatar_url
  )
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

export default function ConversationScreen({
  embedded = false,
  overrideUserId,
  onClose,
}: {
  embedded?: boolean;
  overrideUserId?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = overrideUserId || (params.userId as string);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const [showProfile, setShowProfile] = useState(false);

  const [reactionsByMessage, setReactionsByMessage] = useState<
    Record<number, ReactionRow[]>
  >({});
  const [reactionsTarget, setReactionsTarget] = useState<number | null>(null);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const user = useAuthStore((state) => state.user);
  const subscriptionRef = useRef<any>(null);
  const reactionsChannelRef = useRef<any>(null);
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
      await supabase
        .from('private_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.warn('[markAllAsRead] threw:', err);
    }
  }, [user, userId]);

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url, status, is_online, last_seen')
        .eq('id', userId)
        .single();
      if (profileError) {
        console.warn('[loadUserProfile] error:', profileError.message);
        return;
      }
      setOtherUser(data);
    } catch (err) {
      console.warn('[loadUserProfile] threw:', err);
    }
  }, [userId]);

  const loadReactionsForMessages = useCallback(async (messageIds: number[]) => {
    if (messageIds.length === 0) {
      setReactionsByMessage({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('private_message_reactions')
        .select(REACTIONS_SELECT)
        .in('message_id', messageIds);
      if (error) throw error;

      const grouped: Record<number, ReactionRow[]> = {};
      for (const row of (data || []) as any[]) {
        const list = grouped[row.message_id] || [];
        list.push({
          ...row,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
        });
        grouped[row.message_id] = list;
      }
      if (mountedRef.current) setReactionsByMessage(grouped);
    } catch (err) {
      console.warn('[reactions] load failed:', err);
    }
  }, []);

  const loadReactionsForOne = useCallback(async (messageId: number) => {
    try {
      const { data, error } = await supabase
        .from('private_message_reactions')
        .select(REACTIONS_SELECT)
        .eq('message_id', messageId);
      if (error) throw error;
      const rows: ReactionRow[] = (data || []).map((row: any) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      }));
      if (mountedRef.current) {
        setReactionsByMessage((prev) => ({ ...prev, [messageId]: rows }));
      }
    } catch (err) {
      console.warn('[reactions] single load failed:', err);
    }
  }, []);

  const loadMessages = useCallback(
    async (refresh = false) => {
      if (!user || !userId) {
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

        if (queryError) throw queryError;

        const newMessages: Message[] = data || [];
        const queued = await getQueuedTextMessages('private', user.id, userId);
        const mergedMessages = [
          ...newMessages,
          ...queued.map((entry) => ({
            id: entry.id,
            sender_id: user.id,
            recipient_id: userId,
            content: String(entry.payload.content ?? ''),
            type: 'text' as const,
            media_url: null,
            is_read: false,
            read_at: null,
            created_at: entry.createdAt,
            updated_at: entry.createdAt,
            is_edited: false,
            reply_to_id: null,
            reply_to_sender: null,
            reply_to_content: null,
            reaction: null,
            sync_status: entry.status,
          })),
        ].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const firstUnreadIndex = newMessages.findIndex(
          (message) => message.sender_id === userId && !message.is_read
        );

        initialScrollIndexRef.current = firstUnreadIndex >= 0 ? firstUnreadIndex : null;
        setFirstUnreadId(firstUnreadIndex >= 0 ? newMessages[firstUnreadIndex].id : null);

        await markAllAsRead();
        initialPositionPendingRef.current = true;
        setMessages(mergedMessages);

        const ids = newMessages.map((m) => m.id);
        await loadReactionsForMessages(ids);

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
        const queued = await getQueuedTextMessages('private', user.id, userId);
        if (queued.length > 0) {
          setMessages(queued.map((entry) => ({
            id: entry.id,
            sender_id: user.id,
            recipient_id: userId,
            content: String(entry.payload.content ?? ''),
            type: 'text',
            media_url: null,
            is_read: false,
            read_at: null,
            created_at: entry.createdAt,
            updated_at: entry.createdAt,
            is_edited: false,
            reply_to_id: null,
            reply_to_sender: null,
            reply_to_content: null,
            reaction: null,
            sync_status: entry.status,
          })));
          setError(null);
        } else {
          setError(err?.message ? `Failed to load: ${err.message}` : 'Failed to load messages');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, userId, markAllAsRead, loadReactionsForMessages]
  );

  useEffect(() => subscribeToQueuedMessages(() => {
    if (mountedRef.current) void loadMessages(true);
  }), [loadMessages]);

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
      reaction: null,
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

      if (insertError) throw insertError;

      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? data : msg)));
    } catch (err: any) {
      console.error('[sendMessage] caught:', err);
      try {
        await queueTextMessage('private', user.id, {
          sender_id: user.id,
          recipient_id: userId,
          content: text,
          type: 'text',
          reply_to_id: reply?.id ?? null,
          reply_to_sender: repliedToName,
          reply_to_content: reply?.content ?? null,
        }, tempId);
        setMessages((prev) => prev.map((msg) => (
          msg.id === tempId ? { ...msg, sync_status: 'pending' } : msg
        )));
      } catch (queueError) {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        Alert.alert(
          'Message not saved',
          queueError instanceof Error ? queueError.message : 'Unable to save message on this device.',
        );
      }
    } finally {
      setSending(false);
    }
  };

  // ─── EDIT ──────────────────────────────────────────────────
  const openEditFromSheet = () => {
    if (!actionTarget || actionTarget.sender_id !== user?.id) return;
    const target = actionTarget;
    setReplyingTo(null);
    setEditingMessage(target);
    setInputText(target.content);
    setActionTarget(null);
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
      const { error: updateError } = await supabase
        .from('private_messages')
        .update({ content: newContent, updated_at: now, is_edited: true })
        .eq('id', targetId)
        .eq('sender_id', user.id);

      if (updateError) throw updateError;

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
  const startReply = useCallback(
    (msg: Message) => {
      if (editingMessage) {
        setEditingMessage(null);
        setInputText('');
      }
      setReplyingTo(msg);
      setTimeout(() => inputRef.current?.focus(), 120);
    },
    [editingMessage]
  );

  const cancelReply = () => setReplyingTo(null);

  const handleSendOrSave = () => {
    if (editingMessage) return saveEdit();
    return sendMessage();
  };

  // ─── REACT ────────────────────────────────────────────────
  const applyReaction = async (reaction: ReactionType) => {
    if (!actionTarget || !user) return;
    const messageId = actionTarget.id;
    setActionTarget(null);

    if (typeof messageId !== 'number' || messageId >= 1_000_000_000_000) return;

    const current = reactionsByMessage[messageId] || [];
    const existing = current.find((r) => r.user_id === user.id);
    const next = existing?.reaction === reaction ? null : reaction;

    const backup = reactionsByMessage;
    setReactionsByMessage((prev) => {
      const list = (prev[messageId] || []).filter((r) => r.user_id !== user.id);
      if (next) {
        list.push({
          id: `temp-${Date.now()}`,
          message_id: messageId,
          user_id: user.id,
          reaction: next,
          created_at: new Date().toISOString(),
          profiles: {
            full_name: user.user_metadata?.full_name || null,
            username: user.user_metadata?.username || null,
            avatar_url: null,
          },
        });
      }
      return { ...prev, [messageId]: list };
    });

    try {
      if (next === null) {
        const { error } = await supabase
          .from('private_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('private_message_reactions')
          .upsert(
            { message_id: messageId, user_id: user.id, reaction: next },
            { onConflict: 'message_id,user_id' }
          );
        if (error) throw error;
      }
    } catch (err: any) {
      console.warn('[reaction] failed:', err);
      setReactionsByMessage(backup);
      Alert.alert('Error', err?.message || 'Failed to react. Please try again.');
    }
  };

  // ─── ACTION SHEET ─────────────────────────────────────────
  const openActionSheet = useCallback((message: Message) => {
    if (typeof message.id !== 'number' || message.id >= 1_000_000_000_000) return;
    setActionTarget(message);
  }, []);

  const closeActionSheet = () => {
    setActionTarget(null);
  };

  const confirmDeleteFromSheet = () => {
    if (!actionTarget || actionTarget.sender_id !== user?.id) return;

    Alert.alert(
      'Unsend this message?',
      'This will remove it for everyone in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: async () => {
            const msgId = actionTarget.id;
            const backup = messages;
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
            setActionTarget(null);

            try {
              const { error: deleteError } = await supabase
                .from('private_messages')
                .delete()
                .eq('id', msgId)
                .eq('sender_id', user!.id);

              if (deleteError) throw deleteError;
              setNotice({ title: 'Message unsent', message: 'The message was removed for everyone.' });
            } catch (err: any) {
              console.error('[unsend] caught:', err);
              setMessages(backup);
              Alert.alert('Error', 'Failed to unsend. Please try again.');
            }
          },
        },
      ]
    );
  };

  const copyMessage = () => {
    if (!actionTarget) return;
    Clipboard.setString(actionTarget.content);
    setActionTarget(null);
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

        if (fetchError) return;

        if (data && mountedRef.current) {
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
    setReactionsByMessage((prev) => {
      if (!(deletedId in prev)) return prev;
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
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

  useEffect(() => {
    const channelName = `private-reactions-${user?.id}-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_message_reactions' },
        (payload: any) => {
          const msgId = payload.new?.message_id ?? payload.old?.message_id;
          if (!msgId) return;
          setMessages((current) => {
            if (current.some((m) => m.id === msgId)) {
              loadReactionsForOne(msgId);
            }
            return current;
          });
        }
      )
      .subscribe();

    reactionsChannelRef.current = channel;

    return () => {
      if (reactionsChannelRef.current) {
        supabase.removeChannel(reactionsChannelRef.current);
        reactionsChannelRef.current = null;
      }
    };
  }, [user?.id, userId, loadReactionsForOne]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  const goBack = async () => {
    await markAllAsRead();
    if (embedded && onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
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

      const rows = reactionsByMessage[item.id] || [];
      const summaries = summarizeReactions(rows, user?.id);

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
              onLongPress={() => openActionSheet(item)}
              delayLongPress={350}
              style={[styles.messageRow, isMe ? styles.messageRight : styles.messageLeft]}
            >
              <MessageBubble
                content={item.content}
                time={time}
                isMe={isMe}
                deliveryStatus={item.sync_status}
                isRead={item.is_read}
                edited={edited}
                hasReply={hasReply}
                replyCaption={replyCaption}
                replyPreview={replyPreview}
                reactionSummaries={summaries}
                onPressReactions={
                  summaries.length > 0 ? () => setReactionsTarget(item.id) : undefined
                }
                avatarUri={otherUser?.avatar_url}
                avatarLabel={otherDisplayName}
                avatarColorSeed={userId || ''}
                onPressSender={!isMe ? () => setShowProfile(true) : undefined}
              />
            </Pressable>
          </SwipeableRow>
        </>
      );
    },
    [
      firstUnreadId,
      messages,
      reactionsByMessage,
      otherDisplayName,
      otherUser?.avatar_url,
      sending,
      startReply,
      user?.id,
      userId,
      openActionSheet,
    ]
  );

  if (loading && messages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </View>
    );
  }

  const canSave = inputText.trim().length > 0 && !sending;
  const replyingSenderLabel = replyingTo
    ? replyingTo.sender_id === user?.id
      ? 'You'
      : otherDisplayName
    : '';

  const isActionTargetMine = !!actionTarget && actionTarget.sender_id === user?.id;

  const actionTargetMyReaction =
    actionTarget && user
      ? (reactionsByMessage[actionTarget.id] || []).find(
          (r) => r.user_id === user.id
        )?.reaction ?? null
      : null;

  const reactionsSummaries =
    reactionsTarget !== null
      ? summarizeReactions(reactionsByMessage[reactionsTarget] || [], user?.id)
      : [];

  const Wrapper = embedded ? View : SafeAreaView;
  const wrapperProps = embedded ? { style: styles.container } : { style: styles.container, edges: ['top'] as any };

  return (
    <Wrapper {...wrapperProps}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name={embedded ? "close" : "arrow-back"} size={18} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.headerUser}
          onPress={() => setShowProfile(true)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: getAvatarColor(userId || '') },
            ]}
          >
            {/* Check for avatar image first */}
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerAvatarText}>
                {getInitials(otherUser?.full_name || otherUser?.username || '?')}
              </Text>
            )}
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
        </TouchableOpacity>

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
        behavior={Platform.OS === 'ios' && !embedded ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' && !embedded ? 90 : 0}
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

      <MessageActionSheet
        visible={!!actionTarget}
        isMe={isActionTargetMine}
        currentReaction={actionTargetMyReaction}
        onClose={closeActionSheet}
        onReact={applyReaction}
        onReply={
          !isActionTargetMine && actionTarget
            ? () => {
                const target = actionTarget;
                setActionTarget(null);
                startReply(target);
              }
            : undefined
        }
        onEdit={isActionTargetMine ? openEditFromSheet : undefined}
        onUnsend={isActionTargetMine ? confirmDeleteFromSheet : undefined}
        onCopy={copyMessage}
      />

      <ReactionsList
        visible={reactionsTarget !== null}
        onClose={() => setReactionsTarget(null)}
        summaries={reactionsSummaries}
        currentUserId={user?.id}
      />
      <Modal
        visible={notice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice(null)}
      >
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard} accessibilityLiveRegion="polite">
            <Text style={styles.noticeTitle}>{notice?.title}</Text>
            <Text style={styles.noticeText}>{notice?.message}</Text>
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={() => setNotice(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.noticeButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <ProfileCard
        userId={userId}
        visible={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </Wrapper>
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
    overflow: 'hidden', // <-- Added to clip image to circle
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
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
  noticeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  noticeCard: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    backgroundColor: CHAT_PANEL,
  },
  noticeTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  noticeText: { color: TEXT_MUTED, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  noticeButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: ACCENT_GOLD,
  },
  noticeButtonText: { color: CHAT_BG, fontSize: 12, fontWeight: '800' },

  keyboardContainer: { flex: 1 },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexGrow: 1,
  },

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
});