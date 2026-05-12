import './global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <>
      <StatusBar hidden={true} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
