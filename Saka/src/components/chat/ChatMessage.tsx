// ChatMessage.tsx - Cleaner bubble design
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ACCENT_GOLD, BG_PANEL, TEXT_PRIMARY, TEXT_MUTED, SPACING } from '../../theme/designTokens';

export default function ChatMessage({ message, currentUserId }: { message: any; currentUserId?: string | null }) {
  const isMe = currentUserId && message.user_id === currentUserId;
  const name = message.profiles?.full_name || message.profiles?.username || 'Anonymous';
  const time = message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <View style={[styles.row, isMe ? styles.me : styles.other]}>
      {!isMe && (
        <Text style={[styles.name, { color: TEXT_MUTED }]} numberOfLines={1}>
          {name}
        </Text>
      )}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        <Text style={[styles.text, { color: isMe ? '#fff' : TEXT_PRIMARY }]}>
          {message.content}
        </Text>
        <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.6)' : TEXT_MUTED }]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { 
    marginVertical: 2,
    marginHorizontal: 2,
  },
  me: { alignItems: 'flex-end' },
  other: { alignItems: 'flex-start' },
  name: { 
    fontSize: 10, 
    marginBottom: 2,
    marginLeft: 4,
    fontWeight: '500',
    opacity: 0.5,
  },
  bubble: { 
    maxWidth: '82%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  bubbleMe: { 
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 4,
  },
  bubbleOther: { 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  text: { 
    fontSize: 14,
    lineHeight: 18,
  },
  time: { 
    fontSize: 9, 
    marginTop: 4,
    alignSelf: 'flex-end',
    opacity: 0.5,
  },
});