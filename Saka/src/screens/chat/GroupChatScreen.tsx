// screens/chat/GroupChatScreen.tsx - WITH PERSONALIZED SYSTEM MESSAGES + SCROLL-TO-LATEST FIX
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
  useWindowDimensions,
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
  BG_CARD,
  BG_SUBTLE,
  BORDER_DEFAULT,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import UserSearch from '../../components/chat/UserSearch';

// ============================================
// TYPES
// ============================================

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

// ============================================
// HELPERS
// ============================================

const normalizeProfile = (profiles: any): ProfileData | null => {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] || null;
  return profiles;
};

/**
 * Format a system message based on the current user's POV
 */
const formatSystemMessage = (item: Message, currentUserId: string): string => {
  if (!item.metadata) {
    return item.content;
  }

  const { action, actor_id, actor_name, target_id, target_name } = item.metadata;

  if (action === 'member_added') {
    if (actor_id === currentUserId) {
      return `You added ${target_name} to the group.`;
    }
    if (target_id === currentUserId) {
      return `${actor_name} added you to the group.`;
    }
    return `${actor_name} added ${target_name} to the group.`;
  }

  if (action === 'member_left') {
    if (actor_id === currentUserId) {
      return 'You left the group';
    }
    return `${actor_name} left the group`;
  }

  return item.content;
};

