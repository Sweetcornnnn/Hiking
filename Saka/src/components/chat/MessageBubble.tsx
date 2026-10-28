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
import type { ReactionSummary } from '../../utils/reactions';
import { REACTION_EMOJI } from '../../utils/reactionTypes';
import type { ReactionType } from '../../utils/reactionTypes';

export type MessageBubbleProps = {
  content: string;
  time: string;
  isMe: boolean;

  isRead?: boolean;
  showReadReceipt?: boolean;
  edited?: boolean;
  deliveryStatus?: 'pending' | 'failed';

  hasReply?: boolean;
  replyCaption?: string;
  replyPreview?: string;

  reaction?: ReactionType | null;
  reactionSummaries?: ReactionSummary[];
  onPressReactions?: () => void;

  avatarUri?: string | null;
  avatarLabel?: string;
  avatarColorSeed?: string;
  showAvatar?: boolean;
  avatarOffsetY?: number;
  disableAvatarLift?: boolean; // kept for API compatibility, no longer used

  senderName?: string;
  senderColorSeed?: string;
  showSenderHeader?: boolean;
  senderAvatarUrl?: string | null;

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
  deliveryStatus,
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
  avatarOffsetY = 0,
  // disableAvatarLift is accepted but unused — avatar sits at bubble bottom
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disableAvatarLift: _disableAvatarLift = false,
  senderName = '',
  senderColorSeed = '',
  showSenderHeader = false,
  senderAvatarUrl: _senderAvatarUrl,
  onPressSender,
  onPressBubble,
  onLongPressBubble,
}: MessageBubbleProps) {
  const { width } = useWindowDimensions();

  const reserved = isMe ? 24 : showAvatar ? 40 : 24;
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
      {/* Avatar — left column, bottom aligned with bubble */}
      {!isMe && showAvatar && (
        <TouchableOpacity
          disabled={!onPressSender}
          onPress={onPressSender}
          activeOpacity={0.7}
          style={[styles.avatarColumn, { transform: [{ translateY: avatarOffsetY }] }]}
        >
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
        </TouchableOpacity>
      )}

      {/* Message stack: name on top, bubble below */}
      <View
        style={[
          styles.stack,
          isMe ? styles.stackMe : styles.stackOther,
          { maxWidth: bubbleMaxWidth },
        ]}
      >
        {/* Sender name — top of bubble, text only (no mini avatar) */}
        {showSenderHeader && !isMe && senderName ? (
          <TouchableOpacity
            style={styles.senderRow}
            onPress={onPressSender}
            disabled={!onPressSender}
            activeOpacity={0.7}
          >
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
          {deliveryStatus ? (
            <Text style={styles.deliveryStatus}>
              {deliveryStatus === 'failed' ? '· retry' : '· queued'}
            </Text>
          ) : null}
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
    alignItems: 'flex-end', // avatar sits at the bottom
    gap: 8,
    alignSelf: 'stretch',
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  // Avatar column — bottom aligned with the bubble, not the footer
  avatarColumn: {
    alignSelf: 'flex-end',
    marginBottom: 16, // offset so avatar bottom aligns with bubble bottom (footer is ~20px)
  },

  avatar: {
    width: 25,
    height: 25,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  stack: { flexShrink: 1, minWidth: 0 },
  stackMe: { alignItems: 'flex-end' },
  stackOther: { alignItems: 'flex-start', flexGrow: 1 },

  // Sender name — top of bubble, no mini avatar
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: 0.1,
    maxWidth: 220,
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
  deliveryStatus: {
    fontSize: 9,
    color: ACCENT_GOLD,
  },
  readSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});