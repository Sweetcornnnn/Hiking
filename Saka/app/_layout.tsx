import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar hidden={true} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#F5E6D3' } }}>
        <Stack.Screen 
          name="intro-final" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="screens/login" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="screens/signup" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(drawer)" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </>
  );
}
