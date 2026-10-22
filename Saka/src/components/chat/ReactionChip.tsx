// components/chat/ReactionChip.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  CHAT_BG,
  CHAT_BORDER,
  ACCENT_GOLD,
  TEXT_PRIMARY,
} from '../../theme/designTokens';
import { REACTION_EMOJI } from './MessageBubble';
import { ReactionSummary } from '../../utils/reactions';

export default function ReactionChip({
  summaries,
  onPress,
  isMe,
}: {
  summaries: ReactionSummary[];
  onPress: () => void;
  isMe: boolean;
}) {
  if (summaries.length === 0) return null;

  // Show up to 2 distinct emoji, then the total count (matches the mock).
  const shown = summaries.slice(0, 2);
  const total = summaries.reduce((acc, s) => acc + s.count, 0);
  const anyMine = summaries.some((s) => s.mine);

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isMe ? styles.chipMe : styles.chipOther,
        anyMine && styles.chipMine,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={6}
    >
      <View style={styles.emojiRow}>
        {shown.map((s, i) => (
          <Text
            key={s.emoji}
            style={[styles.emoji, i > 0 && styles.emojiOverlap]}
          >
            {REACTION_EMOJI[s.emoji]}
          </Text>
        ))}
      </View>
      <Text style={styles.count}>{total}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    bottom: -10,
    minHeight: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: CHAT_BG,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  chipMe: { right: 4 },
  chipOther: { right: 4 },
  chipMine: {
    borderColor: ACCENT_GOLD,
    backgroundColor: 'rgba(201,169,110,0.12)',
  },
  emojiRow: { flexDirection: 'row' },
  emoji: { fontSize: 11, lineHeight: 13 },
  emojiOverlap: { marginLeft: -4 },
  count: {
    fontSize: 10.5,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    fontVariant: ['tabular-nums'],
  },
});