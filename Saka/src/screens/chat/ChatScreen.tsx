// screens/ChatScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
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
  ACCENT_GOLD,
} from '../../theme/designTokens';
import ChatTabs from '../../components/chat/ChatTabs';
import ChatSidebar, { ChatSidebarTab } from '../../components/chat/ChatSidebar';
import CreateGroupModal from '../../components/chat/CreateGroupModal';
import WorldChatScreen from './WorldChatScreen';
import PrivateChatScreen from './PrivateChatScreen';
import ConversationScreen from './ConversationScreen';
import GroupChatScreen from './GroupChatScreen';

const LIST_NARROW_WIDTH = 280;
const LIST_WIDE_WIDTH = 400;

export default function ChatScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [active, setActive] = useState<ChatSidebarTab>('world');
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Split-view state for landscape
  const [activeConversation, setActiveConversation] = useState<{
    type: 'private' | 'group';
    id: string;
  } | null>(null);

  // Animation value for the list width (0 = wide, 1 = narrow)
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(listAnim, {
      toValue: activeConversation ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // Width cannot use native driver
    }).start();
  }, [activeConversation]);

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
      setActive('private');
      setActiveConversation({ type: 'private', id: userId });
    },
    []
  );

  // Interpolate width based on animation value
  const listWidth = listAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIST_WIDE_WIDTH, LIST_NARROW_WIDTH],
  });

  // ── Landscape: split layout (Sidebar + Main Content) ──
  if (isLandscape) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.shell}>
          <ChatSidebar
            active={active}
            onChange={(tab) => {
              setActive(tab);
              setActiveConversation(null);
            }}
            onCreateGroup={handleCreateGroup}
            onSettings={handleSettings}
            onBack={handleBack}
          />

          <View style={styles.center}>
            {active === 'world' ? (
              <WorldChatScreen embedded onSelectUser={handleOnlineUserPress} />
            ) : (
              <View style={styles.splitPane}>
                {/* Left: Conversation List (Animated Width) */}
                <Animated.View
                  style={[
                    styles.listPane,
                    { width: listWidth },
                    activeConversation && styles.listPaneBorder,
                  ]}
                >
                  <PrivateChatScreen
                    embedded
                    maxWidth={LIST_WIDE_WIDTH}
                    onOpenCreateGroup={handleCreateGroup}
                    onSelectConversation={setActiveConversation}
                    activeConversationId={activeConversation?.id}
                  />
                </Animated.View>

                {/* Right: Active Chat OR Welcome State */}
                <View style={styles.chatPane}>
                  {activeConversation ? (
                    activeConversation.type === 'private' ? (
                      <ConversationScreen
                        embedded
                        overrideUserId={activeConversation.id}
                        onClose={() => setActiveConversation(null)}
                      />
                    ) : (
                      <GroupChatScreen
                        embedded
                        overrideGroupId={activeConversation.id}
                        onClose={() => setActiveConversation(null)}
                      />
                    )
                  ) : (
                    // ── WELCOME EMPTY STATE ──
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIconWrap}>
                        <Ionicons
                          name="chatbubbles-outline"
                          size={48}
                          color={ACCENT_GOLD}
                        />
                      </View>
                      <Text style={styles.emptyTitle}>Your Messages</Text>
                      <Text style={styles.emptySubtitle}>
                        Select a conversation from the list to start chatting,
                        or search for someone new.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
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
  
  splitPane: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    height: '100%',
  },
  listPaneBorder: {
    borderRightWidth: 1,
    borderRightColor: CHAT_BORDER,
  },
  chatPane: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CHAT_BG,
  },

  // ── Empty State Styles ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: CHAT_BG,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(201,169,110,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },

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