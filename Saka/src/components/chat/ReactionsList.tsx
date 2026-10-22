// components/chat/ReactionsList.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CHAT_PANEL,
  CHAT_BORDER,
  CHAT_RADIUS_MODAL,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../theme/designTokens';
import { REACTION_EMOJI, ReactionType } from './MessageBubble';
import { ReactionSummary } from '../../utils/reactions';
import { getAvatarColor, getInitials } from '../../utils/colors';

type Row = {
  key: string;
  userId: string;
  name: string;
  reaction: ReactionType;
};

export default function ReactionsList({
  visible,
  onClose,
  summaries,
  currentUserId,
}: {
  visible: boolean;
  onClose: () => void;
  summaries: ReactionSummary[];
  currentUserId: string | null | undefined;
}) {
  // Flat list of reactors, one row per person.
  const rows: Row[] = [];
  for (const s of summaries) {
    for (const r of s.users) {
      rows.push({
        key: `${s.emoji}:${r.user_id}`,
        userId: r.user_id,
        name: r.profiles?.full_name || r.profiles?.username || 'Anonymous',
        reaction: s.emoji,
      });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Reactions{rows.length ? ` · ${rows.length}` : ''}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={14} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No reactions yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.userId === currentUserId;
              return (
                <View style={styles.row}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: getAvatarColor(item.userId) },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {getInitials(item.name)}
                    </Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {isMe ? 'You' : item.name}
                  </Text>
                  <Text style={styles.emoji}>
                    {REACTION_EMOJI[item.reaction]}
                  </Text>
                </View>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: CHAT_PANEL,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  title: { fontSize: 13, fontWeight: '800', color: TEXT_PRIMARY },
  closeBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 11, color: TEXT_MUTED, opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name: { flex: 1, fontSize: 12.5, fontWeight: '600', color: TEXT_PRIMARY },
  emoji: { fontSize: 18 },
});