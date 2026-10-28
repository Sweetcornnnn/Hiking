export type ReactionType = 'heart' | 'like' | 'haha' | 'wow' | 'sad' | 'angry';

export const REACTION_EMOJI: Record<ReactionType, string> = {
  heart: '❤️',
  like: '👍',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};
