import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineQueueStatus {
  label: string;
  count: number;
  failed: number;
}

export interface OfflineStatusSnapshot {
  queues: OfflineQueueStatus[];
  savedData: Array<{ label: string; updatedAt: string | null }>;
}

export function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';
  return /network|fetch failed|failed to fetch|no internet|offline|connection (?:failed|lost)|timed? out/i
    .test(message);
}

const QUEUE_KEYS: Array<{ key: string; label: string }> = [
  { key: 'saka.journal.writeQueue.v1', label: 'Journal entries and photos' },
  { key: 'saka.sakagram.likeQueue.v1', label: 'Sakagram likes' },
  { key: 'saka.chat.textQueue.v1', label: 'Text messages' },
  { key: 'saka.profile.writeQueue.v1', label: 'Profile changes' },
  { key: 'HIKING_LOCATION_UPLOAD_QUEUE', label: 'GPS track points' },
];

export async function checkInternetConnection(): Promise<boolean> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOfflineStatusSnapshot(): Promise<OfflineStatusSnapshot> {
  const keys = await AsyncStorage.getAllKeys();
  const [mountainsJson] = await AsyncStorage.multiGet(['SAKA_MOUNTAINS_CACHE']);
  const mountainNames = new Map<string, string>();
  if (mountainsJson[1]) {
    const mountains: unknown = JSON.parse(mountainsJson[1]);
    if (Array.isArray(mountains)) {
      for (const mountain of mountains) {
        if (
          typeof mountain === 'object'
          && mountain !== null
          && 'id' in mountain
          && 'name' in mountain
          && typeof mountain.id === 'string'
          && typeof mountain.name === 'string'
        ) {
          mountainNames.set(mountain.id, mountain.name);
        }
      }
    }
  }
  const timestampKeys = [
    'SAKA_MOUNTAINS_CACHE_UPDATED_AT',
    ...keys.filter((key) => key.startsWith('SAKA_VIEWPOINTS_CACHE_UPDATED:')),
    ...keys.filter((key) => key.startsWith('SAKA_VIEWPOINT_CACHE_UPDATED:')),
  ];
  const requestedKeys = [...new Set([...QUEUE_KEYS.map(({ key }) => key), ...timestampKeys])];
  const values = new Map(await AsyncStorage.multiGet(requestedKeys));

  const queues = QUEUE_KEYS.map(({ key, label }) => {
    const raw = values.get(key);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) throw new Error(`Saved ${label.toLowerCase()} queue is invalid.`);
    return {
      label,
      count: entries.length,
      failed: entries.filter((entry) => (
        typeof entry === 'object'
        && entry !== null
        && 'status' in entry
        && entry.status === 'failed'
      )).length,
    };
  }).filter((queue) => queue.count > 0);

  const savedData = timestampKeys
    .map((key) => ({
      label: key === 'SAKA_MOUNTAINS_CACHE_UPDATED_AT'
        ? 'Mountain catalog'
        : key.startsWith('SAKA_VIEWPOINTS_CACHE_UPDATED:')
          ? `Trail map and stops${mountainNames.has(key.slice('SAKA_VIEWPOINTS_CACHE_UPDATED:'.length))
            ? ` · ${mountainNames.get(key.slice('SAKA_VIEWPOINTS_CACHE_UPDATED:'.length))}`
            : ''}`
          : 'Viewpoint details',
      updatedAt: values.get(key) ?? null,
    }))
    .filter((item) => item.updatedAt !== null)
    .sort((first, second) => (
      new Date(second.updatedAt!).getTime() - new Date(first.updatedAt!).getTime()
    ));

  return { queues, savedData };
}
