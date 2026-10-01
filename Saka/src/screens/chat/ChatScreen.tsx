// screens/ChatScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../theme/designTokens';
import ChatTabs from '../../components/chat/ChatTabs';
import WorldChatScreen from './WorldChatScreen';
import PrivateChatScreen from './PrivateChatScreen';

export default function ChatScreen() {
  const router = useRouter();
  const [active, setActive] = useState<'world' | 'private'>('world');

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header — same recipe as Discoveries / FeaturedSpecies */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.title} numberOfLines={1}>SAKA Chat</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.actionBtn} hitSlop={8} activeOpacity={0.85}>
            <Ionicons name="ellipsis-vertical" size={16} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>

        <ChatTabs active={active} onChange={setActive} />

        <View style={styles.content}>
          {active === 'world' && <WorldChatScreen />}
          {active === 'private' && <PrivateChatScreen />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_BG },
  safeArea: { flex: 1, backgroundColor: CHAT_BG },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CHAT_ONLINE,
  },
  statusText: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  content: { flex: 1, backgroundColor: 'transparent' },
});