import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLandscapeOnly } from '../src/hooks/useLandscapeOnly';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

type LandscapeStackOptions = NativeStackNavigationOptions & {
  orientation?: 'portrait' | 'landscape';
};

const stackScreenOptions: LandscapeStackOptions = {
  contentStyle: { backgroundColor: '#F5E6D3' },
  orientation: 'landscape',
};

const screenOptionsNoHeader: LandscapeStackOptions = {
  headerShown: false,
  orientation: 'landscape',
};

export default function RootLayout() {
  useLandscapeOnly();
  return (
    <>
      <StatusBar hidden={true} />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="intro" options={screenOptionsNoHeader} />
        <Stack.Screen name="login" options={screenOptionsNoHeader} />
        <Stack.Screen name="signup" options={screenOptionsNoHeader} />
        <Stack.Screen name="forgot" options={screenOptionsNoHeader} />
        <Stack.Screen name="drawer" options={screenOptionsNoHeader} />
        <Stack.Screen name="MountainTop" options={screenOptionsNoHeader} />
        <Stack.Screen name="viewpoint" options={screenOptionsNoHeader} />
        <Stack.Screen name="weather" options={screenOptionsNoHeader} />
        <Stack.Screen name="settings" options={screenOptionsNoHeader} />
      </Stack>
    </>
  );
}
