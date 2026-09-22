// components/chat/ChatMessage.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ACCENT_GOLD, TEXT_PRIMARY, TEXT_MUTED } from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

export default function ChatMessage({
  message,
  currentUserId,
}: {
  message: any;
  currentUserId?: string | null;
}) {
  const isMe = currentUserId && message.user_id === currentUserId;

  const profile = message.profiles || message.users || {};
  const name = profile.full_name || profile.username || 'Anonymous';

  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View style={[styles.row, isMe ? styles.me : styles.other]}>
      {!isMe && (
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: getAvatarColor(message.user_id) },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
      )}

      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        <Text style={[styles.text, { color: isMe ? '#fff' : TEXT_PRIMARY }]}>
          {message.content}
        </Text>
        <Text
          style={[
            styles.time,
            { color: isMe ? 'rgba(255,255,255,0.72)' : TEXT_MUTED },
          ]}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    paddingHorizontal: 2,
  },
  me: { alignItems: 'flex-end' },
  other: { alignItems: 'flex-start' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    marginLeft: 2,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  name: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.1,
    maxWidth: 200,
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  text: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  time: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
    opacity: 0.7,
  },
});