// MessageInput.tsx
import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_GOLD, TEXT_PRIMARY } from '../../theme/designTokens';

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
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
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
          placeholderTextColor="rgba(255,255,255,0.3)"
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
            <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.35)" />
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
                isTextEmpty || !allowSend ? 'rgba(255,255,255,0.07)' : ACCENT_GOLD,
            },
            (isTextEmpty || !allowSend) && styles.disabled,
          ]}
          disabled={isTextEmpty || !allowSend}
          activeOpacity={0.85}
        >
          <Ionicons
            name="send"
            size={16}
            color={isTextEmpty || !allowSend ? 'rgba(255,255,255,0.3)' : '#fff'}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 4,
    paddingRight: 6,
    minHeight: 40,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14.5,
    lineHeight: 19,
    maxHeight: 100,
    minHeight: 38,
  },
  clearBtn: { padding: 4 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: { opacity: 0.55 },
});