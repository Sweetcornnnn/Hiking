// hooks/usePresence.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export function usePresence() {
  const user = useAuthStore((state) => state.user);
  const appStateRef = useRef(AppState.currentState);
  const heartbeatRef = useRef<any>(null);

  // ============================================
  // MARK ONLINE
  // ============================================
  const goOnline = async () => {
    if (!user?.id) return;
    try {
      await supabase.rpc('mark_user_online', { user_id_param: user.id });
      console.log('🟢 User marked online');
    } catch (err) {
      console.warn('Failed to mark online:', err);
    }
  };

  // ============================================
  // MARK OFFLINE
  // ============================================
  const goOffline = async () => {
    if (!user?.id) return;
    try {
      await supabase.rpc('mark_user_offline', { user_id_param: user.id });
      console.log('⚪ User marked offline');
    } catch (err) {
      console.warn('Failed to mark offline:', err);
    }
  };

  // ============================================
  // HEARTBEAT — Update last_seen every 30s
  // ============================================
  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (!user?.id) return;
      try {
        await supabase
          .from('profiles')
          .update({
            status: 'online',
            last_seen: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (err) {
        console.warn('Heartbeat failed:', err);
      }
    }, 30000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  // ============================================
  // EFFECT: Set up presence tracking
  // ============================================
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔌 Initializing presence for user:', user.id);

    // 1. Mark online when component mounts
    goOnline();
    startHeartbeat();

    // 2. Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === 'active' && prevState !== 'active') {
          console.log('📱 App came to foreground');
          goOnline();
          startHeartbeat();
        } else if (nextState === 'background' || nextState === 'inactive') {
          console.log('📱 App went to background');
          goOffline();
          stopHeartbeat();
        }
      }
    );

    // 3. Cleanup on unmount
    return () => {
      subscription.remove();
      stopHeartbeat();
    };
  }, [user?.id]);

  return { goOnline, goOffline };
}