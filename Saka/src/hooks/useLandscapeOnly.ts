import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export const useLandscapeOnly = () => {
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch (error) {
        console.error('Failed to lock orientation:', error);
      }
    };

    lockOrientation();

    return () => {
      // Optionally unlock on unmount, but typically you'd want it locked throughout
      // await ScreenOrientation.unlockAsync();
    };
  }, []);
};
