import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  fetchSakagramPosts,
  toggleJournalLike,
  type SakagramPost,
} from '../../services/sakagramService';
import SakagramPostCard from './SakagramPostCard';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  BORDER_GOLD,
  BORDER_SUBTLE,
  RADIUS_BTN,
  RADIUS_CARD,
  TEXT_DANGER,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

interface Props {
  viewpointId: string;
  viewpointName?: string;
  mountainId?: string;
}

export default function SakagramSection({ viewpointId, viewpointName, mountainId }: Props) {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [posts, setPosts] = useState<SakagramPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    void fetchSakagramPosts(viewpointId, currentUserId)
      .then((nextPosts) => {
        if (active) setPosts(nextPosts);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load Sakagram.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [viewpointId, currentUserId, reloadKey]);

  const handleAddPhoto = () => {
    if (!currentUserId) {
      router.replace('/Login');
      return;
    }

    router.push({
      pathname: '/journal',
      params: mountainId ? { viewpointId, mountainId } : { viewpointId },
    });
  };

  const handleToggleLike = async (postId: string, liked: boolean) => {
    if (!currentUserId) {
      router.replace('/Login');
      return;
    }

    const previousPost = posts.find((post) => post.id === postId);
    if (!previousPost || pendingLikeIds.has(postId)) return;

    setLikeError(null);
    setPendingLikeIds((current) => new Set(current).add(postId));
    setPosts((current) => current.map((post) => (
      post.id === postId
        ? {
            ...post,
            likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)),
            likedByMe: liked,
          }
        : post
    )));

    try {
      await toggleJournalLike(postId, liked);
    } catch (error: unknown) {
      setPosts((current) => current.map((post) => (
        post.id === postId
          ? {
              ...post,
              likeCount: previousPost.likeCount,
              likedByMe: previousPost.likedByMe,
            }
          : post
      )));
      setLikeError(error instanceof Error ? error.message : 'Unable to update like.');
    } finally {
      setPendingLikeIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headingGroup}>
          <View style={styles.titleRow}>
            <View style={styles.accent} />
            <Text style={styles.title}>Sakagram</Text>
            {!isLoading && !loadError && (
              <Text style={styles.count}>{posts.length}</Text>
            )}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {viewpointName ? `Photos from ${viewpointName}` : 'Photos shared from this stop'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAddPhoto}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add a Journal photo to Sakagram"
        >
          <Ionicons name="camera-outline" size={14} color={ACCENT_GOLD} />
          <Text style={styles.addButtonText}>Add photo</Text>
        </TouchableOpacity>
      </View>

      {likeError && <Text style={styles.inlineError}>{likeError}</Text>}

      {isLoading ? (
        <View accessibilityLabel="Loading Sakagram posts">
          {[0, 1].map((item) => (
            <View key={item} style={styles.skeleton}>
              <View style={styles.skeletonAuthor}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonText} />
              </View>
              <View style={styles.skeletonPhoto} />
              <View style={styles.skeletonTextWide} />
            </View>
          ))}
        </View>
      ) : loadError ? (
        <View style={styles.messageState}>
          <Ionicons name="cloud-offline-outline" size={22} color={TEXT_MUTED} />
          <Text style={styles.messageText}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => setReloadKey((value) => value + 1)}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={13} color={ACCENT_GOLD} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.messageState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="camera-outline" size={18} color={ACCENT_GOLD} />
          </View>
          <Text style={styles.emptyTitle}>No Sakagram posts yet</Text>
          <Text style={styles.messageText}>
            Be the first to share a photo from this viewpoint.
          </Text>
        </View>
      ) : (
        <View>
          {posts.map((post) => (
            <SakagramPostCard
              key={post.id}
              post={post}
              onToggleLike={handleToggleLike}
              isLikePending={pendingLikeIds.has(post.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 12, marginTop: 14, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  headingGroup: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  accent: { width: 3, height: 15, borderRadius: 2, backgroundColor: ACCENT_GOLD },
  title: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '800' },
  count: { color: TEXT_MUTED, fontSize: 10, fontWeight: '700' },
  subtitle: { color: TEXT_FAINT, fontSize: 9, marginTop: 3, marginLeft: 10 },
  addButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, borderRadius: RADIUS_BTN, borderWidth: 1, borderColor: BORDER_GOLD, backgroundColor: BG_SUBTLE },
  addButtonText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
  inlineError: { color: TEXT_DANGER, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  skeleton: { padding: 9, marginBottom: 9, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT, backgroundColor: BG_PANEL },
  skeletonAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  skeletonAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: BG_AVATAR },
  skeletonText: { width: '42%', height: 9, borderRadius: 5, backgroundColor: BG_AVATAR },
  skeletonPhoto: { width: '100%', aspectRatio: 1, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
  skeletonTextWide: { width: '72%', height: 9, borderRadius: 5, marginTop: 9, backgroundColor: BG_AVATAR },
  messageState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 14, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT, backgroundColor: BG_PANEL, gap: 6 },
  emptyIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_GOLD },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '700' },
  messageText: { color: TEXT_MUTED, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, marginTop: 2 },
  retryText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
});