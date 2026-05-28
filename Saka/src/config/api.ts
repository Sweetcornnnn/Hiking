import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getHostFromUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  const host = url.split('://').pop()?.split('/')[0]?.split(':')[0];
  return host && host.length > 0 ? host : undefined;
};

const getExpoHost = (): string | undefined => {
  const candidates = [
    Constants.manifest?.debuggerHost as string | undefined,
    (Constants.expoConfig as any)?.debuggerHost as string | undefined,
    (Constants.expoConfig as any)?.hostUri as string | undefined,
    Constants.manifest?.bundleUrl as string | undefined,
  ];

  for (const candidate of candidates) {
    const host = getHostFromUrl(candidate);
    if (host) return host;
  }

  return undefined;
};

const getDevApiHost = () => {
  // Allow explicit override via app manifest `extra` or environment variable.
  // In app.json / app.config.js set: { "expo": { "extra": { "API_HOST": "192.168.x.y" } } }
  const manifestExtraHost = (Constants.manifest && (Constants.manifest as any).extra && (Constants.manifest as any).extra.API_HOST) ||
    (Constants.expoConfig && (Constants.expoConfig as any).extra && (Constants.expoConfig as any).extra.API_HOST) ||
    (process && (process.env as any).EXPO_API_HOST) ||
    (process && (process.env as any).API_HOST);

  if (manifestExtraHost) return manifestExtraHost;

  if (Constants.platform?.web) {
    return 'localhost';
  }

  const expoHost = getExpoHost();
  if (expoHost) {
    return expoHost;
  }

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return '10.0.2.2';
  }

  if (!Constants.isDevice) {
    return 'localhost';
  }

  return '10.0.0.20';
};

// API configuration for different environments
const getApiUrl = () => {
  if (__DEV__) {
    const host = getDevApiHost();
    const url = `http://${host}:3000`;
    console.log('[API] Dev host selected:', host, 'API_BASE_URL=', url);
    return url;
  }

  return 'https://your-production-api.com';
};

export const API_BASE_URL = getApiUrl();
