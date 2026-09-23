// app/chat/_layout.tsx
import { Stack } from 'expo-router';
import { usePresence } from '../../src/hooks/usePresence'; 

export default function ChatLayout() {
  usePresence();
  return (
    <Stack>
      <Stack.Screen name="Chat" options={{ headerShown: false }} />
      <Stack.Screen name="Conversation" options={{ headerShown: false }} />
      <Stack.Screen name="GroupChat" options={{ headerShown: false }} />
    </Stack>
  );
}