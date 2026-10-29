import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useHikeSafetyStore } from '../src/store/hikeSafetyStore';
import HomeCheckPrompt from '../src/components/safety/HomeCheckPrompt';
import { locationService } from '../src/services/locationService';
import { flushJournalWriteQueue } from '../src/services/journalService';
import { flushSakagramLikeQueue } from '../src/services/sakagramService';
import { flushTextMessageQueue } from '../src/services/offlineMessageQueue';
import { flushProfileUpdateQueue } from '../src/services/offlineProfileService';
import { useAuthStore } from '../src/store/authStore';

function syncQueuedProfiles(): void {
  void flushProfileUpdateQueue()
    .then(() => useAuthStore.getState().refreshProfileSyncStatus())
    .catch((error) => {
      console.warn('[OfflineSync] Profile queue flush failed:', error);
    });
}

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
  const bootstrap = useHikeSafetyStore((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);
  useEffect(() => {
    void locationService.initializeTrackingState();
    void locationService.retryQueuedUploads();
    void flushJournalWriteQueue().catch((error) => {
      console.warn('[OfflineSync] Journal queue flush failed:', error);
    });
    void flushSakagramLikeQueue().catch((error) => {
      console.warn('[OfflineSync] Sakagram queue flush failed:', error);
    });
    void flushTextMessageQueue().catch((error) => {
      console.warn('[OfflineSync] Message queue flush failed:', error);
    });
    syncQueuedProfiles();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void locationService.retryQueuedUploads();
        void flushJournalWriteQueue().catch((error) => {
          console.warn('[OfflineSync] Journal queue flush failed:', error);
        });
        void flushSakagramLikeQueue().catch((error) => {
          console.warn('[OfflineSync] Sakagram queue flush failed:', error);
        });
        void flushTextMessageQueue().catch((error) => {
          console.warn('[OfflineSync] Message queue flush failed:', error);
        });
        syncQueuedProfiles();
      }
    });
    const retryTimer = setInterval(() => {
      void flushJournalWriteQueue().catch((error) => {
        console.warn('[OfflineSync] Journal queue flush failed:', error);
      });
      void flushSakagramLikeQueue().catch((error) => {
        console.warn('[OfflineSync] Sakagram queue flush failed:', error);
      });
      void flushTextMessageQueue().catch((error) => {
        console.warn('[OfflineSync] Message queue flush failed:', error);
      });
      syncQueuedProfiles();
      if (locationService.getTrackingStatus().queuedUploads > 0) {
        void locationService.retryQueuedUploads();
      }
    }, 30_000);

    return () => {
      subscription.remove();
      clearInterval(retryTimer);
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar hidden={true} />
      <Stack screenOptions={stackScreenOptions}>
        {/* ...unchanged screens... */}
        <Stack.Screen name="index" options={screenOptionsNoHeader} />
        <Stack.Screen name="Auth" options={screenOptionsNoHeader} />
        <Stack.Screen name="Intro" options={screenOptionsNoHeader} />
        <Stack.Screen name="Login" options={screenOptionsNoHeader} />
        <Stack.Screen name="Signup" options={screenOptionsNoHeader} />
        <Stack.Screen name="Forgot" options={screenOptionsNoHeader} />
        <Stack.Screen name="Home" options={screenOptionsNoHeader} />
        <Stack.Screen name="Calendar" options={screenOptionsNoHeader} />
        <Stack.Screen name="EmergencyContacts" options={screenOptionsNoHeader} />
        <Stack.Screen name="admin/Admin" options={screenOptionsNoHeader} />
        <Stack.Screen name="wildtrack/WildTrack" options={screenOptionsNoHeader} />
        <Stack.Screen name="MountainTop" options={screenOptionsNoHeader} />
        <Stack.Screen name="Viewpoint" options={screenOptionsNoHeader} />
        <Stack.Screen name="Weather" options={screenOptionsNoHeader} />
        <Stack.Screen name="Settings" options={screenOptionsNoHeader} />
        <Stack.Screen
          name="mountainInfo/TipsAndTricks"
          options={{
            headerShown: false,
            orientation: 'landscape',
            contentStyle: { backgroundColor: '#F5E6D3' },
          }}
        />
        <Stack.Screen name="organizations/Dashboard" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/BecomeOrganizer" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/Events" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/EventDetail" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/Attendees" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/CreateEvent" options={screenOptionsNoHeader} />
        <Stack.Screen name="organizations/Profile" options={screenOptionsNoHeader} />
        <Stack.Screen name="events/Events" options={screenOptionsNoHeader} />
        <Stack.Screen name="events/EventDetail" options={screenOptionsNoHeader} />
        <Stack.Screen name="journal" options={screenOptionsNoHeader} />
      </Stack>
      <HomeCheckPrompt />
    </SafeAreaProvider>
  );
}