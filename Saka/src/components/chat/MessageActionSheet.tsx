// components/chat/MessageActionSheet.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CHAT_BG,
  CHAT_BORDER,
  CHAT_DANGER,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../theme/designTokens';
import { REACTION_EMOJI, ReactionType } from './MessageBubble';

// Order matches Meta's picker: heart, like, haha, wow, sad, angry.
const REACTIONS: ReactionType[] = [
  'heart',
  'like',
  'haha',
  'wow',
  'sad',
  'angry',
];

export type MessageActionSheetProps = {
  visible: boolean;
  isMe: boolean;
  currentReaction?: ReactionType | null;
  onClose: () => void;
  onReact: (r: ReactionType) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onUnsend?: () => void;
  onCopy?: () => void;
};

export default function MessageActionSheet({
  visible,
  isMe,
  currentReaction = null,
  onClose,
  onReact,
  onReply,
  onEdit,
  onUnsend,
  onCopy,
}: MessageActionSheetProps) {
  // Card slide-up + fade
  const cardAnim = useRef(new Animated.Value(0)).current;
  // Backdrop fade
  const backdropAnim = useRef(new Animated.Value(0)).current;
  // Emoji scale-in animations — one per reaction
  const emojiAnims = useRef(
    REACTIONS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (visible) {
      // Reset
      cardAnim.setValue(0);
      backdropAnim.setValue(0);
      emojiAnims.forEach((v) => v.setValue(0));

      // Backdrop fades in fast
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Card slides up + fades in together
      Animated.spring(cardAnim, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }).start();

      // Emoji pop-in, staggered ~35ms apart, all starting slightly after
      // the card begins moving so the card is visible first.
      Animated.stagger(
        35,
        emojiAnims.map((v) =>
          Animated.spring(v, {
            toValue: 1,
            speed: 16,
            bounciness: 10,
            useNativeDriver: true,
          })
        )
      ).start();
    } else {
      // Fade out on close
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, cardAnim, backdropAnim, emojiAnims]);

  const showReply = !!onReply;
  const showEdit = isMe && !!onEdit;
  const showCopy = !!onCopy;
  const showUnsend = isMe && !!onUnsend;

  // Card slide-up: 0 → 1 maps to translateY 40 → 0
  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop — own animated fade so it dims in sync with the card */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: backdropAnim },
        ]}
      >
        <Pressable style={styles.backdropTap} onPress={onClose} />
      </Animated.View>

      <View style={styles.backdropLayout} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* ── Reaction row ── */}
          <View style={styles.reactionsRow}>
            {REACTIONS.map((r, i) => {
              const active = currentReaction === r;
              const emojiScale = emojiAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              });
              return (
                <Animated.View
                  key={r}
                  style={{
                    opacity: emojiAnims[i],
                    transform: [{ scale: emojiScale }],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => onReact(r)}
                    style={[
                      styles.reactionBtn,
                      active && styles.reactionBtnActive,
                    ]}
                    activeOpacity={0.75}
                    hitSlop={4}
                  >
                    <Text style={styles.reactionEmoji}>
                      {REACTION_EMOJI[r]}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* ── Reply (others' messages) ── */}
          {showReply && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onReply}
              activeOpacity={0.75}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={18}
                color={TEXT_PRIMARY}
              />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
          )}

          {/* ── Edit (own messages) ── */}
          {showEdit && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onEdit}
              activeOpacity={0.75}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={TEXT_PRIMARY}
              />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}

          {/* ── Copy (always) ── */}
          {showCopy && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onCopy}
              activeOpacity={0.75}
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color={TEXT_PRIMARY}
              />
              <Text style={styles.actionText}>Copy</Text>
            </TouchableOpacity>
          )}

          {/* ── Unsend (own messages) ── */}
          {showUnsend && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onUnsend}
              activeOpacity={0.75}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={CHAT_DANGER}
              />
              <Text style={[styles.actionText, { color: CHAT_DANGER }]}>
                Unsend
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionRow, styles.cancelRow]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionText, { color: TEXT_MUTED }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropTap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropLayout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: CHAT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },

  // ── Reaction row — 6 emoji, tighter packing ──
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reactionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBtnActive: {
    backgroundColor: 'rgba(201,169,110,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.42)',
  },
  reactionEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CHAT_BORDER,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  cancelRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAT_BORDER,
    justifyContent: 'center',
    paddingVertical: 12,
  },
});