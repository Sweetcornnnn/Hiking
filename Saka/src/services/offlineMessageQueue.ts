import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'saka.chat.textQueue.v1';

export type OfflineMessageKind = 'private' | 'group' | 'world';

export interface QueuedTextMessage {
  id: number;
  kind: OfflineMessageKind;
  userId: string;
  payload: Record<string, string | number | null>;
  createdAt: string;
  status: 'pending' | 'failed';
  error: string | null;
}

const listeners = new Set<() => void>();

export function subscribeToQueuedMessages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[OfflineMessages] Listener failed:', error);
    }
  }
}

async function readQueue(): Promise<QueuedTextMessage[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved message sync queue is invalid.');
  return parsed as QueuedTextMessage[];
}

async function writeQueue(queue: QueuedTextMessage[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function queueTextMessage(
  kind: OfflineMessageKind,
  userId: string,
  payload: QueuedTextMessage['payload'],
  optimisticId?: number,
): Promise<QueuedTextMessage> {
  const queue = await readQueue();
  const entry: QueuedTextMessage = {
    id: optimisticId ?? -Date.now() - Math.floor(Math.random() * 1000),
    kind,
    userId,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    error: null,
  };
  queue.push(entry);
  await writeQueue(queue);
  notifyChanged();
  return entry;
}

export async function getQueuedTextMessages(
  kind: OfflineMessageKind,
  userId: string,
  conversationId?: string | number,
): Promise<QueuedTextMessage[]> {
  const queue = await readQueue();
  return queue.filter((entry) => {
    if (entry.kind !== kind || entry.userId !== userId) return false;
    if (kind === 'private') {
      return entry.payload.recipient_id === conversationId;
    }
    if (kind === 'group') {
      return String(entry.payload.group_id) === String(conversationId);
    }
    return true;
  });
}

async function sendQueuedMessage(entry: QueuedTextMessage): Promise<void> {
  const table = entry.kind === 'private'
    ? 'private_messages'
    : entry.kind === 'group'
      ? 'group_messages'
      : 'chat_messages';
  const { error } = await supabase.from(table).insert(entry.payload);
  if (error) throw new Error(error.message);
}

export async function flushTextMessageQueue(): Promise<number> {
  const queue = await readQueue();
  let synced = 0;
  for (const entry of queue) {
    try {
      await sendQueuedMessage(entry);
      const index = queue.findIndex((item) => item.id === entry.id);
      if (index >= 0) queue.splice(index, 1);
      await writeQueue(queue);
      synced += 1;
    } catch (error) {
      entry.status = 'failed';
      entry.error = error instanceof Error ? error.message : 'Unable to sync message.';
      await writeQueue(queue);
    }
  }
  notifyChanged();
  return synced;
}

export async function retryTextMessageQueue(): Promise<number> {
  const queue = await readQueue();
  for (const entry of queue) {
    entry.status = 'pending';
    entry.error = null;
  }
  await writeQueue(queue);
  return flushTextMessageQueue();
}
