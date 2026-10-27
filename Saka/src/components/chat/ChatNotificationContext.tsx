// components/chat/ChatNotificationContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChatNotificationPayload } from './AnimatedMessageIcon';

type Listener = (payload: ChatNotificationPayload) => void;

type Ctx = {
  subscribe: (fn: Listener) => () => void;
  emit: (payload: ChatNotificationPayload) => void;
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
};

const ChatNotificationContext = createContext<Ctx | null>(null);

export function ChatNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const listenersRef = useRef<Set<Listener>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const emit = useCallback((payload: ChatNotificationPayload) => {
    listenersRef.current.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn('[chat-notify] listener threw:', err);
      }
    });
  }, []);

  const incrementUnread = useCallback(() => {
    setUnreadCount((c) => c + 1);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({ subscribe, emit, unreadCount, incrementUnread, clearUnread }),
    [subscribe, emit, unreadCount, incrementUnread, clearUnread]
  );

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  );
}

export function useChatNotifications(): Ctx {
  const ctx = useContext(ChatNotificationContext);
  if (!ctx) {
    throw new Error(
      'useChatNotifications must be used within a ChatNotificationProvider'
    );
  }
  return ctx;
}