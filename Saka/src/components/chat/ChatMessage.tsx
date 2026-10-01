// components/chat/ChatMessage.tsx
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
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
  const { width: windowWidth } = useWindowDimensions();

  const profile = message.profiles || message.users || {};
  const name = profile.full_name || profile.username || 'Anonymous';

  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const bubbleWidth = Math.min(
    Math.max(58, String(message.content || '').length * 8.5 + 32),
    windowWidth * 0.8
  );

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

      {/* ✅ Single column wrapper so bubble + meta share alignment */}
      <View
        style={[
          styles.column,
          isMe ? styles.columnMe : styles.columnOther,
          { width: bubbleWidth },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            { width: '100%' },
          ]}
        >
          <Text
            style={[styles.text, { color: isMe ? '#fff' : TEXT_PRIMARY }]}
          >
            {message.content}
          </Text>
        </View>

        <View
          style={[
            styles.meta,
            isMe ? styles.metaMe : styles.metaOther,
          ]}
        >
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    paddingHorizontal: 2,
    alignSelf: 'stretch',
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

  column: {
    flexShrink: 0,
  },
  columnMe: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },

  bubble: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    alignSelf: 'stretch',
  },
  bubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 6,
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: 0.1,
    flexShrink: 1,
    // ✅ Prevent clipping on Android
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  meta: {
    flexDirection: 'row',
    marginTop: 3,
  },
  metaMe: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  metaOther: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  time: {
    fontSize: 10,
    opacity: 0.7,
  },
});