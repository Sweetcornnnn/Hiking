import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { CreateJournalEntryInput, JournalEntry, JournalImage } from '../types/journal';
import { warnIfDeviceStorageLow } from './offlineStorageService';

const JOURNAL_BUCKET = 'journal-images';
const JOURNAL_QUEUE_KEY = 'saka.journal.writeQueue.v1';
const JOURNAL_CACHE_PREFIX = 'saka.journal.entries.v1:';
let journalFlushPromise: Promise<number> | null = null;
const journalQueueListeners = new Set<() => void>();

export function subscribeToJournalQueueChanges(listener: () => void): () => void {
  journalQueueListeners.add(listener);
  return () => journalQueueListeners.delete(listener);
}

function notifyJournalQueueChanged(): void {
  for (const listener of journalQueueListeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[Journal] Queue listener failed:', error);
    }
  }
}

interface QueuedJournalWrite {
  id: string;
  userId: string;
  entryId: string;
  kind: 'create' | 'update';
  input: CreateJournalEntryInput;
  status: 'pending' | 'failed';
  error: string | null;
  baseUpdatedAt?: string | null;
  conflict?: boolean;
  queuedAt: number;
}

const createLocalId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });

async function readJournalQueue(): Promise<QueuedJournalWrite[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_QUEUE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved journal sync queue is invalid.');
  return parsed as QueuedJournalWrite[];
}

async function writeJournalQueue(queue: QueuedJournalWrite[]): Promise<void> {
  await AsyncStorage.setItem(JOURNAL_QUEUE_KEY, JSON.stringify(queue));
}

async function cacheJournalEntries(userId: string, entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(`${JOURNAL_CACHE_PREFIX}${userId}`, JSON.stringify(entries));
}

async function persistLocalPhotos(
  images: JournalImage[],
  entryId: string,
): Promise<JournalImage[]> {
  const directory = new Directory(Paths.document, 'offline-journal', entryId);
  directory.create({ intermediates: true, idempotent: true });
  if (images.some((image) => /^(file:|content:)/i.test(image.uri))) {
    warnIfDeviceStorageLow();
  }

  return Promise.all(images.map((image) => {
    if (/^(https?:|file:|content:)/i.test(image.uri) && !/^(file:|content:)/i.test(image.uri)) {
      return image;
    }

    const source = new File(normalizeLocalUri(image.uri));
    if (!source.exists) {
      throw new Error('A selected journal photo is no longer available on this device.');
    }
    const extension = getExtension(image.mimeType || getImageContentType(image.uri));
    const destination = new File(directory, `${createLocalId()}.${extension}`);
    source.copy(destination);
    return { ...image, uri: destination.uri };
  }));
}

function toLocalEntry(
  userId: string,
  entryId: string,
  input: CreateJournalEntryInput,
  status: 'pending' | 'failed' = 'pending',
  syncError: string | null = null,
  previous?: JournalEntry,
): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: entryId,
    user_id: userId,
    mountain_id: input.mountainId ?? null,
    hike_id: input.hikeId ?? null,
    viewpoint_id: input.viewpointId ?? null,
    title: input.title.trim(),
    content: input.content.trim(),
    images: input.images.map((image) => image.uri),
    rating: input.rating ?? null,
    is_public: input.isPublic ?? false,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    sync_status: status,
    sync_error: syncError,
    sync_conflict: previous?.sync_conflict,
  };
}

