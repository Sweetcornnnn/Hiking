// ConversationList.tsx - Final clean version
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BG_PANEL, SPACING, TEXT_PRIMARY, TEXT_MUTED } from '../../theme/designTokens';

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
        { id: '1', title: 'Sarah Johnson', preview: 'Hey! How are you doing?', type: 'private', time: '2 min ago', unread: 3 },
        { id: '2', title: 'Design Team', preview: 'New project updates available', type: 'group', time: '1 hour ago' },
        { id: '3', title: 'Mike Chen', preview: '👍 Sounds good!', type: 'private', time: '3 hours ago' },
        { id: '4', title: 'Product Squad', preview: 'Meeting at 3pm tomorrow', type: 'group', time: 'Yesterday', unread: 5 },
        { id: '5', title: 'Emily Davis', preview: 'Can you review this?', type: 'private', time: '2 days ago' },
        { id: '6', title: 'Marketing Team', preview: 'Q3 campaign planning', type: 'group', time: '2 days ago', unread: 2 },
        { id: '7', title: 'Alex Rivera', preview: 'Thanks for your help!', type: 'private', time: '3 days ago' },
        { id: '8', title: 'Dev Squad', preview: 'Sprint review tomorrow', type: 'group', time: '4 days ago' },
        { id: '9', title: 'Jessica Kim', preview: 'Great meeting today', type: 'private', time: '5 days ago' },
        { id: '10', title: 'HR Team', preview: 'New policy updates', type: 'group', time: '1 week ago' },
      ];
      
      if (mounted) setConvos(mockData);
    })();
    return () => { mounted = false; };
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C94', '#FF9FF3', '#54A0FF', '#5F27CD'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  if (convos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={TEXT_MUTED} style={{ opacity: 0.3 }} />
        <Text style={[styles.emptyText, { color: TEXT_MUTED }]}>No conversations yet</Text>
        <Text style={[styles.emptySubtext, { color: TEXT_MUTED }]}>Start a new chat or create a group</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Conversation }) => {
    return (
      <View style={styles.rowWrapper}>
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: getRandomColor(String(item.id)) }]}>
            <Text style={styles.avatarText}>{getInitials(item.title)}</Text>
          </View>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.name, { color: TEXT_PRIMARY }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.time, { color: TEXT_MUTED }]}>{item.time}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={[styles.preview, { color: TEXT_MUTED }]} numberOfLines={1}>
                {item.preview}
              </Text>
              {item.unread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
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
    padding: SPACING.gap,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.6,
  },
  emptySubtext: {
    fontSize: 13,
    opacity: 0.4,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  rowWrapper: {
    opacity: 1,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 19,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 11,
    opacity: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontSize: 14,
    opacity: 0.6,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});