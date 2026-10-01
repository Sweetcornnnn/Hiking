import { supabase } from '../lib/supabase';
import type { JournalEntry } from '../types/journal';

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
  // 1. Fetch public journal entries for this viewpoint
  const { data: entries, error } = await supabase
    .from('hiking_journals')
    .select('*')
    .eq('viewpoint_id', viewpointId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Unable to load Sakagram posts: ${error.message}`);
  if (!entries?.length) return [];

  const entryIds = entries.map((e) => e.id);

  // 2. Fetch like counts for these entries
  const { data: likes, error: likeError } = await supabase
    .from('journal_entry_likes')
    .select('journal_entry_id, user_id')
    .in('journal_entry_id', entryIds);

  if (likeError) throw new Error(`Unable to load likes: ${likeError.message}`);

  // 3. Fetch author profiles (use whatever profile table/join your app already uses;
  //    if you have a `profiles` table keyed by user_id, adjust the query below)
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')                        // <-- confirm actual table name
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const likeCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();

  for (const like of likes ?? []) {
    likeCountMap.set(like.journal_entry_id, (likeCountMap.get(like.journal_entry_id) ?? 0) + 1);
    if (currentUserId && like.user_id === currentUserId) {
      likedByMeSet.add(like.journal_entry_id);
    }
  }

  return entries.map((entry) => {
    const profile = profileMap.get(entry.user_id);
    return {
      ...(entry as JournalEntry),
      authorName: profile?.display_name ?? 'Hiker',
      authorAvatarUrl: profile?.avatar_url ?? null,
      likeCount: likeCountMap.get(entry.id) ?? 0,
      likedByMe: likedByMeSet.has(entry.id),
    };
  });
}

export async function toggleJournalLike(
  journalEntryId: string,
  liked: boolean,
): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('You must be signed in to like posts.');

  if (liked) {
    const { error } = await supabase
      .from('journal_entry_likes')
      .insert({ journal_entry_id: journalEntryId, user_id: user.id });
    // Duplicate-like is idempotent — ignore 23505
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('journal_entry_likes')
      .delete()
      .eq('journal_entry_id', journalEntryId)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }
}