async function uploadQueuedJournalImages(
  userId: string,
  journalId: string,
  images: JournalImage[],
): Promise<string[]> {
  return Promise.all(images.map(async (image, index) => {
    if (/^https?:\/\//i.test(image.uri)) return image.uri;
    return uploadJournalImage(userId, journalId, image, `${index}`);
  }));
}

async function syncJournalWrite(
  write: QueuedJournalWrite,
): Promise<{ images: string[]; conflict: boolean }> {
  const uploadedImages = await uploadQueuedJournalImages(
    write.userId,
    write.entryId,
    write.input.images,
  );
  let conflict = false;
  if (write.kind === 'update' && write.baseUpdatedAt) {
    const { data: current, error: currentError } = await supabase
      .from('hiking_journals')
      .select('updated_at')
      .eq('id', write.entryId)
      .eq('user_id', write.userId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error('Journal entry no longer exists on the server.');
    conflict = Boolean(current.updated_at && current.updated_at !== write.baseUpdatedAt);
    write.conflict = conflict;
  }
  const row = {
    id: write.entryId,
    user_id: write.userId,
    title: write.input.title.trim(),
    content: write.input.content.trim(),
    images: uploadedImages,
    rating: write.input.rating ?? null,
    mountain_id: write.input.mountainId ?? null,
    hike_id: write.input.hikeId ?? null,
    viewpoint_id: write.input.viewpointId ?? null,
    is_public: write.input.isPublic ?? false,
    updated_at: new Date().toISOString(),
  };

  let error: { message: string } | null = null;
  if (write.kind === 'create') {
    ({ error } = await supabase.from('hiking_journals').upsert(row, { onConflict: 'id' }));
  } else {
    const { data, error: updateError } = await supabase
      .from('hiking_journals')
      .update({
        title: row.title,
        content: row.content,
        images: row.images,
        rating: row.rating,
        mountain_id: row.mountain_id,
        hike_id: row.hike_id,
        viewpoint_id: row.viewpoint_id,
        is_public: row.is_public,
        updated_at: row.updated_at,
      })
      .eq('id', write.entryId)
      .eq('user_id', write.userId)
      .select('id')
      .maybeSingle();
    error = updateError ?? (!data ? new Error('Journal entry no longer exists on the server.') : null);
  }
  if (error) throw new Error(error.message);
  return { images: uploadedImages, conflict };
}

async function flushJournalWriteQueueImpl(): Promise<number> {
  const queue = await readJournalQueue();
  if (queue.length === 0) return 0;
  let synced = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const write = queue[index];
    try {
      const { images: uploadedImages, conflict } = await syncJournalWrite(write);
      const rawEntries = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${write.userId}`);
      const entries = rawEntries ? JSON.parse(rawEntries) as JournalEntry[] : [];
      const syncedEntry = {
        ...toLocalEntry(write.userId, write.entryId, {
          ...write.input,
          images: uploadedImages.map((uri) => ({ uri })),
        }),
        images: uploadedImages,
        sync_status: undefined,
        sync_error: null,
        sync_conflict: conflict,
      };
      await cacheJournalEntries(write.userId, [
        syncedEntry,
        ...entries.filter((entry) => entry.id !== write.entryId),
      ]);
      queue.splice(index, 1);
      index -= 1;
      await writeJournalQueue(queue);
      synced += 1;
    } catch (error) {
      write.status = 'failed';
      write.error = error instanceof Error ? error.message : 'Unable to sync journal entry.';
      await writeJournalQueue(queue);
      const rawEntries = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${write.userId}`);
      const entries = rawEntries ? JSON.parse(rawEntries) as JournalEntry[] : [];
      await cacheJournalEntries(write.userId, [
        toLocalEntry(
          write.userId,
          write.entryId,
          write.input,
          'failed',
          write.error,
          entries.find((entry) => entry.id === write.entryId),
        ),
        ...entries.filter((entry) => entry.id !== write.entryId),
      ]);
    }
  }

  notifyJournalQueueChanged();
  return synced;
}

export function flushJournalWriteQueue(): Promise<number> {
  if (journalFlushPromise) return journalFlushPromise;
  journalFlushPromise = flushJournalWriteQueueImpl().finally(() => {
    journalFlushPromise = null;
  });
  return journalFlushPromise;
}

export async function retryJournalWriteQueue(): Promise<number> {
  const queue = await readJournalQueue();
  for (const write of queue) {
    write.status = 'pending';
    write.error = null;
  }
  await writeJournalQueue(queue);
  return flushJournalWriteQueue();
}

