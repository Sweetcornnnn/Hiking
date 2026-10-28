// utils/reactions.ts
import type { ReactionType } from './reactionTypes';

export type ReactionRow = {
  id: number | string;
  message_id: number;
  user_id: string;
  reaction: ReactionType;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export type ReactionSummary = {
  emoji: ReactionType;
  count: number;
  users: ReactionRow[];
  mine: boolean;
};

/**
 * Collapse a flat list of reaction rows into per-emoji summaries, ordered
 * by count desc (most-reacted first). Used by both the message bubble chip
 * and the "who reacted" modal.
 */
export function summarizeReactions(
  rows: ReactionRow[],
  currentUserId: string | null | undefined
): ReactionSummary[] {
  const byEmoji = new Map<ReactionType, ReactionRow[]>();
  for (const r of rows) {
    const list = byEmoji.get(r.reaction) || [];
    list.push(r);
    byEmoji.set(r.reaction, list);
  }

  const summaries: ReactionSummary[] = [];
  for (const [emoji, list] of byEmoji.entries()) {
    summaries.push({
      emoji,
      count: list.length,
      users: list,
      mine: !!currentUserId && list.some((r) => r.user_id === currentUserId),
    });
  }

  summaries.sort((a, b) => b.count - a.count);
  return summaries;
}