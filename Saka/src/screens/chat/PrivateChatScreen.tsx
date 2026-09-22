// screens/chat/PrivateChatScreen.tsx - WITH FIXED CREATE GROUP MODAL
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  BORDER_DEFAULT,
} from '../../theme/designTokens';
import UserSearch from '../../components/chat/UserSearch';
import SelectedMembers from '../../components/chat/SelectedMembers';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAvatarColor, getInitials } from '../../utils/colors';

// ============================================
// TYPES
// ============================================

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
};

// ============================================
// HELPER
// ============================================

const rowColorKey = (c: Conversation): string => {
  if (c.type === 'private' && c.user_id) return c.user_id;
  if (c.type === 'group' && c.group_id) return c.group_id;
  return c.id;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PrivateChatScreen() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  // ============================================
  // LOAD CONVERSATIONS
  // ============================================

  const loadConversations = useCallback(async (refresh = false) => {
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
        .select(`
          id,
          participant1_id,
          participant2_id,
          last_message_at,
          private_messages!last_message_id (
            id,
            content,
            sender_id,
            created_at
          )
        `)
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

          const { count: unreadCount } = await supabase
            .from('private_messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', otherUserId)
            .eq('recipient_id', user.id)
            .eq('is_read', false);

          const name =
            profileData?.full_name || profileData?.username || 'Unknown User';
          const preview = conv.private_messages?.content || 'No messages yet';
          const time = conv.last_message_at
            ? formatTime(conv.last_message_at)
            : '';

          conversationsList.push({
            id: `private_${conv.id}`,
            title: name,
            preview: preview,
            type: 'private',
            time: time,
            unread: unreadCount || 0,
            user_id: otherUserId,
            conversation_id: String(conv.id),
            sortTimestamp: conv.last_message_at
              ? new Date(conv.last_message_at).getTime()
              : 0,
            is_online: profileData?.is_online || false,
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
              created_at
            )
          )
        `)
        .eq('user_id', user.id);

      if (groupError) throw groupError;

      if (groupData && groupData.length > 0) {
        for (const item of groupData as any[]) {
          const group = item.groups;

          const sortedMessages = (group.group_messages || []).sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
          const latestMessage = sortedMessages[0];

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
            preview: latestMessage?.content || 'No messages yet',
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
          });
        }
      }

      conversationsList.sort(
        (a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0)
      );

      setConversations(conversationsList);
    } catch (err) {
      console.error('Load conversations error:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

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
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_read_receipts' },
        () => loadConversations(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
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

  // ============================================
  // DELETE / LEAVE
  // ============================================

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
        const { error: leaveError } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', selectedConversation.group_id)
          .eq('user_id', user.id);

        if (leaveError) throw leaveError;
      }

      await loadConversations(true);
      setShowActionSheet(false);
      const wasGroup = isGroup;
      setSelectedConversation(null);

      Alert.alert(
        'Success',
        wasGroup ? 'You have left the group' : 'Conversation deleted'
      );
    } catch (err) {
      console.error('Delete/Leave error:', err);
      Alert.alert('Error', 'Action failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // NAVIGATION
  // ============================================

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
      } catch (err) {
        console.warn('Private safety net failed:', err);
      }
    }

    if (conversation.type === 'group' && conversation.group_id && user) {
      try {
        await supabase
          .from('group_read_receipts')
          .upsert(
            {
              group_id: conversation.group_id,
              user_id: user.id,
              last_read_at: new Date().toISOString(),
            },
            { onConflict: 'group_id,user_id' }
          );
      } catch (err) {
        console.warn('Group safety net failed:', err);
      }
    }

    if (conversation.type === 'private' && conversation.user_id) {
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
    router.push({
      pathname: '/chat/Conversation',
      params: { userId: selectedUser.id },
    } as any);
  };

  const handleLongPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowActionSheet(true);
  };

  // ============================================
  // RENDER CONVERSATION ITEM
  // ============================================

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isGroup = item.type === 'group';
    const hasUnread = (item.unread || 0) > 0;
    const isOnline = item.type === 'private' && item.is_online === true;
    const color = getAvatarColor(rowColorKey(item));

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          hasUnread && styles.conversationItemUnread,
        ]}
        onPress={() => handleConversationPress(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatarRing,
              { backgroundColor: color + '22', borderColor: color + '55' },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{getInitials(item.title)}</Text>
            </View>
          </View>

          {isOnline && <View style={styles.onlineIndicator} />}

          {isGroup && (
            <View style={styles.groupBadgeSmall}>
              <Ionicons name="people" size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[
                styles.conversationTitle,
                hasUnread && styles.conversationTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.time && (
              <Text
                style={[
                  styles.conversationTime,
                  hasUnread && styles.conversationTimeUnread,
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
                hasUnread && styles.conversationPreviewUnread,
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
        <ActivityIndicator size="large" color={ACCENT_GOLD} />
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
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>Messages</Text>
                <Text style={styles.hint}>Find or start a conversation</Text>
              </View>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreate(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createButtonText}>New Group</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <UserSearch onSelect={handleUserSelect} />
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
              size={56}
              color={TEXT_MUTED}
              style={{ opacity: 0.25 }}
            />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a new chat or create a group
            </Text>
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

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}

      {/* Action Sheet Modal */}
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
                  styles.actionAvatarRing,
                  (() => {
                    const c = getAvatarColor(
                      selectedConversation
                        ? rowColorKey(selectedConversation)
                        : ''
                    );
                    return { backgroundColor: c + '22', borderColor: c + '55' };
                  })(),
                ]}
              >
                <View
                  style={[
                    styles.actionAvatar,
                    {
                      backgroundColor: getAvatarColor(
                        selectedConversation
                          ? rowColorKey(selectedConversation)
                          : ''
                      ),
                    },
                  ]}
                >
                  <Text style={styles.actionAvatarText}>
                    {getInitials(selectedConversation?.title || '?')}
                  </Text>
                </View>
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
                <ActivityIndicator size="small" color="#EF6B6B" />
              ) : (
                <Ionicons
                  name={isSelectedGroup ? 'exit-outline' : 'trash-outline'}
                  size={21}
                  color="#EF6B6B"
                />
              )}
              <Text style={[styles.actionOptionText, { color: '#EF6B6B' }]}>
                {isSelectedGroup ? 'Leave Group' : 'Delete Conversation'}
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
    </View>
  );
}

// ============================================
// CREATE GROUP MODAL — fixed footer visibility
// ============================================

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const addMember = (member: any) => {
    if (!members.find((existingMember) => existingMember.id === member.id)) {
      setMembers((currentMembers) => [...currentMembers, member]);
    }
  };

  const removeMember = (id: string) =>
    setMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== id)
    );

  const createGroup = async () => {
    if (!user || !name.trim() || members.length === 0) return;

    setCreating(true);
    setError(null);

    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({ name: name.trim(), creator_id: user.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const memberRows = [
        { group_id: group.id, user_id: user.id, role: 'admin' },
        ...members.map((member) => ({
          group_id: group.id,
          user_id: member.id,
          role: 'member',
        })),
      ];

      const { error: memberError } = await supabase
        .from('group_members')
        .insert(memberRows);

      if (memberError) throw memberError;

      const receiptRows = [
        {
          group_id: group.id,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        ...members.map((member) => ({
          group_id: group.id,
          user_id: member.id,
          last_read_at: '1970-01-01T00:00:00Z',
        })),
      ];

      await supabase
        .from('group_read_receipts')
        .upsert(receiptRows, { onConflict: 'group_id,user_id' });

      onClose();
      router.push({
        pathname: '/chat/GroupChat',
        params: { groupId: String(group.id) },
      } as any);
    } catch (err) {
      console.error('Create group error:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = name.trim().length > 0 && members.length > 0 && !creating;

  const listHeader = (
    <View style={styles.createBodyContent}>
      <Text style={styles.createLabel}>GROUP NAME</Text>
      <View style={styles.createInputRow}>
        <Ionicons
          name="people-outline"
          size={17}
          color={TEXT_MUTED}
          style={styles.createInputIcon}
        />
        <TextInput
          placeholder="e.g. Design Team"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={name}
          onChangeText={setName}
          maxLength={50}
          style={styles.createInput}
          returnKeyType="done"
        />
      </View>

      <View style={styles.createSection}>
        <Text style={styles.createLabel}>ADD MEMBERS</Text>
        <UserSearch onSelect={addMember} />
      </View>

      {members.length > 0 && (
        <View style={styles.createSection}>
          <SelectedMembers members={members} onRemove={removeMember} />
        </View>
      )}

      {error && (
        <View style={styles.createErrorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#EF6B6B" />
          <Text style={styles.createErrorText}>{error}</Text>
        </View>
      )}

      <View style={{ height: 4 }} />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.createBackdrop}>
        {/* Tap outside to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.createKeyboardWrap}
          pointerEvents="box-none"
        >
          <View style={styles.createCard}>
            {/* Fixed header */}
            <View style={styles.createHeader}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.createHeaderBtn}
                hitSlop={6}
              >
                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.createTitle}>New Group</Text>
              <View style={styles.createHeaderBtn} />
            </View>

            {/* Scrollable body */}
            <FlatList
              data={[]}
              keyExtractor={() => 'x'}
              renderItem={null as any}
              ListHeaderComponent={listHeader}
              style={styles.createBody}
              contentContainerStyle={styles.createBodyScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />

            {/* Fixed footer — always visible, respects safe area */}
            <View
              style={[
                styles.createFooter,
                { paddingBottom: Math.max(insets.bottom, 14) },
              ]}
            >
              <TouchableOpacity
                onPress={onClose}
                style={[styles.createFooterBtn, styles.createFooterCancel]}
                disabled={creating}
                activeOpacity={0.8}
              >
                <Text style={styles.createFooterCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={createGroup}
                style={[
                  styles.createFooterBtn,
                  styles.createFooterPrimary,
                  !canCreate && styles.createFooterPrimaryDisabled,
                ]}
                disabled={!canCreate}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={canCreate ? '#fff' : 'rgba(255,255,255,0.4)'}
                    />
                    <Text
                      style={[
                        styles.createFooterPrimaryText,
                        !canCreate && styles.createFooterPrimaryTextDisabled,
                      ]}
                    >
                      Create
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13.5, color: TEXT_MUTED },

  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 4,
    backgroundColor: BG_PANEL,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  hint: { fontSize: 12.5, color: TEXT_MUTED, opacity: 0.7 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT_GOLD,
  },
  createButtonText: { fontWeight: '700', fontSize: 13, color: '#fff' },

  searchWrapper: { paddingHorizontal: 16, marginBottom: 6 },

  listContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 100 },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
    marginVertical: 3,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  conversationItemUnread: {
    backgroundColor: 'rgba(201,169,110,0.10)',
    borderColor: 'rgba(201,169,110,0.28)',
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80',
    borderWidth: 2.5,
    borderColor: BG_PANEL,
  },
  groupBadgeSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG_PANEL,
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
    fontSize: 15.5,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  conversationTitleUnread: { fontWeight: '700' },
  conversationTime: {
    fontSize: 11,
    color: TEXT_MUTED,
    opacity: 0.6,
    fontWeight: '500',
  },
  conversationTimeUnread: {
    color: ACCENT_GOLD,
    opacity: 1,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationPreview: {
    flex: 1,
    fontSize: 13.5,
    color: TEXT_MUTED,
    opacity: 0.85,
  },
  conversationPreviewUnread: {
    color: 'rgba(255,255,255,0.85)',
    opacity: 1,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF6B6B',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 8,
  },
  emptySubtext: { fontSize: 13, color: TEXT_MUTED, opacity: 0.6 },

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239,107,107,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,107,107,0.25)',
  },
  errorText: { color: '#EF6B6B', fontSize: 12.5, textAlign: 'center' },

  // ─────────────────────────────────────────────────────────────
  // CREATE GROUP MODAL
  // ─────────────────────────────────────────────────────────────
  createBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 60,
  },
  createKeyboardWrap: {
    width: '100%',
    maxHeight: '100%',
    justifyContent: 'flex-end',
  },
  createCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: BG_CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },

  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  createHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },

  createBody: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 140,
  },
  createBodyScrollContent: {
    flexGrow: 0,
  },
  createBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },

  createFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: BG_CARD,
  },
  createFooterBtn: {
    minWidth: 100,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  createFooterCancel: {
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  createFooterCancelText: {
    color: TEXT_MUTED,
    fontWeight: '600',
    fontSize: 13.5,
  },
  createFooterPrimary: {
    backgroundColor: ACCENT_GOLD,
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  createFooterPrimaryDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  createFooterPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  createFooterPrimaryTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },

  createLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: TEXT_MUTED,
    opacity: 0.75,
    marginBottom: 8,
  },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_SUBTLE,
    paddingLeft: 40,
    paddingRight: 14,
  },
  createInputIcon: {
    position: 'absolute',
    left: 14,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },

  createSection: {
    marginTop: 22,
  },

  createErrorBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239,107,107,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,107,107,0.25)',
  },
  createErrorText: {
    color: '#EF6B6B',
    fontSize: 12.5,
    flex: 1,
  },

  // Action sheet
  actionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: BG_CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  actionAvatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 3,
  },
  actionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAvatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionHeaderInfo: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    color: TEXT_MUTED,
    opacity: 0.7,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  actionOptionText: { fontSize: 15, fontWeight: '600' },
  actionCancel: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});