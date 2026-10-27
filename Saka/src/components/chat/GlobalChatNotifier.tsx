// components/chat/GlobalChatNotifier.tsx
import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useChatNotifications } from './ChatNotificationContext';
import type { ChatNotificationPayload } from './AnimatedMessageIcon';

type GlobalChatNotifierProps = {
  onNotify?: (payload: ChatNotificationPayload) => void;
  trackUnread?: boolean;
};

function useRefProp<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export default function GlobalChatNotifier({
  onNotify,
  trackUnread = true,
}: GlobalChatNotifierProps) {
  const user = useAuthStore((state) => state.user);
  const { emit, incrementUnread } = useChatNotifications();

  const onNotifyRef = useRefProp(onNotify);
  const trackUnreadRef = useRefProp(trackUnread);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data: memberships, error: membershipsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .is('hidden_at', null);

      if (membershipsError) {
        console.error(
          '[chat-notifier] Failed to load group memberships:',
          membershipsError
        );
      }
      if (!isMounted) return;

      const groupIds = new Set(
        (memberships || []).map((member) => String(member.group_id))
      );

      const notify = async (
        type: ChatNotificationPayload['type'],
        id: string,
        senderId: string,
        content: string
      ) => {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', senderId)
          .maybeSingle();

        if (profileError) {
          console.error(
            '[chat-notifier] Failed to load sender profile:',
            profileError
          );
        }
        if (!isMounted) return;

        const payload: ChatNotificationPayload = {
          type,
          id,
          senderName: profile?.full_name || profile?.username || 'Someone',
          content,
        };

        emit(payload);
        if (trackUnreadRef.current) incrementUnread();
        onNotifyRef.current?.(payload);
      };

      channel = supabase
        .channel(`global-chat-notifier-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'private_messages',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const message = payload.new as {
              sender_id?: string;
              recipient_id?: string;
              content?: string;
            };
            if (!message.sender_id || message.sender_id === user.id) return;
            void notify(
              'private',
              message.sender_id,
              message.sender_id,
              message.content || ''
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_messages' },
          (payload) => {
            const message = payload.new as {
              group_id?: number | string;
              sender_id?: string;
              content?: string;
              type?: string;
            };
            if (
              !message.group_id ||
              !message.sender_id ||
              message.sender_id === user.id ||
              message.type === 'system' ||
              !groupIds.has(String(message.group_id))
            ) {
              return;
            }
            void notify(
              'group',
              String(message.group_id),
              message.sender_id,
              message.content || ''
            );
          }
        )
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(
              '[chat-notifier] Realtime subscription failed:',
              error || status
            );
          }
        });
    };

    void subscribe();

    return () => {
      isMounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user, emit, incrementUnread]);

  return null;
}