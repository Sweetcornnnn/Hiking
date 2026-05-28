import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLandscapeOnly } from '../src/hooks/useLandscapeOnly';

export default function RootLayout() {
  useLandscapeOnly();
  return (
    <>
      <StatusBar hidden={true} />
      <Stack screenOptions={{ 
        contentStyle: { backgroundColor: '#F5E6D3' },
        orientation: 'landscape'
      }}>
        <Stack.Screen 
          name="intro" 
          options={{ 
            headerShown: false,
            orientation: 'landscape'
          }} 
        />
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            orientation: 'landscape'
          }} 
        />
        <Stack.Screen 
          name="signup" 
          options={{ 
            headerShown: false,
            orientation: 'landscape'
          }} 
        />
        <Stack.Screen 
          name="forgot" 
          options={{ 
            headerShown: false,
            orientation: 'landscape'
          }} 
        />
        <Stack.Screen 
          name="drawer" 
          options={{ 
            headerShown: false,
            orientation: 'landscape'
          }} 
        />
        <Stack.Screen
          name="MountainTop"
          options={{
            headerShown: false,
            orientation: 'landscape',
          }}
        />
        <Stack.Screen
          name="viewpoint"
          options={{
            headerShown: false,
            orientation: 'landscape',
          }}
        />
        <Stack.Screen
          name="weather"
          options={{
            headerShown: false,
            orientation: 'landscape',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            orientation: 'landscape',
          }}
        />
      </Stack>
    </>
  );
}
