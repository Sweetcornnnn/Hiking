// screens/GroupChatScreen.tsx
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
  CHAT_PANEL,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_DANGER,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_CARD,
  CHAT_RADIUS_MODAL,
  CHAT_FS_BODY,
  CHAT_FS_META,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import UserSearch from '../../components/chat/UserSearch';

type ProfileData = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  id?: string;
};

type Message = {
  id: number;
  group_id: number;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  media_url: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
  profiles?: any;
  reply_to_id: number | null;
  reply_to_sender: string | null;
  reply_to_content: string | null;
};

type GroupMember = {
  id: number;
  group_id: number;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  profiles: any;
};

type Group = {
  id: number;
  name: string;
  description: string | null;
  creator_id: string;
  avatar_url: string | null;
};

const normalizeProfile = (profiles: any): ProfileData | null => {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] || null;
  return profiles;
};

const formatSystemMessage = (item: Message, currentUserId: string): string => {
  if (!item.metadata) return item.content;
  const { action, actor_id, actor_name, target_id, target_name } = item.metadata;

  if (action === 'member_added') {
    if (actor_id === currentUserId) return `You added ${target_name} to the group.`;
    if (target_id === currentUserId) return `${actor_name} added you to the group.`;
    return `${actor_name} added ${target_name} to the group.`;
  }
  if (action === 'member_left') {
    if (actor_id === currentUserId) return 'You left the group.';
    return `${actor_name} left the group.`;
  }
  return item.content;
};

const isEdited = (m: { created_at: string; updated_at: string }) => {
  try {
    return new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > 1000;
  } catch {
    return false;
  }
};

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

const SELECT_COLS = `
  id,
  group_id,
  sender_id,
  content,
  type,
  media_url,
  metadata,
  created_at,
  updated_at,
  reply_to_id,
  reply_to_sender,
  reply_to_content,
  profiles:profiles (
    full_name,
    username,
    avatar_url
  )
`;

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

