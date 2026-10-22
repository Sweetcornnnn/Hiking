import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchPendingPublicJournalEntries } from './journalService';
import type { JournalEntry } from '../types/journal';

const SAKAGRAM_CACHE_PREFIX = 'saka.sakagram.posts.v1:';
const SAKAGRAM_LIKE_QUEUE_KEY = 'saka.sakagram.likeQueue.v1';
const syncListeners = new Set<() => void>();

export function subscribeToSakagramSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySakagramSync(): void {
  for (const listener of syncListeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[Sakagram] Sync listener failed:', error);
    }
  }
}

interface QueuedLike {
  userId: string;
  journalEntryId: string;
  liked: boolean;
  queuedAt: number;
}

async function readLikeQueue(): Promise<QueuedLike[]> {
  const raw = await AsyncStorage.getItem(SAKAGRAM_LIKE_QUEUE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved Sakagram sync queue is invalid.');
  return parsed as QueuedLike[];
}

async function applyPendingLikes(
  posts: SakagramPost[],
  userId: string | null,
): Promise<SakagramPost[]> {
  if (!userId) return posts;
  const queue = await readLikeQueue();
  return posts.map((post) => {
    const queued = queue.find(
      (item) => item.userId === userId && item.journalEntryId === post.id,
    );
    if (!queued || queued.liked === post.likedByMe) return post;
    return {
      ...post,
      likedByMe: queued.liked,
      likeCount: Math.max(0, post.likeCount + (queued.liked ? 1 : -1)),
    };
  });
}

export interface SakagramPost extends JournalEntry {
  authorName: string;
  authorAvatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
}

export async function fetchSakagramPosts(
  viewpointId: string,
  currentUserId: string | null,
  limit = 20,
): Promise<SakagramPost[]> {
  let posts: SakagramPost[];
  try {
    const { data: entries, error } = await supabase
      .from('hiking_journals')
      .select('*')
      .eq('viewpoint_id', viewpointId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Unable to load Sakagram posts: ${error.message}`);
    if (!entries?.length) {
      posts = [];
    } else {
      const entryIds = entries.map((e) => e.id);
      const { data: likes, error: likeError } = await supabase
        .from('journal_entry_likes')
        .select('journal_entry_id, user_id')
        .in('journal_entry_id', entryIds);
      if (likeError) throw new Error(`Unable to load likes: ${likeError.message}`);

      const userIds = Array.from(new Set(entries.map((e) => e.user_id)));
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      if (profilesError) throw new Error(`Unable to load post authors: ${profilesError.message}`);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const likeCountMap = new Map<string, number>();
      const likedByMeSet = new Set<string>();

      for (const like of likes ?? []) {
        likeCountMap.set(like.journal_entry_id, (likeCountMap.get(like.journal_entry_id) ?? 0) + 1);
        if (currentUserId && like.user_id === currentUserId) {
          likedByMeSet.add(like.journal_entry_id);
        }
      }

      posts = entries.map((entry) => {
        const profile = profileMap.get(entry.user_id);
        return {
          ...(entry as JournalEntry),
          authorName: profile?.full_name ?? 'Hiker',
          authorAvatarUrl: profile?.avatar_url ?? null,
          likeCount: likeCountMap.get(entry.id) ?? 0,
          likedByMe: likedByMeSet.has(entry.id),
        };
      });
    }
    await AsyncStorage.setItem(`${SAKAGRAM_CACHE_PREFIX}${viewpointId}`, JSON.stringify(posts));
  } catch (error) {
    console.warn('[Sakagram] Remote feed unavailable; using device cache:', error);
    const raw = await AsyncStorage.getItem(`${SAKAGRAM_CACHE_PREFIX}${viewpointId}`);
    if (!raw) throw new Error('Sakagram is unavailable offline until it has been loaded online.');
    const cached: unknown = JSON.parse(raw);
    if (!Array.isArray(cached)) throw new Error('Saved Sakagram feed is invalid.');
    posts = cached as SakagramPost[];
  }

  if (currentUserId) {
    const ownPending = await fetchPendingPublicJournalEntries(currentUserId, viewpointId);
    const ownPendingPosts: SakagramPost[] = ownPending.map((entry) => ({
      ...entry,
      authorName: 'You',
      authorAvatarUrl: null,
      likeCount: 0,
      likedByMe: false,
    }));
    const merged = new Map(posts.map((post) => [post.id, post]));
    for (const post of ownPendingPosts) merged.set(post.id, post);
    posts = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return applyPendingLikes(posts, currentUserId);
}

export async function toggleJournalLike(
  journalEntryId: string,
  liked: boolean,
): Promise<void> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (userError || !user) throw new Error('You must be signed in to like posts.');

  const queue = await readLikeQueue();
  const queuedLike: QueuedLike = {
    userId: user.id,
    journalEntryId,
    liked,
    queuedAt: Date.now(),
  };

  try {
    await sendJournalLike(user.id, journalEntryId, liked);
    await AsyncStorage.setItem(
      SAKAGRAM_LIKE_QUEUE_KEY,
      JSON.stringify(queue.filter((item) => (
        item.userId !== user.id || item.journalEntryId !== journalEntryId
      ))),
    );
    notifySakagramSync();
  } catch (error) {
    const existingIndex = queue.findIndex((item) => (
      item.userId === user.id && item.journalEntryId === journalEntryId
    ));
    if (existingIndex >= 0) queue[existingIndex] = queuedLike;
    else queue.push(queuedLike);
    await AsyncStorage.setItem(SAKAGRAM_LIKE_QUEUE_KEY, JSON.stringify(queue));
    notifySakagramSync();
    console.warn('[Sakagram] Like saved for later sync:', error);
  }
}

async function sendJournalLike(userId: string, journalEntryId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from('journal_entry_likes')
      .insert({ journal_entry_id: journalEntryId, user_id: userId });
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('journal_entry_likes')
      .delete()
      .eq('journal_entry_id', journalEntryId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

export async function flushSakagramLikeQueue(): Promise<number> {
  const queue = await readLikeQueue();
  const remaining: QueuedLike[] = [];
  let synced = 0;
  for (const item of queue) {
    try {
      await sendJournalLike(item.userId, item.journalEntryId, item.liked);
      synced += 1;
    } catch (error) {
      console.warn('[Sakagram] Like sync failed; will retry:', error);
      remaining.push(item);
    }
  }
  await AsyncStorage.setItem(SAKAGRAM_LIKE_QUEUE_KEY, JSON.stringify(remaining));
  notifySakagramSync();
  return synced;
}

export async function getPendingSakagramLikeIds(userId: string): Promise<string[]> {
  return (await readLikeQueue())
    .filter((item) => item.userId === userId)
    .map((item) => item.journalEntryId);
}