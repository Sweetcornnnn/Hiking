// WorldChatScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ChatMessage from '../../components/chat/ChatMessage';
import MessageInput from '../../components/chat/MessageInput';
import { BG_PANEL, TEXT_PRIMARY, TEXT_MUTED, ACCENT_GOLD } from '../../theme/designTokens';
import { Ionicons } from '@expo/vector-icons';

export default function WorldChatScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const listRef = useRef<FlatList>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, user_id, content, created_at, users:profiles(name,email)')
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        console.warn('WorldChat load error', error);
      } else if (mounted) {
        setMessages(data || []);
        setOnlineCount(Math.floor(Math.random() * 50) + 20);
      }
      setLoading(false);
    };
    load();

    const channel = supabase.channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((v) => [...v, payload.new]);
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true } as any), 50);
      })
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, []);

  const handleSend = async (text: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('chat_messages').insert({ user_id: user.id, content: text });
      if (error) throw error;
    } catch (e) {
      console.warn('send failed', e);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: BG_PANEL }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: TEXT_PRIMARY }]}>World Chat</Text>
        </View>
        <View style={styles.onlineStatus}>
          <View style={styles.onlineDot} />
          <Text style={[styles.onlineText, { color: TEXT_MUTED }]}>{onlineCount} online</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT_GOLD} />
          <Text style={[styles.loadingText, { color: TEXT_MUTED }]}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={TEXT_MUTED} />
          </View>
          <Text style={[styles.emptyText, { color: TEXT_MUTED }]}>No messages yet</Text>
          <Text style={[styles.emptySubtext, { color: TEXT_MUTED }]}>Be the first to say hello! 👋</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ChatMessage message={item} currentUserId={user?.id} />
          )}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.inputWrapper}>
        <MessageInput 
          onSend={handleSend} 
          allowSend={!!user} 
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  onlineText: {
    fontSize: 12,
    opacity: 0.7,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.6,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.4,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
});