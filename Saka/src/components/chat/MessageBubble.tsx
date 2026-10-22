// components/chat/MessageBubble.tsx
import React, { memo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_RADIUS_BUBBLE,
  CHAT_FS_BODY,
  CHAT_FS_META,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import ReactionChip from './ReactionChip';
import { ReactionSummary } from '../../utils/reactions';

export type ReactionType = 'heart' | 'like' | 'haha' | 'wow' | 'sad' | 'angry';

// Emoji map — kept here so the picker and the badge stay in sync.
export const REACTION_EMOJI: Record<ReactionType, string> = {
  heart: '❤️',
  like: '👍',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

export type MessageBubbleProps = {
  content: string;
  time: string;
  isMe: boolean;

  // ── optional: read receipts (DMs only) ──
  isRead?: boolean;
  showReadReceipt?: boolean;

  // ── optional: edited tag ──
  edited?: boolean;

  // ── optional: reply preview ──
  hasReply?: boolean;
  replyCaption?: string;
  replyPreview?: string;

  // ── optional: single-reaction badge (legacy, replaced by reactionSummaries) ──
  reaction?: ReactionType | null;

  // ── optional: multi-user reactions ──
  reactionSummaries?: ReactionSummary[];
  onPressReactions?: () => void;

  // ── optional: left avatar (DMs, other user only) ──
  avatarUri?: string | null;
  avatarLabel?: string;
  avatarColorSeed?: string;
  showAvatar?: boolean;

  // ── optional: sender header (group chats / world chat) ──
  senderName?: string;
  senderColorSeed?: string;
  showSenderHeader?: boolean;

  // ── optional: press handlers ──
  onPressSender?: () => void;
  onPressBubble?: () => void;
  onLongPressBubble?: () => void;
};

function MessageBubbleBase({
  content,
  time,
  isMe,
  isRead = false,
  showReadReceipt = true,
  edited = false,
  hasReply = false,
  replyCaption = '',
  replyPreview = '',
  reaction = null,
  reactionSummaries,
  onPressReactions,
  avatarUri,
  avatarLabel = '?',
  avatarColorSeed = '',
  showAvatar = true,
  senderName = '',
  senderColorSeed = '',
  showSenderHeader = false,
  onPressSender,
  onPressBubble,
  onLongPressBubble,
}: MessageBubbleProps) {
  const { width } = useWindowDimensions();

  const reserved = isMe ? 24 : showAvatar ? 58 : 24;
  const rowAvailableWidth = width - reserved;
  const bubbleMaxWidth = Math.max(
    0,
    Math.min(width * 0.75, rowAvailableWidth)
  );
  const replyMaxWidth = width * 0.68;

  const hasChip = !!reactionSummaries && reactionSummaries.length > 0;
  const hasLegacyReaction = !hasChip && !!reaction;
  const anyReaction = hasChip || hasLegacyReaction;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
      {!isMe && showAvatar && (
        <View
          style={[
            styles.avatar,
            { backgroundColor: getAvatarColor(avatarColorSeed) },
          ]}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(avatarLabel)}</Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.stack,
          isMe ? styles.stackMe : styles.stackOther,
          { maxWidth: bubbleMaxWidth },
        ]}
      >
        {showSenderHeader && !isMe && senderName ? (
          <TouchableOpacity
            style={styles.senderRow}
            onPress={onPressSender}
            disabled={!onPressSender}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.smallAvatar,
                {
                  backgroundColor: getAvatarColor(
                    senderColorSeed || senderName
                  ),
                },
              ]}
            >
              <Text style={styles.smallAvatarText}>
                {getInitials(senderName)}
              </Text>
            </View>
            <Text style={styles.senderName} numberOfLines={1}>
              {senderName}
            </Text>
          </TouchableOpacity>
        ) : null}

        {hasReply && (
          <>
            <View
              style={[
                styles.replyCaptionRow,
                { alignSelf: isMe ? 'flex-end' : 'flex-start' },
              ]}
            >
              <Ionicons name="arrow-undo" size={10} color={TEXT_MUTED} />
              <Text style={styles.replyCaption} numberOfLines={1}>
                {replyCaption}
              </Text>
            </View>

            <View
              style={[
                styles.replyPreview,
                {
                  maxWidth: replyMaxWidth,
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                },
              ]}
            >
              <View style={styles.replyPreviewAccent} />
              <Text
                style={styles.replyPreviewText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {replyPreview}
              </Text>
            </View>
          </>
        )}

        <View style={styles.bubbleWrap}>
          <TouchableOpacity
            activeOpacity={onPressBubble || onLongPressBubble ? 0.9 : 1}
            onPress={onPressBubble}
            onLongPress={onLongPressBubble}
            delayLongPress={350}
            disabled={!onPressBubble && !onLongPressBubble}
          >
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleOther,
                { maxWidth: bubbleMaxWidth },
                anyReaction && styles.bubbleWithReaction,
              ]}
            >
              <Text
                style={[
                  styles.text,
                  { color: isMe ? CHAT_BG : TEXT_PRIMARY },
                  isMe && styles.textMe,
                ]}
              >
                {content}
              </Text>
            </View>
          </TouchableOpacity>

          {hasChip ? (
            <ReactionChip
              summaries={reactionSummaries!}
              onPress={onPressReactions ?? (() => {})}
              isMe={isMe}
            />
          ) : hasLegacyReaction ? (
            <View
              style={[
                styles.reactionBadge,
                isMe ? styles.reactionBadgeMe : styles.reactionBadgeOther,
              ]}
              pointerEvents="none"
            >
              <Text style={styles.reactionEmoji}>
                {REACTION_EMOJI[reaction!]}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.footer,
            { alignSelf: isMe ? 'flex-end' : 'flex-start' },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.time}>
            {time}
            {edited ? ' · edited' : ''}
          </Text>
          {isMe && showReadReceipt && (
            <View style={styles.readSlot}>
              <Ionicons
                name={isRead ? 'checkmark-done' : 'checkmark'}
                size={11}
                color={isRead ? CHAT_ONLINE : 'rgba(255,255,255,0.35)'}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    alignSelf: 'stretch',
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -20 }],
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  stack: { flexShrink: 1, minWidth: 0 },
  stackMe: { alignItems: 'flex-end' },
  stackOther: { alignItems: 'flex-start', flexGrow: 1 },

  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    marginLeft: 2,
  },
  smallAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: { color: '#fff', fontSize: 8.5, fontWeight: '700' },
  senderName: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.3,
    maxWidth: 180,
  },

  replyCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 2,
    opacity: 0.55,
    transform: [{ translateY: 3 }],
  },
  replyCaption: { fontSize: 9, fontWeight: '600', color: TEXT_MUTED },

  replyPreview: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginTop: 4,
    marginBottom: -8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: CHAT_BORDER,
  },
  replyPreviewAccent: {
    width: 2,
    borderRadius: 1,
    backgroundColor: ACCENT_GOLD,
  },
  replyPreviewText: {
    fontSize: 11,
    marginTop: 2,
    flexShrink: 1,
    color: TEXT_MUTED,
  },

  bubbleWrap: { position: 'relative' },
  bubble: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: CHAT_RADIUS_BUBBLE,
    marginVertical: 1,
  },
  bubbleWithReaction: { paddingBottom: 10 },
  bubbleMe: {
    backgroundColor: ACCENT_GOLD,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: CHAT_SUBTLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
  },
  text: {
    fontSize: CHAT_FS_BODY,
    lineHeight: 17,
    flexShrink: 1,
  },
  textMe: { fontWeight: '600' },

  // Legacy single-reaction badge (used only when summaries aren't provided)
  reactionBadge: {
    position: 'absolute',
    bottom: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHAT_BG,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionBadgeMe: { right: -2 },
  reactionBadgeOther: { left: -2 },
  reactionEmoji: { fontSize: 11, lineHeight: 13 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  time: {
    fontSize: CHAT_FS_META,
    color: TEXT_MUTED,
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  readSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});