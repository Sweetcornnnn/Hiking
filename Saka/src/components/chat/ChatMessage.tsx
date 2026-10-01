// components/chat/ChatMessage.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_RADIUS_BUBBLE,
  CHAT_FS_BODY,
  CHAT_FS_META,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

export default function ChatMessage({
  message,
  currentUserId,
  onAvatarPress,
}: {
  message: any;
  currentUserId?: string | null;
  onAvatarPress?: (userId: string) => void;
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
    Math.max(48, String(message.content || '').length * 7.2 + 24),
    windowWidth * 0.75
  );

  const handlePress = () => {
    if (onAvatarPress && message.user_id) onAvatarPress(message.user_id);
  };

  return (
    <View style={[styles.row, isMe ? styles.me : styles.other]}>
      {!isMe && (
        <TouchableOpacity
          style={styles.senderRow}
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={!onAvatarPress}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: getAvatarColor(message.user_id) },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.senderName} numberOfLines={1}>
            {name}
          </Text>
        </TouchableOpacity>
      )}

      <View
        style={[
          styles.column,
          isMe ? styles.columnMe : styles.columnOther,
          { maxWidth: bubbleWidth },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          disabled={!onAvatarPress}
        >
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isMe ? CHAT_BG : TEXT_PRIMARY },
                isMe && styles.textMe,
              ]}
            >
              {message.content}
            </Text>
          </View>
        </TouchableOpacity>

        <View
          style={[styles.meta, isMe ? styles.metaMe : styles.metaOther]}
        >
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 3, paddingHorizontal: 2, alignSelf: 'stretch' },
  me: { alignItems: 'flex-end' },
  other: { alignItems: 'flex-start' },

  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    marginLeft: 2,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  senderName: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.3,
    maxWidth: 180,
  },

  column: { flexShrink: 0 },
  columnMe: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },

  bubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: CHAT_RADIUS_BUBBLE,
    alignSelf: 'stretch',
  },
  bubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    backgroundColor: CHAT_SUBTLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: CHAT_FS_BODY,
    lineHeight: 17,
    letterSpacing: 0.1,
    flexShrink: 1,
    includeFontPadding: false,
  },
  textMe: { fontWeight: '600' },

  meta: { flexDirection: 'row', marginTop: 3 },
  metaMe: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  metaOther: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  time: {
    fontSize: CHAT_FS_META,
    color: TEXT_MUTED,
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
});