export default function GroupChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

  const markGroupAsRead = useCallback(async () => {
    if (!user || !groupId) return;
    try {
      await supabase
        .from('group_read_receipts')
        .upsert(
          {
            group_id: groupId,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'group_id,user_id' }
        );
    } catch {
      return;
    }
  }, [user, groupId]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, creator_id, avatar_url')
        .eq('id', groupId)
        .single();
      if (error) throw error;
      setGroup(data);
    } catch {
      setError('Failed to load group');
    }
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          user_id,
          role,
          joined_at,
          profiles:profiles (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;

      const normalizedMembers: GroupMember[] = (data || []).map((member: any) => ({
        ...member,
        profiles: normalizeProfile(member.profiles),
      }));

      setMembers(normalizedMembers);
    } catch {
      return;
    }
  }, [groupId]);

  const loadMessages = useCallback(
    async (refresh = false) => {
      if (!user || !groupId) return;

      try {
        setError(null);
        if (!refresh) setLoading(true);

        const { data: receipt } = await supabase
          .from('group_read_receipts')
          .select('last_read_at')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle();

        const lastReadAt = receipt?.last_read_at
          ? new Date(receipt.last_read_at).getTime()
          : 0;

        const { data, error: queryError } = await supabase
          .from('group_messages')
          .select(SELECT_COLS)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (queryError) throw queryError;

        const normalizedMessages: Message[] = (data || []).map((msg: any) => ({
          ...msg,
          profiles: normalizeProfile(msg.profiles),
        }));

        const firstUnreadIndex = normalizedMessages.findIndex(
          (message) =>
            message.sender_id !== user.id &&
            new Date(message.created_at).getTime() > lastReadAt
        );
        initialScrollIndexRef.current = firstUnreadIndex >= 0 ? firstUnreadIndex : null;
        initialPositionPendingRef.current = true;

        setMessages(normalizedMessages);

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
        await markGroupAsRead();
      } catch {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, groupId, markGroupAsRead]
  );

  // ─── SEND ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!user || !groupId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const reply = replyingTo;
    const repliedToName = reply
      ? reply.sender_id === user.id
        ? myDisplayName
        : normalizeProfile(reply.profiles)?.full_name ||
          normalizeProfile(reply.profiles)?.username ||
          'Member'
      : null;

    const tempId = Date.now();
    const optimisticMessage: Message = {
      id: tempId,
      group_id: Number(groupId),
      sender_id: user.id,
      content: text,
      type: 'text',
      media_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reply_to_id: reply?.id ?? null,
      reply_to_sender: repliedToName,
      reply_to_content: reply?.content ?? null,
      profiles: {
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
        avatar_url: null,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: Number(groupId),
          sender_id: user.id,
          content: text,
          type: 'text',
          reply_to_id: reply?.id ?? null,
          reply_to_sender: repliedToName,
          reply_to_content: reply?.content ?? null,
        })
        .select(SELECT_COLS)
        .single();

      if (error) throw error;

      const normalizedMessage: Message = {
        ...data,
        profiles: normalizeProfile(data.profiles),
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? normalizedMessage : msg))
      );
      await markGroupAsRead();
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
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
      prev.map((m) => (m.id === targetId ? { ...m, content: newContent, updated_at: now } : m))
    );

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .update({ content: newContent, updated_at: now })
        .eq('id', targetId)
        .eq('sender_id', user.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Message could not be updated');

      setEditingMessage(null);
      setInputText('');
    } catch {
      setMessages(backup);
      Alert.alert('Error', 'Failed to edit message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ─── REPLY ─────────────────────────────────────────────────
  const getSenderLabel = (msg: Message): string => {
    if (msg.sender_id === user?.id) return 'You';
    const p = normalizeProfile(msg.profiles);
    return p?.full_name || p?.username || 'Member';
  };

  const startReply = (msg: Message) => {
    if (editingMessage) {
      setEditingMessage(null);
      setInputText('');
    }
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const cancelReply = () => setReplyingTo(null);

  const handleSendOrSave = () => {
    if (editingMessage) return saveEdit();
    return sendMessage();
  };

  // ─── DELETE ────────────────────────────────────────────────
  const openDeleteSheet = (message: Message) => {
    if (message.type === 'system' || message.sender_id !== user?.id) return;
    setSelectedMessage(message);
    setShowDeleteSheet(true);
  };

  const closeDeleteSheet = () => {
    if (deleting) return;
    setShowDeleteSheet(false);
    setSelectedMessage(null);
  };

  const confirmDeleteMessage = async () => {
    if (
      !selectedMessage ||
      !user ||
      selectedMessage.sender_id !== user.id ||
      selectedMessage.type === 'system'
    ) return;
    const msgId = selectedMessage.id;
    setDeleting(true);

    const backup = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setShowDeleteSheet(false);
    setSelectedMessage(null);

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .delete()
        .eq('id', msgId)
        .eq('sender_id', user.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Message could not be deleted');
    } catch {
      setMessages(backup);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── REALTIME ──────────────────────────────────────────────
  const handleNewMessage = useCallback(
    async (payload: any) => {
      if (!mountedRef.current) return;
      const newMessage = payload.new;
      if (Number(newMessage.group_id) !== Number(groupId)) return;

      const { data, error } = await supabase
        .from('group_messages')
        .select(SELECT_COLS)
        .eq('id', newMessage.id)
        .single();

      if (!error && data && mountedRef.current) {
        const normalizedMessage: Message = {
          ...data,
          profiles: normalizeProfile(data.profiles),
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === normalizedMessage.id)) return prev;
          return [...prev, normalizedMessage];
        });

        if (isNearBottomRef.current) {
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }

        await markGroupAsRead();
      }
    },
    [groupId, markGroupAsRead]
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
              updated_at: updated.updated_at ?? msg.updated_at,
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
    if (!groupId) return;
    const channelName = `group-members-${groupId}-${Date.now()}`;
    const memberChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        () => loadMembers()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(memberChannel);
    };
  }, [groupId, loadMembers]);

  useEffect(() => {
    mountedRef.current = true;
    loadGroup();
    loadMembers();
    if (groupId) {
      const channelName = `group-messages-${groupId}-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${groupId}`,
          },
          handleNewMessage
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'group_messages' },
          handleUpdatedMessage
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'group_messages' },
          handleDeletedMessage
        )
        .subscribe();

      subscriptionRef.current = channel;

      return () => {
        mountedRef.current = false;
        if (initialPositionTimerRef.current) clearTimeout(initialPositionTimerRef.current);
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      };
    }
    return () => {
      mountedRef.current = false;
    };
  }, [groupId, loadGroup, loadMembers, loadMessages, handleNewMessage, handleDeletedMessage, handleUpdatedMessage]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  const goBack = async () => {
    await markGroupAsRead();
    router.back();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(true);
    loadMembers();
  };

  const handleLeaveGroup = async () => {
    if (!user || !groupId) return;
    setLeaving(true);

    try {
      const userName =
        user.user_metadata?.full_name || user.user_metadata?.username || 'Someone';

      await supabase.from('group_messages').insert({
        group_id: Number(groupId),
        sender_id: user.id,
        content: `${userName} left the group.`,
        type: 'system',
        metadata: { action: 'member_left', actor_id: user.id, actor_name: userName },
      });

      const { error: leaveError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);
      if (leaveError) throw leaveError;

      await supabase
        .from('group_read_receipts')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      setShowMenu(false);
      setLeaving(false);
      router.replace('/chat/Chat' as any);
    } catch {
      setLeaving(false);
      Alert.alert('Error', 'Failed to leave group. Please try again.');
    }
  };

  const confirmLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group?.name || 'this group'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: handleLeaveGroup },
      ]
    );
  };

  const handleAddMember = async (selectedUser: any) => {
    if (!user || !groupId) return;

    if (members.some((m) => m.user_id === selectedUser.id)) {
      Alert.alert('Already a member', 'This user is already in the group.');
      return;
    }

    try {
      const { error: addError } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: selectedUser.id,
        role: 'member',
      });
      if (addError) throw addError;

      await supabase.from('group_read_receipts').upsert(
        {
          group_id: groupId,
          user_id: selectedUser.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,user_id' }
      );

      const adderName =
        user.user_metadata?.full_name || user.user_metadata?.username || 'Someone';
      const addedName =
        selectedUser.full_name ||
        selectedUser.username ||
        selectedUser.name ||
        'a new member';

      await supabase.from('group_messages').insert({
        group_id: Number(groupId),
        sender_id: user.id,
        content: `${adderName} added ${addedName}`,
        type: 'system',
        metadata: {
          action: 'member_added',
          actor_id: user.id,
          actor_name: adderName,
          target_id: selectedUser.id,
          target_name: addedName,
        },
      });
      setShowAddMembers(false);
      Alert.alert('Success', `${addedName} has been added to the group`);
    } catch {
      Alert.alert('Error', 'Failed to add member. Please try again.');
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateDivider =
      !previousMessage || !isSameDay(previousMessage.created_at, item.created_at);
    const dateLabel = showDateDivider ? formatDateDivider(item.created_at) : '';
    const dateDivider = dateLabel ? (
      <View style={styles.dateDivider}>
        <View style={styles.dateDividerLine} />
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>{dateLabel}</Text>
        </View>
        <View style={styles.dateDividerLine} />
      </View>
    ) : null;

    if (item.type === 'system') {
      const displayText = formatSystemMessage(item, user?.id || '');
      return (
        <>
          {dateDivider}
          <View style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>{displayText}</Text>
          </View>
        </>
      );
    }

    const isMe = item.sender_id === user?.id;
    const profile = normalizeProfile(item.profiles);
    const senderName = profile?.full_name || profile?.username || 'Member';

    const time = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '';
    const edited = isEdited(item);
    const hasReply = !!item.reply_to_id;

    const repliedMessage = hasReply
      ? messages.find((message) => message.id === item.reply_to_id)
      : null;
    const repliedToLabel = repliedMessage
      ? getSenderLabel(repliedMessage)
      : item.reply_to_sender || 'a message';
    const replyCaption = isMe
      ? `You replied to ${repliedToLabel}`
      : repliedMessage?.sender_id === user?.id
        ? `${senderName} replied to you`
        : `${senderName} replied to ${repliedToLabel}`;
    const replyPreview =
      repliedMessage?.content ?? item.reply_to_content ?? 'Original message unavailable';

    return (
      <>
        {dateDivider}
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
              edited={edited}
              hasReply={hasReply}
              replyCaption={replyCaption}
              replyPreview={replyPreview}
              showReadReceipt={false}
              showAvatar={false}
              showSenderHeader={!isMe}
              senderName={senderName}
              senderColorSeed={item.sender_id}
            />
          </Pressable>
        </SwipeableRow>
      </>
    );
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const profile = normalizeProfile(item.profiles);
    const name = profile?.full_name || profile?.username || 'Unknown';

    return (
      <View style={styles.memberItem}>
        <View
          style={[
            styles.memberAvatar,
            { backgroundColor: getAvatarColor(item.user_id) },
          ]}
        >
          <Text style={styles.memberAvatarText}>{getInitials(name)}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{name}</Text>
          <Text style={styles.memberRole}>
            {item.role === 'admin'
              ? '👑 Admin'
              : item.role === 'moderator'
              ? '🛡️ Moderator'
              : 'Member'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading group chat...</Text>
      </SafeAreaView>
    );
  }

  const canSave = inputText.trim().length > 0 && !sending;
  const replyingSenderLabel = replyingTo ? getSenderLabel(replyingTo) : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerGroup}
          onPress={() => setShowMembers(true)}
        >
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: getAvatarColor(groupId || '') },
            ]}
          >
            <Ionicons name="people" size={16} color="#fff" />
          </View>
          <View style={styles.headerGroupInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {group?.name || 'Group Chat'}
            </Text>
            <Text style={styles.headerStatus}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => setShowMenu(true)}>
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
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={28}
              color={TEXT_MUTED}
              style={{ opacity: 0.4 }}
            />
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        ) : (
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
                onRefresh={onRefresh}
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
          />
        )}

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
                  ? 'Edit message...'
                  : replyingTo
                  ? 'Reply...'
                  : 'Type a message...'
              }
              placeholderTextColor="rgba(255,255,255,0.28)"
              style={[styles.input, { color: TEXT_PRIMARY }]}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => setInputText('')} style={styles.clearButton}>
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

      {/* Members Modal */}
      <Modal
        visible={showMembers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMembers(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMembers(false)}>
          <Pressable style={styles.membersModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowMembers(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={16} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Members ({members.length})</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMembers(false);
                  setShowAddMembers(true);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="person-add" size={14} color={ACCENT_GOLD} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={members}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMember}
              contentContainerStyle={styles.membersList}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View
                style={[
                  styles.menuAvatar,
                  { backgroundColor: getAvatarColor(groupId || '') },
                ]}
              >
                <Ionicons name="people" size={18} color="#fff" />
              </View>
              <View style={styles.menuHeaderInfo}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {group?.name || 'Group Chat'}
                </Text>
                <Text style={styles.menuSubtitle}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenu(false);
                setShowMembers(true);
              }}
            >
              <Ionicons name="people-outline" size={16} color={TEXT_PRIMARY} />
              <Text style={styles.menuOptionText}>View Members</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenu(false);
                setShowAddMembers(true);
              }}
            >
              <Ionicons name="person-add-outline" size={16} color={ACCENT_GOLD} />
              <Text style={[styles.menuOptionText, { color: ACCENT_GOLD }]}>
                Add Members
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={confirmLeaveGroup}
              disabled={leaving}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={CHAT_DANGER} />
              ) : (
                <Ionicons name="exit-outline" size={16} color={CHAT_DANGER} />
              )}
              <Text style={[styles.menuOptionText, { color: CHAT_DANGER }]}>
                Leave Group
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, styles.menuCancel]}
              onPress={() => setShowMenu(false)}
            >
              <Text style={[styles.menuOptionText, { color: TEXT_MUTED }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMembers(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddMembers(false)}>
          <Pressable style={styles.addMembersModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowAddMembers(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={16} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Members</Text>
              <View style={{ width: 32 }} />
            </View>

            <View style={styles.addMembersBody}>
              <Text style={styles.addMembersHint}>
                Search and tap a user to add them
              </Text>
              <UserSearch onSelect={handleAddMember} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  headerGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 4,
  },
  headerAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGroupInfo: { marginLeft: 9, flex: 1, minWidth: 0 },
  headerName: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  headerStatus: { fontSize: 10, opacity: 0.75, color: TEXT_MUTED, marginTop: 1 },

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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED, marginTop: 4 },

  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 6,
    flexGrow: 1,
  },

  // ── Swipe wrapper ──
  swipeContainer: {
    width: '100%',
    marginVertical: 6,
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

  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemMessageText: {
    fontSize: 10,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.75,
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
    paddingVertical: 8,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  membersModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '75%',
    backgroundColor: CHAT_PANEL,
    borderRadius: CHAT_RADIUS_CARD,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
  },
  addMembersModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '75%',
    backgroundColor: CHAT_PANEL,
    borderRadius: CHAT_RADIUS_CARD,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
  },
  addMembersBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  addMembersHint: {
    fontSize: 11,
    marginBottom: 10,
    opacity: 0.7,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  membersList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 12.5, fontWeight: '600', color: TEXT_PRIMARY },
  memberRole: { fontSize: 10, marginTop: 1, opacity: 0.7, color: TEXT_MUTED },

  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: CHAT_PANEL,
    borderTopLeftRadius: CHAT_RADIUS_MODAL,
    borderTopRightRadius: CHAT_RADIUS_MODAL,
    paddingBottom: 26,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
    gap: 10,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuHeaderInfo: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  menuSubtitle: { fontSize: 10, marginTop: 1, opacity: 0.7, color: TEXT_MUTED },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  menuOptionText: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  menuCancel: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
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