async function queueJournalWrite(
  userId: string,
  entryId: string,
  kind: QueuedJournalWrite['kind'],
  input: CreateJournalEntryInput,
): Promise<JournalEntry> {
  const images = await persistLocalPhotos(input.images, entryId);
  const durableInput = { ...input, images };
  const queue = await readJournalQueue();
  const existingWrite = queue.find((item) => item.entryId === entryId);
  const rawEntries = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${userId}`);
  const entries = rawEntries ? JSON.parse(rawEntries) as JournalEntry[] : [];
  const previousEntry = entries.find((entry) => entry.id === entryId);
  const write: QueuedJournalWrite = {
    id: kind === 'create' ? entryId : `${entryId}:update`,
    userId,
    entryId,
    kind,
    input: durableInput,
    status: 'pending',
    error: null,
    baseUpdatedAt: kind === 'update'
      ? existingWrite?.baseUpdatedAt ?? previousEntry?.updated_at ?? null
      : null,
    conflict: existingWrite?.conflict ?? false,
    queuedAt: Date.now(),
  };

  const pendingCreate = kind === 'update'
    ? queue.find((item) => item.entryId === entryId && item.kind === 'create')
    : undefined;
  if (pendingCreate) {
    pendingCreate.input = durableInput;
    pendingCreate.status = 'pending';
    pendingCreate.error = null;
  } else {
    const previous = queue.findIndex((item) => item.id === write.id);
    if (previous >= 0) queue[previous] = write;
    else queue.push(write);
  }
  await writeJournalQueue(queue);

  const localEntry = toLocalEntry(userId, entryId, durableInput, 'pending', null, previousEntry);
  await cacheJournalEntries(userId, [
    localEntry,
    ...entries.filter((entry) => entry.id !== entryId),
  ]);

  await flushJournalWriteQueue();
  const updatedQueue = await readJournalQueue();
  const remaining = updatedQueue.find((item) => item.entryId === entryId);
  if (remaining) {
    return toLocalEntry(userId, entryId, durableInput, remaining.status, remaining.error, previousEntry);
  }

  const savedJson = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${userId}`);
  if (savedJson) {
    const savedEntries = JSON.parse(savedJson) as JournalEntry[];
    const savedEntry = savedEntries.find((entry) => entry.id === entryId);
    if (savedEntry) return savedEntry;
  }
  return { ...localEntry, sync_status: undefined };
}

export async function fetchPendingPublicJournalEntries(
  userId: string,
  viewpointId: string,
): Promise<JournalEntry[]> {
  const queue = await readJournalQueue();
  return queue
    .filter((write) => (
      write.userId === userId &&
      write.input.viewpointId === viewpointId &&
      write.input.isPublic === true
    ))
    .map((write) => toLocalEntry(
      userId,
      write.entryId,
      write.input,
      write.status,
      write.error,
      { ...toLocalEntry(userId, write.entryId, write.input), sync_conflict: write.conflict },
    ));
}

