// components/chat/MessageInput.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_RADIUS_BTN,
  CHAT_FS_BODY,
} from '../../theme/designTokens';

export default function MessageInput({
  onSend,
  allowSend = true,
}: {
  onSend: (t: string) => void;
  allowSend?: boolean;
}) {
  const [text, setText] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const send = () => {
    if (!text.trim()) return;
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, speed: 40 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();

    onSend(text.trim());
    setText('');
  };

  const isTextEmpty = !text.trim();

  return (
    <View style={styles.wrap}>
      <View style={styles.inputContainer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={allowSend ? 'Type a message…' : 'Sign in to chat'}
          placeholderTextColor="rgba(255,255,255,0.28)"
          editable={allowSend}
          style={[styles.input, { color: TEXT_PRIMARY }]}
          multiline
          maxLength={1000}
        />
        {!isTextEmpty && (
          <TouchableOpacity
            onPress={() => setText('')}
            style={styles.clearBtn}
            hitSlop={6}
          >
            <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={send}
          style={[
            styles.btn,
            {
              backgroundColor:
                isTextEmpty || !allowSend ? 'rgba(255,255,255,0.06)' : ACCENT_GOLD,
            },
          ]}
          disabled={isTextEmpty || !allowSend}
          activeOpacity={0.85}
        >
          <Ionicons
            name="send"
            size={14}
            color={isTextEmpty || !allowSend ? 'rgba(255,255,255,0.3)' : CHAT_BG}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingLeft: 4,
    paddingRight: 6,
    minHeight: 36,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: CHAT_FS_BODY,
    lineHeight: 16,
    maxHeight: 96,
    minHeight: 34,
  },
  clearBtn: { padding: 4 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: CHAT_RADIUS_BTN,
    justifyContent: 'center',
    alignItems: 'center',
  },
});