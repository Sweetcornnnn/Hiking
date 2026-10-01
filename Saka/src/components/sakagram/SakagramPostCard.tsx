import React, { useState } from 'react';
import {
  Image as NativeImage,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { SakagramPost } from '../../services/sakagramService';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BG_PANEL,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_BTN,
  RADIUS_CARD,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

interface Props {
  post: SakagramPost;
  onToggleLike: (id: string, liked: boolean) => void | Promise<void>;
  onPressAuthor?: (userId: string) => void;
  isLikePending?: boolean;
}

export default function SakagramPostCard({
  post,
  onToggleLike,
  onPressAuthor,
  isLikePending = false,
}: Props) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = getInitials(post.authorName);
  const photoUri = post.images?.[0];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => onPressAuthor?.(post.user_id)}
        disabled={!onPressAuthor}
        style={styles.authorRow}
        accessibilityRole={onPressAuthor ? 'button' : undefined}
        accessibilityLabel={onPressAuthor ? `View ${post.authorName}'s profile` : undefined}
      >
        <View style={styles.avatar}>
          {post.authorAvatarUrl && !avatarFailed ? (
            <NativeImage
              source={{ uri: post.authorAvatarUrl }}
              style={styles.avatarImage}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
        </View>
        <View style={styles.authorText}>
          <Text style={styles.authorName} numberOfLines={1}>{post.authorName}</Text>
          <Text style={styles.timestamp}>{formatRelativeTime(post.created_at)}</Text>
        </View>
        <Ionicons name="location-outline" size={13} color={TEXT_MUTED} />
      </TouchableOpacity>

      {photoUri && !photoFailed ? (
        <ExpoImage
          source={{ uri: photoUri }}
          style={styles.photo}
          contentFit="cover"
          transition={120}
          onError={() => setPhotoFailed(true)}
          accessibilityLabel={`Photo shared by ${post.authorName}`}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
          <Text style={styles.placeholderText}>Photo unavailable</Text>
        </View>
      )}

      <View style={styles.caption}>
        <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
        {!!post.content && (
          <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
        )}
      </View>

      <View style={styles.likeRow}>
        <Pressable
          onPress={() => void onToggleLike(post.id, !post.likedByMe)}
          disabled={isLikePending}
          style={styles.likeButton}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Unlike journal entry' : 'Like journal entry'}
          accessibilityState={{ selected: post.likedByMe, disabled: isLikePending }}
        >
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={17}
            color={post.likedByMe ? ACCENT_GOLD : TEXT_SECONDARY}
          />
          <Text style={styles.likeCount}>{post.likeCount}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'H';
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, padding: 9, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT, backgroundColor: BG_PANEL },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 30 },
  avatar: { width: 28, height: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: ACCENT_GOLD, fontSize: 9, fontWeight: '800' },
  authorText: { flex: 1, minWidth: 0 },
  authorName: { color: TEXT_PRIMARY, fontSize: 10, fontWeight: '700' },
  timestamp: { color: TEXT_FAINT, fontSize: 8, marginTop: 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
  photoPlaceholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
  placeholderText: { color: TEXT_MUTED, fontSize: 9 },
  caption: { paddingTop: 8 },
  postTitle: { color: TEXT_PRIMARY, fontSize: 10, fontWeight: '800' },
  postContent: { color: TEXT_SECONDARY, fontSize: 9, lineHeight: 14, marginTop: 3 },
  likeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  likeButton: { minWidth: 40, minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 3 },
  likeCount: { color: TEXT_SECONDARY, fontSize: 9, fontWeight: '700' },
});