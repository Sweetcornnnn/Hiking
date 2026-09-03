import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          try {
            const { data, error } = await supabase.auth.getSessionFromUrl(initialUrl);
            if (error) {
              console.warn('[Auth] getSessionFromUrl failed:', error.message);
            } else if (data?.session) {
              console.log('[Auth] Session recovered from deep link');
            }
          } catch (deepLinkError) {
            console.warn('[Auth] Deep link handling failed:', deepLinkError);
          }
        }
      } catch (error) {
        console.warn('[Auth] Initial URL read failed:', error);
      } finally {
        router.replace('/Login');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E1520' }}>
      <ActivityIndicator size="large" color="#C9A96E" />
    </View>
  );
}
