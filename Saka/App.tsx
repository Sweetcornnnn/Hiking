import './global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/store/authStore';

export default function App() {
  const { loadSession, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadSession().catch((error) => {
      console.warn('[App] loadSession failed', error);
    });
  }, []);

  if (isLoading) {
    return (
      <>
        <StatusBar hidden={true} />
        <Stack>
          <Stack.Screen name="Intro" options={{ headerShown: false }} />
        </Stack>
      </>
    );
  }

  return (
    <>
      <StatusBar hidden={true} />
      <Stack>
        <Stack.Screen
          name={isAuthenticated ? 'Home' : 'Auth'}
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}