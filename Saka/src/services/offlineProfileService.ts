import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { uploadProfileAvatar } from './profileAvatarService';

const QUEUE_KEY = 'saka.profile.writeQueue.v1';
const CACHE_PREFIX = 'saka.profile.cache.v1:';

export interface QueuedProfileUpdate {
  userId: string;
  data: Record<string, unknown>;
  status: 'pending' | 'failed';
  error: string | null;
  queuedAt: number;
  baseUpdatedAt: string | null;
  conflict?: boolean;
}

const listeners = new Set<() => void>();

export function subscribeToProfileSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyProfileSync(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[OfflineProfile] Listener failed:', error);
    }
  }
}

async function readQueue(): Promise<QueuedProfileUpdate[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved profile sync queue is invalid.');
  return parsed as QueuedProfileUpdate[];
}

async function writeQueue(queue: QueuedProfileUpdate[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyProfileSync();
}

export async function cacheProfileLocally(userId: string, profile: unknown): Promise<void> {
  await AsyncStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(profile));
}

export async function getCachedProfile<T>(userId: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${userId}`);
  return raw ? JSON.parse(raw) as T : null;
}

export async function getProfileUpdateStatus(
  userId: string,
): Promise<QueuedProfileUpdate | null> {
  return (await readQueue()).find((item) => item.userId === userId) ?? null;
}

export async function queueProfileUpdate(
  userId: string,
  data: Record<string, unknown>,
  baseUpdatedAt: string | null,
): Promise<void> {
  const queue = await readQueue();
  const existing = queue.find((item) => item.userId === userId);
  const update: QueuedProfileUpdate = {
    userId,
    data: { ...(existing?.data ?? {}), ...data },
    status: 'pending',
    error: null,
    queuedAt: Date.now(),
    baseUpdatedAt: existing?.baseUpdatedAt ?? baseUpdatedAt,
    conflict: existing?.conflict,
  };
  const next = queue.filter((item) => item.userId !== userId);
  next.push(update);
  await writeQueue(next);
}

export async function flushProfileUpdateQueue(): Promise<number> {
  const queue = await readQueue();
  let synced = 0;

  for (const update of queue) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id !== update.userId) continue;

      const { data: latestProfile, error: latestProfileError } = await supabase
        .from('profiles')
        .select('updated_at')
        .eq('id', update.userId)
        .maybeSingle();
      if (latestProfileError) throw new Error(latestProfileError.message);
      if (!latestProfile) throw new Error('Profile no longer exists on the server.');
      update.conflict = Boolean(
        update.baseUpdatedAt
        && latestProfile.updated_at
        && update.baseUpdatedAt !== latestProfile.updated_at,
      );

      const payload = { ...update.data };
      if (typeof payload.avatar_url === 'string' && /^(file:|content:)/i.test(payload.avatar_url)) {
        payload.avatar_url = await uploadProfileAvatar(update.userId, payload.avatar_url);
        update.data.avatar_url = payload.avatar_url;
        await writeQueue(queue);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', update.userId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Profile update was not accepted by the server.');

      await cacheProfileLocally(update.userId, {
        ...data,
        sync_conflict: update.conflict || false,
      });
      const index = queue.findIndex((item) => item.userId === update.userId);
      if (index >= 0) queue.splice(index, 1);
      await writeQueue(queue);
      synced += 1;
    } catch (error) {
      update.status = 'failed';
      update.error = error instanceof Error ? error.message : 'Unable to sync profile changes.';
      await writeQueue(queue);
    }
  }

  return synced;
}

export async function retryProfileUpdateQueue(): Promise<number> {
  const queue = await readQueue();
  for (const item of queue) {
    item.status = 'pending';
    item.error = null;
  }
  await writeQueue(queue);
  return flushProfileUpdateQueue();
}