// ============================================
// MAIN COMPONENT
// ============================================

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

  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((state) => state.user);
  const subscriptionRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const { width: windowWidth } = useWindowDimensions();

  // ✅ Scroll tracking
  const isNearBottomRef = useRef(true);
  const initialScrollIndexRef = useRef<number | null>(null);
  const initialPositionPendingRef = useRef(false);
  const initialPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================
  // SCROLL HELPERS
  // ============================================

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
      if (initialPositionTimerRef.current) {
        clearTimeout(initialPositionTimerRef.current);
      }
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

  // ============================================
  // MARK GROUP AS READ
  // ============================================

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
    } catch (err) {
      console.warn('Mark group as read failed:', err);
    }
  }, [user, groupId]);

  // ============================================
  // LOAD GROUP
  // ============================================

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
    } catch (err) {
      console.error('Load group error:', err);
      setError('Failed to load group');
    }
  }, [groupId]);

  // ============================================
  // LOAD MEMBERS
  // ============================================

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
    } catch (err) {
      console.error('Load members error:', err);
    }
  }, [groupId]);

  // ============================================
  // LOAD MESSAGES
  // ============================================

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
          .select(`
            id,
            group_id,
            sender_id,
            content,
            type,
            media_url,
            metadata,
            created_at,
            updated_at,
            profiles:profiles (
              full_name,
              username,
              avatar_url
            )
          `)
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
        initialScrollIndexRef.current =
          firstUnreadIndex >= 0 ? firstUnreadIndex : null;

        // Recalculate the initial position whenever the screen is opened or refreshed.
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
      } catch (err) {
        console.error('Load messages error:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, groupId, markGroupAsRead]
  );

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = async () => {
    if (!user || !groupId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

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
      profiles: {
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
        avatar_url: null,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: Number(groupId),
          sender_id: user.id,
          content: text,
          type: 'text',
        })
        .select(`
          id,
          group_id,
          sender_id,
          content,
          type,
          media_url,
          metadata,
          created_at,
          updated_at,
          profiles:profiles (
            full_name,
            username,
            avatar_url
          )
        `)
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
      if (Number(newMessage.group_id) !== Number(groupId)) return;

      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          id,
          group_id,
          sender_id,
          content,
          type,
          media_url,
          metadata,
          created_at,
          updated_at,
          profiles:profiles (
            full_name,
            username,
            avatar_url
          )
        `)
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

        // ✅ Only auto-scroll if user is already near the bottom
        if (isNearBottomRef.current) {
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }

        await markGroupAsRead();
      }
    },
    [groupId, markGroupAsRead]
  );

  // ============================================
  // REALTIME: MEMBERS - UNIQUE CHANNEL
  // ============================================

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

  // ============================================
  // EFFECT: INITIAL LOAD + MESSAGES REALTIME
  // ============================================

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
        .subscribe((status) => {
          console.log('Group chat subscription status:', status);
        });

      subscriptionRef.current = channel;

      return () => {
        mountedRef.current = false;
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [groupId, loadGroup, loadMembers, loadMessages, handleNewMessage]);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages])
  );

  // ============================================
  // HELPERS
  // ============================================

  const goBack = async () => {
    await markGroupAsRead();
    router.back();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(true);
    loadMembers();
  };

  // ============================================
  // LEAVE GROUP - WITH SYSTEM MESSAGE
  // ============================================

  const handleLeaveGroup = async () => {
    if (!user || !groupId) return;
    setLeaving(true);

    try {
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.username ||
        'Someone';

      const { error: msgError } = await supabase
        .from('group_messages')
        .insert({
          group_id: Number(groupId),
          sender_id: user.id,
          content: `${userName} left the group`,
          type: 'system',
          metadata: {
            action: 'member_left',
            actor_id: user.id,
            actor_name: userName,
          },
        });

      if (msgError) {
        console.error('Failed to insert leave message:', msgError);
      }

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
    } catch (err) {
      console.error('Leave group error:', err);
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

  // ============================================
  // ADD MEMBER - WITH SYSTEM MESSAGE + METADATA
  // ============================================

  const handleAddMember = async (selectedUser: any) => {
    if (!user || !groupId) return;

    if (members.some((m) => m.user_id === selectedUser.id)) {
      Alert.alert('Already a member', 'This user is already in the group.');
      return;
    }

    try {
      const { error: addError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: selectedUser.id,
          role: 'member',
        });

      if (addError) throw addError;

      await supabase
        .from('group_read_receipts')
        .upsert(
          {
            group_id: groupId,
            user_id: selectedUser.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'group_id,user_id' }
        );

      const adderName =
        user.user_metadata?.full_name ||
        user.user_metadata?.username ||
        'Someone';

      const addedName =
        selectedUser.full_name ||
        selectedUser.username ||
        selectedUser.name ||
        'a new member';

      const { error: msgError } = await supabase
        .from('group_messages')
        .insert({
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

      if (msgError) {
        console.error('System message insert failed:', msgError);
      }

      setShowAddMembers(false);
      Alert.alert('Success', `${addedName} has been added to the group`);
    } catch (err) {
      console.error('Add member error:', err);
      Alert.alert('Error', 'Failed to add member. Please try again.');
    }
  };

  // ============================================
  // RENDER MESSAGE
  // ============================================

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.type === 'system') {
      const displayText = formatSystemMessage(item, user?.id || '');
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{displayText}</Text>
        </View>
      );
    }

    const isMe = item.sender_id === user?.id;
    const profile = normalizeProfile(item.profiles);
    const senderName = profile?.full_name || profile?.username || 'Anonymous';
    const bubbleWidth = Math.min(
      Math.max(58, item.content.length * 8.5 + 32),
      windowWidth * 0.8
    );

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
        {!isMe && (
          <View style={styles.messageSenderRow}>
            <View
              style={[
                styles.smallAvatar,
                { backgroundColor: getAvatarColor(item.sender_id) },
              ]}
            >
              <Text style={styles.smallAvatarText}>
                {getInitials(senderName)}
              </Text>
            </View>
            <Text style={[styles.senderName, { color: TEXT_MUTED }]}>
              {senderName}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
            { width: bubbleWidth },
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
        </View>
        <View
          style={[
            styles.messageMeta,
            { width: bubbleWidth },
            isMe ? styles.messageMetaMe : styles.messageMetaOther,
          ]}
        >
          <Text
            style={[
              styles.messageTime,
              { color: isMe ? 'rgba(255,255,255,0.6)' : TEXT_MUTED },
            ]}
          >
            {time}
          </Text>
        </View>
      </View>
    );
  };

  // ============================================
  // RENDER MEMBER
  // ============================================

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
          <Text style={[styles.memberName, { color: TEXT_PRIMARY }]}>
            {name}
          </Text>
          <Text style={[styles.memberRole, { color: TEXT_MUTED }]}>
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

  // ============================================
  // LOADING
  // ============================================

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT_GOLD} />
        <Text style={[styles.loadingText, { color: TEXT_MUTED }]}>
          Loading group chat...
        </Text>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
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
            <Ionicons name="people" size={20} color="#fff" />
          </View>
          <View style={styles.headerGroupInfo}>
            <Text style={[styles.headerName, { color: TEXT_PRIMARY }]}>
              {group?.name || 'Group Chat'}
            </Text>
            <Text style={[styles.headerStatus, { color: TEXT_MUTED }]}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowMenu(true)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={TEXT_MUTED}
              style={{ opacity: 0.3 }}
            />
            <Text style={[styles.emptyText, { color: TEXT_MUTED }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptySubtext, { color: TEXT_MUTED }]}>
              Be the first to say hello!
            </Text>
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
            // ✅ Scroll to newest ONCE after the list has measured content
            onContentSizeChange={handleContentSizeChange}
            // ✅ Safety net in case content size change hasn't fired yet
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

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={[styles.input, { color: TEXT_PRIMARY }]}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            {inputText.length > 0 && (
              <TouchableOpacity
                onPress={() => setInputText('')}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color="rgba(255,255,255,0.25)"
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
                    : 'rgba(255,255,255,0.06)',
              },
            ]}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? '#fff' : 'rgba(255,255,255,0.2)'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Members Modal */}
      <Modal
        visible={showMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembers(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.membersModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowMembers(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: TEXT_PRIMARY }]}>
                Members ({members.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMembers(false);
                  setShowAddMembers(true);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="person-add" size={20} color={ACCENT_GOLD} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={members}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMember}
              contentContainerStyle={styles.membersList}
            />
          </View>
        </View>
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
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <View style={styles.menuHeaderInfo}>
                <Text style={[styles.menuTitle, { color: TEXT_PRIMARY }]}>
                  {group?.name || 'Group Chat'}
                </Text>
                <Text style={[styles.menuSubtitle, { color: TEXT_MUTED }]}>
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
              <Ionicons name="people-outline" size={22} color={TEXT_PRIMARY} />
              <Text style={[styles.menuOptionText, { color: TEXT_PRIMARY }]}>
                View Members
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenu(false);
                setShowAddMembers(true);
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={22}
                color={ACCENT_GOLD}
              />
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
                <ActivityIndicator size="small" color="#FF6B6B" />
              ) : (
                <Ionicons name="exit-outline" size={22} color="#FF6B6B" />
              )}
              <Text style={[styles.menuOptionText, { color: '#FF6B6B' }]}>
                Leave Group
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, styles.menuCancel]}
              onPress={() => setShowMenu(false)}
            >
              <Text style={[styles.menuOptionText, { color: TEXT_MUTED }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMembers(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.addMembersModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowAddMembers(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: TEXT_PRIMARY }]}>
                Add Members
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.addMembersBody}>
              <Text style={[styles.addMembersHint, { color: TEXT_MUTED }]}>
                Search and tap a user to add them
              </Text>

              <UserSearch onSelect={handleAddMember} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, opacity: 0.7, marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: BG_PANEL,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    paddingVertical: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGroupInfo: { marginLeft: 10 },
  headerName: { fontSize: 16, fontWeight: '600' },
  headerStatus: { fontSize: 11, opacity: 0.6 },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.2)',
  },
  errorText: { color: '#FF6B6B', fontSize: 12, textAlign: 'center' },
  keyboardContainer: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.5,
  },
  emptySubtext: { marginTop: 6, fontSize: 13, opacity: 0.3 },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageRow: { alignSelf: 'stretch', marginVertical: 2 },
  messageLeft: { alignItems: 'flex-start' },
  messageRight: { alignItems: 'flex-end' },
  messageSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    marginLeft: 4,
  },
  smallAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  senderName: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
  messageBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 2,
  },
  messageBubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  messageText: { fontSize: 14, lineHeight: 18, flexShrink: 1 },
  messageTime: {
    fontSize: 9,
    marginTop: 4,
    opacity: 0.5,
  },
  messageMeta: { flexDirection: 'row' },
  messageMetaMe: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageMetaOther: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 32,
  },
  systemMessageText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: BG_PANEL,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    minHeight: 36,
  },
  clearButton: { padding: 6 },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  membersModal: {
    backgroundColor: BG_CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  addMembersModal: {
    backgroundColor: BG_CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  addMembersBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  addMembersHint: {
    fontSize: 13,
    marginBottom: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  membersList: { paddingHorizontal: 20, paddingTop: 12 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2, opacity: 0.6 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: BG_CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  menuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuHeaderInfo: { flex: 1 },
  menuTitle: { fontSize: 17, fontWeight: '700' },
  menuSubtitle: { fontSize: 12, marginTop: 2, opacity: 0.6 },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 14,
  },
  menuOptionText: { fontSize: 16, fontWeight: '600' },
  menuCancel: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});