// MessageInput.tsx - Compact version
import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_GOLD, BG_PANEL, TEXT_PRIMARY } from '../../theme/designTokens';

export default function MessageInput({ onSend, allowSend = true }: { onSend: (t: string) => void; allowSend?: boolean }) {
  const [text, setText] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const send = () => {
    if (!text.trim()) return;
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
      }),
    ]).start();
    
    onSend(text.trim());
    setText('');
  };

  const isTextEmpty = !text.trim();

  return (
    <View style={[styles.wrap, { backgroundColor: BG_PANEL }]}>
      <View style={styles.inputContainer}>
        <TextInput 
          value={text} 
          onChangeText={setText} 
          placeholder={allowSend ? 'Type a message...' : 'Sign in to chat'}
          placeholderTextColor="rgba(255,255,255,0.25)"
          editable={allowSend} 
          style={[styles.input, { color: TEXT_PRIMARY }]}
          multiline
          maxLength={1000}
        />
        {!isTextEmpty && (
          <TouchableOpacity onPress={() => setText('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        )}
      </View>
      
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          onPress={send} 
          style={[
            styles.btn, 
            { backgroundColor: isTextEmpty || !allowSend ? 'rgba(255,255,255,0.06)' : ACCENT_GOLD },
            !allowSend && styles.disabled
          ]} 
          disabled={isTextEmpty || !allowSend}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="send" 
            size={16} 
            color={isTextEmpty || !allowSend ? 'rgba(255,255,255,0.2)' : '#fff'} 
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    flexDirection: 'row', 
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    gap: 6,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 4,
  },
  input: { 
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    minHeight: 36,
  },
  clearBtn: {
    padding: 6,
  },
  btn: { 
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: { 
    opacity: 0.5,
    shadowOpacity: 0,
  },
});