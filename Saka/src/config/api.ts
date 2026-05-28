import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevApiHost = () => {
  // Allow explicit override via app manifest `extra` or environment variable.
  // In app.json / app.config.js set: { "expo": { "extra": { "API_HOST": "192.168.x.y" } } }
  const manifestExtraHost = (Constants.manifest && (Constants.manifest as any).extra && (Constants.manifest as any).extra.API_HOST) ||
    // newer expo versions expose expoConfig
    (Constants.expoConfig && (Constants.expoConfig as any).extra && (Constants.expoConfig as any).extra.API_HOST) ||
    // fallback to process.env if you inject env vars during bundling
    (process && (process.env as any).EXPO_API_HOST) ||
    (process && (process.env as any).API_HOST);

  if (manifestExtraHost) return manifestExtraHost;

  if (Constants.platform?.web) {
    return 'localhost';
  }

  // Android emulator (Android Studio) maps host machine localhost to 10.0.2.2
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return '192.168.1.251';
  }

  // iOS simulator and other non-device runtimes can use localhost
  if (!Constants.isDevice) {
    return 'localhost';
  }

  // If a debuggerHost is available (e.g. Expo Go), use its host portion
  const debuggerHost = Constants.manifest?.debuggerHost?.split(':')[0];
  if (debuggerHost) {
    return debuggerHost;
  }

  // Last resort default (replaceable)
  return '10.0.0.20';
};

// API configuration for different environments
const getApiUrl = () => {
  if (__DEV__) {
    return `http://${getDevApiHost()}:3000`;
  }

  return 'https://your-production-api.com';
};

export const API_BASE_URL = getApiUrl();
