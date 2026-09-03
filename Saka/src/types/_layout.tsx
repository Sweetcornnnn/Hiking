import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar hidden={true} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#F5E6D3' } }}>
        <Stack.Screen 
          name="Intro" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Login" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Signup" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(drawer)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Location" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </>
  );
}
