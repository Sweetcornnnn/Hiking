import './global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { API_BASE_URL } from './src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  console.log('[App] API_BASE_URL =', API_BASE_URL);
  // Wrap global.fetch to log failing request URLs and options for debugging
  try {
    const originalFetch = (global as any).fetch;
    if (!originalFetch.__wrapped_for_logging) {
      const wrapped = async (input: any, init?: any) => {
        try {
          return await originalFetch(input, init);
        } catch (err) {
          console.error('[Network] Fetch failed for', input, init, err);
          throw err;
        }
      };
      (wrapped as any).__wrapped_for_logging = true;
      (global as any).fetch = wrapped;
    }
  } catch (e) {
    // ignore errors during patching
  }

  // Apply runtime API host override from AsyncStorage (key: API_HOST_OVERRIDE)
  (async () => {
    try {
      const host = await AsyncStorage.getItem('API_HOST_OVERRIDE');
      if (host) {
        // allow either full URL or host/IP
        const base = host.startsWith('http') ? host : `http://${host}:3000`;
        (global as any).__API_BASE__ = base;
        console.log('[App] runtime API override set to', base);
      }
    } catch (e) {
      // ignore
    }
  })();
  return (
    <>
      <StatusBar hidden={true} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