export async function fetchMyJournalEntries(): Promise<JournalEntry[]> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (userError || !user) {
    throw new Error('You must be signed in to load journal entries.');
  }

  let entries: JournalEntry[];
  try {
    const previousCache = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${user.id}`);
    const previousEntries = previousCache ? JSON.parse(previousCache) as JournalEntry[] : [];
    const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
    const { data, error } = await supabase
      .from('hiking_journals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    entries = ((data ?? []) as JournalEntry[]).map((entry) => (
      previousById.get(entry.id)?.sync_conflict
        ? { ...entry, sync_conflict: true }
        : entry
    ));
    await cacheJournalEntries(user.id, entries);
  } catch (error) {
    console.warn('[Journal] Remote fetch failed; loading device copy:', error);
    const raw = await AsyncStorage.getItem(`${JOURNAL_CACHE_PREFIX}${user.id}`);
    if (!raw) throw new Error('Unable to load journal entries while offline.');
    const cached: unknown = JSON.parse(raw);
    if (!Array.isArray(cached)) throw new Error('Saved journal entries are invalid.');
    entries = cached as JournalEntry[];
  }

  const queue = await readJournalQueue();
  const userQueue = queue.filter((item) => item.userId === user.id);
  const merged = new Map(entries.map((entry) => [entry.id, entry]));
  for (const write of userQueue) {
    merged.set(write.entryId, toLocalEntry(
      write.userId,
      write.entryId,
      write.input,
      write.status,
      write.error,
    ));
  }
  return [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function uploadJournalImage(
  userId: string,
  journalId: string,
  image: JournalImage,
  stableKey = createLocalId(),
): Promise<string> {
  const uri = normalizeLocalUri(image.uri);
  const contentType = image.mimeType || getImageContentType(uri);
  let arrayBuffer: ArrayBuffer;

  try {
    const response = await fetch(uri);
    if (!response.ok && response.status !== 0) {
      throw new Error(`Local photo returned HTTP ${response.status}.`);
    }
    arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error('The selected photo is empty or unavailable.');
    }
  } catch (error: any) {
    throw new Error(
      `Unable to read the selected photo: ${error?.message || 'Unknown file error'}`,
    );
  }

  const extension = getExtension(contentType);
  const path = `${userId}/${journalId}/${stableKey}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(JOURNAL_BUCKET)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  return supabase.storage.from(JOURNAL_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function replaceJournalImage(
  entry: JournalEntry,
  index: number,
  localEditedUri: string,
): Promise<{ error: string | null; entry?: JournalEntry }> {
  try {
    const currentImages = [...(entry.images ?? [])];
    const realIndices = currentImages
      .map((value, imageIndex) => (value ? imageIndex : -1))
      .filter((imageIndex) => imageIndex >= 0);
    const realIndex = realIndices[index];
    if (realIndex === undefined) throw new Error('Photo not found in this entry.');

    const { data: auth } = await supabase.auth.getSession();
    const userId = auth?.user?.id;
    if (!userId) throw new Error('Not signed in.');

    const nextImages = [...currentImages];
    nextImages[realIndex] = localEditedUri;
    const result = await queueJournalWrite(userId, entry.id, 'update', {
      title: entry.title,
      content: entry.content,
      images: nextImages.map((uri) => ({ uri })),
      rating: entry.rating ?? undefined,
      mountainId: entry.mountain_id,
      hikeId: entry.hike_id,
      viewpointId: entry.viewpoint_id,
      isPublic: entry.is_public,
    });
    return { error: null, entry: result };
  } catch (error: any) {
    return { error: error?.message ?? 'Unable to replace photo.' };
  }
}

function getImageContentType(uri: string): string {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function getExtension(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
}

function normalizeLocalUri(uri: string): string {
  let normalized = uri;

  for (let index = 0; index < 2 && normalized.includes('%25'); index += 1) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      break;
    }
  }

  return normalized;
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (userError || !user) throw new Error('You must be signed in to save a journal entry.');

  const uniqueImages = Array.from(new Map(input.images.map((image) => [image.uri, image])).values());
  const entryId = createLocalId();
  return queueJournalWrite(user.id, entryId, 'create', { ...input, images: uniqueImages });
}

export async function updateJournalEntry(
  entryId: string,
  input: CreateJournalEntryInput,
): Promise<JournalEntry> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (userError || !user) throw new Error('You must be signed in to update a journal entry.');

  return queueJournalWrite(user.id, entryId, 'update', input);
}

function getStoragePath(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${JOURNAL_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);

  return markerIndex >= 0
    ? decodeURIComponent(imageUrl.slice(markerIndex + marker.length))
    : null;
}

export async function deleteJournalEntry(entry: JournalEntry): Promise<void> {
  const imagePaths = entry.images
    .map(getStoragePath)
    .filter((path): path is string => Boolean(path));

  if (imagePaths.length > 0) {
    const { error: imageError } = await supabase.storage
      .from(JOURNAL_BUCKET)
      .remove(imagePaths);

    if (imageError) throw imageError;
  }

  const { error } = await supabase
    .from('hiking_journals')
    .delete()
    .eq('id', entry.id)
    .eq('user_id', entry.user_id);

  if (error) throw error;
}
