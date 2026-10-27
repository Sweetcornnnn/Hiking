// screens/PrivateChatScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
  Image, // <-- Imported Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_PANEL,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_MODAL,
} from '../../theme/designTokens';
import UserSearch from '../../components/chat/UserSearch';
import CreateGroupModal from '../../components/chat/CreateGroupModal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAvatarColor, getInitials } from '../../utils/colors';

type Conversation = {
  id: string;
  title: string;
  preview: string;
  type: 'private' | 'group';
  time?: string;
  unread?: number;
  user_id?: string;
  group_id?: string;
  conversation_id?: string;
  sortTimestamp?: number;
  is_online?: boolean;
  avatar_url?: string | null; // <-- Added
};

const rowColorKey = (c: Conversation): string => {
  if (c.type === 'private' && c.user_id) return c.user_id;
  if (c.type === 'group' && c.group_id) return c.group_id;
  return c.id;
};

export default function PrivateChatScreen({
  embedded = false,
  maxWidth,
  onOpenCreateGroup,
  onSelectConversation,
  activeConversationId,
}: {
  embedded?: boolean;
  maxWidth?: number;
  onOpenCreateGroup?: () => void;
  onSelectConversation?: (conv: { type: 'private' | 'group'; id: string }) => void;
  activeConversationId?: string | null;
}) {
  const router = useRouter();
  const [showCreateLocal, setShowCreateLocal] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const user = useAuthStore((state) => state.user);

  const openCreateGroup = useCallback(() => {
    if (onOpenCreateGroup) {
      onOpenCreateGroup();
    } else {
      setShowCreateLocal(true);
    }
  }, [onOpenCreateGroup]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const loadConversations = useCallback(
    async (refresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setError(null);
        if (!refresh) setLoading(true);
        const conversationsList: Conversation[] = [];

        const { data: privateData, error: privateError } = await supabase
          .from('conversations')
          .select('id, participant1_id, participant2_id, last_message_at')
          .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (privateError) throw privateError;

        if (privateData && privateData.length > 0) {
          for (const conv of privateData as any[]) {
            const otherUserId =
              conv.participant1_id === user.id
                ? conv.participant2_id
                : conv.participant1_id;

            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, full_name, username, email, avatar_url, is_online, last_seen')
              .eq('id', otherUserId)
              .single();

            const { data: latestMessage } = await supabase
              .from('private_messages')
              .select('id, content, sender_id, created_at')
              .or(
                `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
                  `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
              )
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { count: unreadCount } = await supabase
              .from('private_messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', otherUserId)
              .eq('recipient_id', user.id)
              .eq('is_read', false);

            const name =
              profileData?.full_name || profileData?.username || 'Unknown User';
            const preview = latestMessage?.content || 'No messages yet';
            const effectiveTimestamp =
              latestMessage?.created_at || conv.last_message_at;
            const time = effectiveTimestamp ? formatTime(effectiveTimestamp) : '';

            conversationsList.push({
              id: `private_${conv.id}`,
              title: name,
              preview,
              type: 'private',
              time,
              unread: unreadCount || 0,
              user_id: otherUserId,
              conversation_id: String(conv.id),
              sortTimestamp: effectiveTimestamp
                ? new Date(effectiveTimestamp).getTime()
                : 0,
              is_online: profileData?.is_online || false,
              avatar_url: profileData?.avatar_url || null, // <-- Mapped
            });
          }
        }

        const { data: groupData, error: groupError } = await supabase
          .from('group_members')
          .select(`
            groups!inner (
              id,
              name,
              description,
              creator_id,
              avatar_url,
              updated_at,
              group_messages (
                id,
                content,
                sender_id,
                type,
                metadata,
                created_at
              )
            )
          `)
          .eq('user_id', user.id)
          .is('hidden_at', null);

        if (groupError) throw groupError;

        if (groupData && groupData.length > 0) {
          for (const item of groupData as any[]) {
            const group = item.groups;
            const sortedMessages = (group.group_messages || []).sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            const latestMessage = sortedMessages[0];
            const messageMetadata = latestMessage?.metadata;
            const preview =
              latestMessage?.type === 'system' &&
              messageMetadata?.action === 'member_added' &&
              messageMetadata.actor_id === user.id &&
              messageMetadata.target_name
                ? `You added ${messageMetadata.target_name} to the group.`
                : latestMessage?.content || 'No messages yet';

            const { data: receipt } = await supabase
              .from('group_read_receipts')
              .select('last_read_at')
              .eq('group_id', group.id)
              .eq('user_id', user.id)
              .single();

            const lastReadAt = receipt?.last_read_at
              ? new Date(receipt.last_read_at)
              : new Date(0);

            const { count: unreadCount } = await supabase
              .from('group_messages')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id)
              .gt('created_at', lastReadAt.toISOString())
              .neq('sender_id', user.id);

            conversationsList.push({
              id: `group_${group.id}`,
              title: group.name,
              preview,
              type: 'group',
              time: latestMessage?.created_at
                ? formatTime(latestMessage.created_at)
                : group.updated_at
                ? formatTime(group.updated_at)
                : '',
              unread: unreadCount || 0,
              group_id: String(group.id),
              sortTimestamp: latestMessage?.created_at
                ? new Date(latestMessage.created_at).getTime()
                : group.updated_at
                ? new Date(group.updated_at).getTime()
                : 0,
              avatar_url: group.avatar_url || null, // <-- Mapped group avatar too just in case
            });
          }
        }

        conversationsList.sort(
          (a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0)
        );
        setConversations(conversationsList);
      } catch {
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    if (!user) return;
    const channelName = `conversation-updates-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'private_messages' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_messages' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_read_receipts' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' }, // Triggers on avatar update
        () => loadConversations(true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations(true);
  }, [loadConversations]);

  const handleDeleteOrLeave = async () => {
    if (!selectedConversation || !user) return;
    const isGroup = selectedConversation.type === 'group';
    setDeleting(true);
    try {
      if (!isGroup && selectedConversation.conversation_id) {
        const otherUserId = selectedConversation.user_id;
        await supabase
          .from('private_messages')
          .delete()
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
              `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
          );
        await supabase
          .from('conversations')
          .delete()
          .eq('id', selectedConversation.conversation_id);
      } else if (isGroup && selectedConversation.group_id) {
        const { error: hideError } = await supabase
          .from('group_members')
          .update({ hidden_at: new Date().toISOString() })
          .eq('group_id', selectedConversation.group_id)
          .eq('user_id', user.id);
        if (hideError) throw hideError;
      }

      await loadConversations(true);
      setShowActionSheet(false);
      setSelectedConversation(null);
      setNotice({
        title: 'Success',
        message: isGroup
          ? 'Chat removed from your list. It will reappear when someone posts.'
          : 'Conversation deleted',
      });
    } catch {
      Alert.alert('Error', 'Action failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConversationPress = async (conversation: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversation.id ? { ...c, unread: 0 } : c))
    );

    if (conversation.type === 'private' && conversation.user_id && user) {
      try {
        await supabase
          .from('private_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('sender_id', conversation.user_id)
          .eq('recipient_id', user.id)
          .eq('is_read', false);
      } catch {}
    }

    if (conversation.type === 'group' && conversation.group_id && user) {
      try {
        await supabase.from('group_read_receipts').upsert(
          {
            group_id: conversation.group_id,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'group_id,user_id' }
        );
      } catch {}
    }

    if (onSelectConversation) {
      onSelectConversation({
        type: conversation.type,
        id: conversation.type === 'private' ? conversation.user_id! : conversation.group_id!,
      });
    } else if (conversation.type === 'private' && conversation.user_id) {
      router.push({
        pathname: '/chat/Conversation',
        params: { userId: conversation.user_id },
      } as any);
    } else if (conversation.type === 'group' && conversation.group_id) {
      router.push({
        pathname: '/chat/GroupChat',
        params: { groupId: conversation.group_id },
      } as any);
    }
  };

  const handleUserSelect = (selectedUser: any) => {
    if (onSelectConversation) {
      onSelectConversation({ type: 'private', id: selectedUser.id });
    } else {
      router.push({
        pathname: '/chat/Conversation',
        params: { userId: selectedUser.id },
      } as any);
    }
  };

  const handleLongPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowActionSheet(true);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isGroup = item.type === 'group';
    const hasUnread = (item.unread || 0) > 0;
    const isOnline = item.type === 'private' && item.is_online === true;
    const color = getAvatarColor(rowColorKey(item));
    
    const isActive = activeConversationId === (item.type === 'private' ? item.user_id : item.group_id);

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          hasUnread && styles.conversationItemUnread,
          isActive && styles.conversationItemActive,
          maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : undefined,
        ]}
        onPress={() => handleConversationPress(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {/* Render Image if avatar_url exists, else fallback to initials */}
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{getInitials(item.title)}</Text>
            </View>
          )}
          
          {isOnline && <View style={styles.onlineIndicator} />}
          {isGroup && (
            <View style={styles.groupBadgeSmall}>
              <Ionicons name="people" size={9} color={CHAT_BG} />
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[
                styles.conversationTitle,
                (hasUnread || isActive) && styles.conversationTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.time && (
              <Text
                style={[
                  styles.conversationTime,
                  (hasUnread || isActive) && styles.conversationTimeUnread,
                ]}
              >
                {item.time}
              </Text>
            )}
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[
                styles.conversationPreview,
                (hasUnread || isActive) && styles.conversationPreviewUnread,
              ]}
              numberOfLines={1}
            >
              {item.preview}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread! > 99 ? '99+' : item.unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && conversations.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
        <Text style={styles.loadingText}>Loading conversations…</Text>
      </View>
    );
  }

  const isSelectedGroup = selectedConversation?.type === 'group';

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        ListHeaderComponent={
          <View
            style={[
              styles.headerContainer,
              maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : undefined,
            ]}
          >
            {!embedded && (
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>Messages</Text>
                  <Text style={styles.hint}>Find or start a conversation</Text>
                </View>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={openCreateGroup}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={13} color={CHAT_BG} />
                  <Text style={styles.createButtonText}>New Group</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.searchWrapper}>
              <UserSearch onSelect={handleUserSelect} buttonLabel="Message" />
            </View>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={32}
              color={TEXT_MUTED}
              style={{ opacity: 0.35 }}
            />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start a new chat or create a group</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT_GOLD}
            colors={[ACCENT_GOLD]}
          />
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={15}
      />

      {showCreateLocal && (
        <CreateGroupModal onClose={() => setShowCreateLocal(false)} />
      )}

      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <TouchableOpacity
          style={styles.actionBackdrop}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.actionHeader}>
              <View
                style={[
                  styles.actionAvatar,
                  {
                    backgroundColor: getAvatarColor(
                      selectedConversation ? rowColorKey(selectedConversation) : ''
                    ),
                  },
                ]}
              >
                <Text style={styles.actionAvatarText}>
                  {getInitials(selectedConversation?.title || '?')}
                </Text>
              </View>
              <View style={styles.actionHeaderInfo}>
                <Text style={styles.actionTitle} numberOfLines={1}>
                  {selectedConversation?.title}
                </Text>
                <Text style={styles.actionSubtitle}>
                  {isSelectedGroup ? 'Group chat' : 'Private chat'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleDeleteOrLeave}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#E07070" />
              ) : (
                <Ionicons name="trash-outline" size={16} color="#E07070" />
              )}
              <Text style={[styles.actionOptionText, { color: '#E07070' }]}>
                {isSelectedGroup ? 'Delete Chat' : 'Delete Conversation'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionOption, styles.actionCancel]}
              onPress={() => setShowActionSheet(false)}
            >
              <Text style={[styles.actionOptionText, { color: TEXT_PRIMARY }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 6, fontSize: 11, color: TEXT_MUTED },

  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 4 : 6,
    paddingBottom: 4,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  hint: { fontSize: 10, color: TEXT_MUTED, opacity: 0.75 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: ACCENT_GOLD,
  },
  createButtonText: { fontWeight: '700', fontSize: 11, color: CHAT_BG },

  searchWrapper: { paddingHorizontal: 14, marginBottom: 6 },

  listContent: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 100 },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  conversationItemUnread: {
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderColor: 'rgba(201,169,110,0.22)',
  },
  conversationItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarWrap: { position: 'relative', marginRight: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CHAT_ONLINE,
    borderWidth: 2,
    borderColor: CHAT_BG,
  },
  groupBadgeSmall: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CHAT_BG,
  },

  conversationContent: { flex: 1, minWidth: 0, gap: 3 },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  conversationTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  conversationTitleUnread: { fontWeight: '700' },
  conversationTime: {
    fontSize: 10,
    color: TEXT_MUTED,
    opacity: 0.7,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  conversationTimeUnread: { color: ACCENT_GOLD, opacity: 1, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationPreview: {
    flex: 1,
    fontSize: 11,
    color: TEXT_MUTED,
    opacity: 0.8,
  },
  conversationPreviewUnread: {
    color: 'rgba(255,255,255,0.85)',
    opacity: 1,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_GOLD,
    paddingHorizontal: 5,
  },
  unreadText: {
    color: CHAT_BG,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    gap: 6,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED, marginTop: 6 },
  emptySubtext: { fontSize: 11, color: TEXT_MUTED, opacity: 0.6 },

  errorBanner: {
    marginHorizontal: 14,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: 'rgba(224,112,112,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.22)',
  },
  errorText: { color: '#E07070', fontSize: 11, textAlign: 'center' },

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
    borderRadius: CHAT_RADIUS_MODAL,
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

  actionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: CHAT_PANEL,
    borderTopLeftRadius: CHAT_RADIUS_MODAL,
    borderTopRightRadius: CHAT_RADIUS_MODAL,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
    gap: 10,
  },
  actionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionHeaderInfo: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  actionSubtitle: { fontSize: 10, marginTop: 1, color: TEXT_MUTED, opacity: 0.75 },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  actionOptionText: { fontSize: 13, fontWeight: '600' },
  actionCancel: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
  },
});