// components/chat/ConversationList.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BORDER,
  CHAT_SUBTLE,
  CHAT_BG,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

type Conversation = {
  id: string | number;
  title: string;
  preview: string;
  type: 'private' | 'group';
  time?: string;
  unread?: number;
};

export default function ConversationList({
  scrollY,
  contentTopInset = 8,
  header,
}: {
  scrollY?: Animated.Value;
  contentTopInset?: number;
  header?: React.ReactElement;
}) {
  const [convos, setConvos] = useState<Conversation[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const mockData: Conversation[] = [
        { id: '1', title: 'Sarah Johnson', preview: 'Hey! How are you doing?', type: 'private', time: '2m', unread: 3 },
        { id: '2', title: 'Design Team', preview: 'New project updates available', type: 'group', time: '1h' },
        { id: '3', title: 'Mike Chen', preview: '👍 Sounds good!', type: 'private', time: '3h' },
        { id: '4', title: 'Product Squad', preview: 'Meeting at 3pm tomorrow', type: 'group', time: 'Yest.', unread: 5 },
        { id: '5', title: 'Emily Davis', preview: 'Can you review this?', type: 'private', time: '2d' },
      ];
      if (mounted) setConvos(mockData);
    })();
    return () => { mounted = false; };
  }, []);

  if (convos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={32} color={TEXT_MUTED} style={{ opacity: 0.35 }} />
        <Text style={styles.emptyText}>No conversations yet</Text>
        <Text style={styles.emptySubtext}>Start a new chat or create a group</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unread || 0) > 0;
    const color = getAvatarColor(String(item.id));

    return (
      <TouchableOpacity
        style={[styles.row, hasUnread && styles.rowUnread]}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{getInitials(item.title)}</Text>
          {item.type === 'group' && (
            <View style={styles.groupBadge}>
              <Ionicons name="people" size={8} color={CHAT_BG} />
            </View>
          )}
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text
              style={[styles.name, hasUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {item.time}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
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

  return (
    <Animated.FlatList
      data={convos}
      keyExtractor={(i) => String(i.id)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { paddingTop: contentTopInset }]}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY || new Animated.Value(0) } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    opacity: 0.7,
    marginTop: 6,
  },
  emptySubtext: {
    fontSize: 11,
    color: TEXT_MUTED,
    opacity: 0.5,
  },
  listContent: { paddingTop: 8, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowUnread: {
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderColor: 'rgba(201,169,110,0.22)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  groupBadge: {
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
  content: { flex: 1, gap: 3, minWidth: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 12.5,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  nameUnread: { fontWeight: '700' },
  time: {
    fontSize: 10,
    color: TEXT_MUTED,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  timeUnread: { color: ACCENT_GOLD, opacity: 1, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    fontSize: 11,
    color: TEXT_MUTED,
    opacity: 0.8,
    flex: 1,
  },
  previewUnread: {
    color: 'rgba(255,255,255,0.8)',
    opacity: 1,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_GOLD,
  },
  unreadText: {
    color: CHAT_BG,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});