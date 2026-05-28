import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_PORT = 3000;
const HEALTHCHECK_PATH = '/api/health';

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

  return undefined;
};

const getApiUrl = () => {
  if (__DEV__) {
    const host = getDevApiHost() || 'localhost';
    const url = `http://${host}:${API_PORT}`;
    console.log('[API] Dev host selected:', host, 'API_BASE_URL=', url);
    return url;
  }

  return 'https://your-production-api.com';
};

export const API_BASE_URL = getApiUrl();

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const buildUrl = (host: string) => host.startsWith('http') ? host : `http://${host}:${API_PORT}`;

const checkHealthUrl = async (baseUrl: string) => {
  try {
    const response = await fetchWithTimeout(`${baseUrl}${HEALTHCHECK_PATH}`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

export const resolveApiBaseUrl = async (): Promise<string> => {
  if ((global as any).__API_BASE__) {
    return (global as any).__API_BASE__;
  }

  const override = await AsyncStorage.getItem('API_HOST_OVERRIDE');
  if (override) {
    const base = buildUrl(override);
    (global as any).__API_BASE__ = base;
    console.log('[API] Using runtime override from AsyncStorage:', base);
    return base;
  }

  const manifestExtraHost = (Constants.manifest && (Constants.manifest as any).extra && (Constants.manifest as any).extra.API_HOST) ||
    (Constants.expoConfig && (Constants.expoConfig as any).extra && (Constants.expoConfig as any).extra.API_HOST);

  const candidates = [
    manifestExtraHost,
    getExpoHost(),
    Platform.OS === 'android' && !Constants.isDevice ? '10.0.2.2' : undefined,
    Constants.platform?.web ? 'localhost' : undefined,
    !Constants.isDevice && Platform.OS === 'ios' ? 'localhost' : undefined,
    'localhost',
  ].filter((host): host is string => Boolean(host));

  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((host) => {
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });

  for (const host of uniqueCandidates) {
    const base = buildUrl(host);
    if (await checkHealthUrl(base)) {
      (global as any).__API_BASE__ = base;
      console.log('[API] Resolved backend host via health check:', base);
      return base;
    }
  }

  const fallback = API_BASE_URL;
  console.warn('[API] Failed to resolve backend host from candidates, falling back to', fallback);
  return fallback;
};
