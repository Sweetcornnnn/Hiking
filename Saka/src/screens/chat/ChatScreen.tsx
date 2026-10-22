// screens/ChatScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../theme/designTokens';
import ChatTabs from '../../components/chat/ChatTabs';
import ChatSidebar, { ChatSidebarTab } from '../../components/chat/ChatSidebar';
import OnlineUsersList from '../../components/chat/OnlineUsersList';
import CreateGroupModal from '../../components/chat/CreateGroupModal';
import WorldChatScreen from './WorldChatScreen';
import PrivateChatScreen from './PrivateChatScreen';

export default function ChatScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [active, setActive] = useState<ChatSidebarTab>('world');
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCreateGroup = useCallback(() => {
    setShowCreateGroup(true);
  }, []);

  const handleSettings = useCallback(() => {
    try {
      router.push('/settings' as any);
    } catch {}
  }, [router]);

  const handleOnlineUserPress = useCallback(
    (userId: string) => {
      router.push({
        pathname: '/chat/Conversation',
        params: { userId },
      } as any);
    },
    [router]
  );

  // ── Landscape: three-pane shell ──
  if (isLandscape) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.shell}>
          <ChatSidebar
            active={active}
            onChange={setActive}
            onCreateGroup={handleCreateGroup}
            onSettings={handleSettings}
            onBack={handleBack}
          />

          <View style={styles.center}>
            {active === 'world' ? (
              <WorldChatScreen embedded />
            ) : (
              <PrivateChatScreen
                embedded
                onOpenCreateGroup={handleCreateGroup}
              />
            )}
          </View>

          <OnlineUsersList onSelectUser={handleOnlineUserPress} />
        </View>

        {showCreateGroup && (
          <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
        )}
      </SafeAreaView>
    );
  }

  // ── Portrait: original stacked layout with tabs ──
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={8}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.title} numberOfLines={1}>
              SAKA Chat
            </Text>
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
          {active === 'private' && (
            <PrivateChatScreen onOpenCreateGroup={handleCreateGroup} />
          )}
        </View>
      </SafeAreaView>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_BG },
  safeArea: { flex: 1, backgroundColor: CHAT_BG },

  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: CHAT_BG,
  },
  center: { flex: 1, minWidth: 0, backgroundColor: CHAT_BG },

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