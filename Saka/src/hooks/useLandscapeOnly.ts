import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export const useLandscapeOnly = () => {
  useEffect(() => {
    let mounted = true;

    const lockOrientation = async () => {
      if (AppState.currentState !== 'active') return;

      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch (error) {
        if (
          !mounted ||
          String(error).includes('current activity is no longer available')
        ) {
          return;
        }
        console.error('Failed to lock orientation:', error);
      }
    };

    void lockOrientation();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void lockOrientation();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
};
