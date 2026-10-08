import React, { useEffect, useMemo, useState } from 'react';
import {
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
} from '../../theme/designTokens';

interface Props {
  viewpointId: string;
  viewpointName?: string;
  mountainId?: string;
  /** True when Sakagram fills the screen; bumps type and spacing up. */
  focused?: boolean;
}

export default function SakagramSection({ viewpointId, viewpointName, mountainId, focused = false }: Props) {
  const router = useRouter();
  const s = useMemo(() => makeStyles(focused), [focused]);
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
    <View style={s.section}>
      <View style={s.header}>
        <View style={s.headingGroup}>
          <View style={s.titleRow}>
            <View style={s.logoMark}>
              <Ionicons name="camera" size={focused ? 15 : 12} color={ACCENT_GOLD} />
            </View>
            <Text style={s.title}>Sakagram</Text>
            {!isLoading && !loadError && (
              <Text style={s.count}>{posts.length}</Text>
            )}
          </View>
          <Text style={s.subtitle} numberOfLines={1}>
            {viewpointName ? `Photos from ${viewpointName}` : 'Photos shared from this stop'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAddPhoto}
          style={s.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add a Journal photo to Sakagram"
        >
          <Ionicons name="add" size={focused ? 17 : 14} color="#0E1520" />
          <Text style={s.addButtonText}>Add photo</Text>
        </TouchableOpacity>
      </View>

      {likeError && <Text style={s.inlineError}>{likeError}</Text>}

      {isLoading ? (
        <View accessibilityLabel="Loading Sakagram posts">
          {[0, 1].map((item) => (
            <View key={item} style={s.skeleton}>
              <View style={s.skeletonAuthor}>
                <View style={s.skeletonAvatar} />
                <View style={s.skeletonText} />
              </View>
              <View style={s.skeletonPhoto} />
              <View style={s.skeletonTextWide} />
            </View>
          ))}
        </View>
      ) : loadError ? (
        <View style={s.messageState}>
          <Ionicons name="cloud-offline-outline" size={22} color={TEXT_MUTED} />
          <Text style={s.messageText}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => setReloadKey((value) => value + 1)}
            style={s.retryButton}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={13} color={ACCENT_GOLD} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={s.messageState}>
          <View style={s.emptyIcon}>
            <Ionicons name="camera-outline" size={18} color={ACCENT_GOLD} />
          </View>
          <Text style={s.emptyTitle}>No Sakagram posts yet</Text>
          <Text style={s.messageText}>
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
              locationLabel={viewpointName}
              focused={focused}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// Sizes scale up when Sakagram is the focus of the screen.
function makeStyles(focused: boolean) {
  const f = (n: number) => Math.round(n * (focused ? 1.3 : 1));

  return StyleSheet.create({
    section: { marginHorizontal: 12, marginTop: 14, marginBottom: 4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: f(14), paddingBottom: f(12), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER_SUBTLE },
    headingGroup: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoMark: { width: f(24), height: f(24), alignItems: 'center', justifyContent: 'center', borderRadius: f(8), borderWidth: 1.5, borderColor: ACCENT_GOLD },
    title: { color: TEXT_PRIMARY, fontSize: f(15), fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.3 },
    count: { color: TEXT_MUTED, fontSize: f(10), fontWeight: '700' },
    subtitle: { color: TEXT_FAINT, fontSize: f(9), marginTop: 3 },
    addButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: f(11), borderRadius: 999, backgroundColor: ACCENT_GOLD },
    addButtonText: { color: '#0E1520', fontSize: f(10), fontWeight: '800' },
    inlineError: { color: TEXT_DANGER, fontSize: f(10), lineHeight: f(15), marginBottom: 8 },
    skeleton: { marginBottom: f(22) },
    skeletonAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    skeletonAvatar: { width: f(32), height: f(32), borderRadius: f(16), backgroundColor: BG_AVATAR },
    skeletonText: { width: '42%', height: 9, borderRadius: 5, backgroundColor: BG_AVATAR },
    skeletonPhoto: { width: '100%', aspectRatio: 1, maxHeight: 260, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
    skeletonTextWide: { width: '72%', height: 9, borderRadius: 5, marginTop: 9, backgroundColor: BG_AVATAR },
    messageState: { alignItems: 'center', justifyContent: 'center', paddingVertical: f(22), paddingHorizontal: 14, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 6 },
    emptyIcon: { width: f(40), height: f(40), alignItems: 'center', justifyContent: 'center', borderRadius: f(20), backgroundColor: BG_SUBTLE, borderWidth: 1.5, borderColor: BORDER_GOLD },
    emptyTitle: { color: TEXT_PRIMARY, fontSize: f(11), fontWeight: '700' },
    messageText: { color: TEXT_MUTED, fontSize: f(10), lineHeight: f(15), textAlign: 'center' },
    retryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, marginTop: 2 },
    retryText: { color: ACCENT_GOLD, fontSize: f(10), fontWeight: '700' },
  });
}