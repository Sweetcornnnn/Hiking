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
  headerShown: false,
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
        <Stack.Screen name="Index" options={screenOptionsNoHeader} />
        <Stack.Screen name="Auth" options={screenOptionsNoHeader} />
        <Stack.Screen name="Intro" options={screenOptionsNoHeader} />
        <Stack.Screen name="Login" options={screenOptionsNoHeader} />
        <Stack.Screen name="Signup" options={screenOptionsNoHeader} />
        <Stack.Screen name="Forgot" options={screenOptionsNoHeader} />
        <Stack.Screen name="Home" options={screenOptionsNoHeader} />
        <Stack.Screen name="Calendar" options={screenOptionsNoHeader} />
        <Stack.Screen name="admin/Admin" options={screenOptionsNoHeader} />
        <Stack.Screen name="wildtrack/WildTrack" options={screenOptionsNoHeader} />
        <Stack.Screen name="MountainTop" options={screenOptionsNoHeader} />
        <Stack.Screen name="Viewpoint" options={screenOptionsNoHeader} />
        <Stack.Screen name="Weather" options={screenOptionsNoHeader} />
        <Stack.Screen name="Settings" options={screenOptionsNoHeader} />
      </Stack>
    </>
  );
}