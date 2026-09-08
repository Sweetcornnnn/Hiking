// ChatScreen.tsx - Fixed with proper layout and transparent backgrounds
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BG_CARD, TEXT_PRIMARY, ACCENT_GOLD, BG_PANEL } from '../../theme/designTokens';
import ChatTabs from '../../components/chat/ChatTabs';
import WorldChatScreen from './WorldChatScreen';
import PrivateChatScreen from './PrivateChatScreen';

export default function ChatScreen() {
  const router = useRouter();
  const [active, setActive] = useState<'world' | 'private'>('world');

  return (
    <View style={[styles.container, { backgroundColor: BG_PANEL }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: TEXT_PRIMARY }]}>SAKA Chat</Text>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Text style={styles.headerActionText}>⋯</Text>
          </TouchableOpacity>
        </View>
        
        <ChatTabs active={active} onChange={setActive} />
        
        <View style={styles.contentContainer}>
          <View style={styles.content}>
            {active === 'world' && <WorldChatScreen />}
            {active === 'private' && <PrivateChatScreen />}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: BG_PANEL,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: BG_PANEL,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  backText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '300',
  },
  headerAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerActionText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: { 
    flex: 1,
    backgroundColor: 'transparent',
  },
});