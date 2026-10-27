import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image as NativeImage,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { SakagramPost } from '../../services/sakagramService';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BORDER_SUBTLE,
  RADIUS_BTN,
  TEXT_DANGER,
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
  isLikeQueued?: boolean;
  locationLabel?: string;
  focused?: boolean;
}

const DOUBLE_TAP_MS = 300;
const LONG_CAPTION_CHARS = 90;

export default function SakagramPostCard({
  post,
  onToggleLike,
  onPressAuthor,
  isLikePending = false,
  isLikeQueued = false,
  locationLabel,
  focused = false,
}: Props) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const s = useMemo(() => makeStyles(focused), [focused]);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastTap = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const initials = getInitials(post.authorName);
  const images = useMemo(
    () =>
      (Array.isArray(post.images) ? post.images : [])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0),
    [post.images],
  );
  const isMulti = images.length > 1;
  const photoMaxHeight = windowHeight * 0.72;
  const hasLongCaption = (post.content?.length ?? 0) > LONG_CAPTION_CHARS;

  const popHeart = () => {
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(heartAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handlePhotoPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      popHeart();
      if (!post.likedByMe && !isLikePending) {
        void onToggleLike(post.id, true);
      }
    } else {
      lastTap.current = now;
    }
  };

  const pressRef = useRef(handlePhotoPress);
  pressRef.current = handlePhotoPress;
  const stablePhotoPress = useCallback(() => pressRef.current(), []);

  const likesLabel =
    post.likeCount === 0
      ? 'Be the first to like this'
      : `${post.likeCount} ${post.likeCount === 1 ? 'like' : 'likes'}`;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <TouchableOpacity
          onPress={() => onPressAuthor?.(post.user_id)}
          disabled={!onPressAuthor}
          style={s.authorRow}
          accessibilityRole={onPressAuthor ? 'button' : undefined}
          accessibilityLabel={onPressAuthor ? `View ${post.authorName}'s profile` : undefined}
        >
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              {post.authorAvatarUrl && !avatarFailed ? (
                <NativeImage
                  source={{ uri: post.authorAvatarUrl }}
                  style={s.avatarImage}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <Text style={s.avatarInitials}>{initials}</Text>
              )}
            </View>
          </View>
          <View style={s.authorText}>
            <Text style={s.authorName} numberOfLines={1}>{post.authorName}</Text>
            {!!locationLabel && (
              <Text style={s.location} numberOfLines={1}>{locationLabel}</Text>
            )}
          </View>
        </TouchableOpacity>

        <Pressable
          onPress={() => void onToggleLike(post.id, !post.likedByMe)}
          disabled={isLikePending}
          style={s.likeButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Unlike journal entry' : 'Like journal entry'}
          accessibilityState={{ selected: post.likedByMe, disabled: isLikePending }}
        >
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={focused ? 28 : 22}
            color={post.likedByMe ? TEXT_DANGER : TEXT_PRIMARY}
          />
        </Pressable>
      </View>

      {images.length === 0 || (!isMulti && photoFailed) ? (
        <View style={[s.photoPlaceholder, { maxHeight: photoMaxHeight }]}>
          <Ionicons name="image-outline" size={focused ? 32 : 24} color={TEXT_MUTED} />
          <Text style={s.placeholderText}>Photo unavailable</Text>
        </View>
      ) : (
        <View>
          {isMulti ? (
            <ImageCarousel
              images={images}
              authorName={post.authorName}
              maxHeight={photoMaxHeight}
              fallbackWidth={windowWidth - 40}
              onPressImage={stablePhotoPress}
              onIndexChange={setActiveIndex}
              radius={s.carouselRadius.borderRadius}
            />
          ) : (
            <SingleImage
              uri={images[0]}
              authorName={post.authorName}
              maxHeight={photoMaxHeight}
              fallbackWidth={windowWidth - 40}
              onPress={stablePhotoPress}
              onError={() => setPhotoFailed(true)}
              radius={s.carouselRadius.borderRadius}
            />
          )}

          {isMulti && (
            <View style={s.counter} pointerEvents="none">
              <Text style={s.counterText}>{activeIndex + 1}/{images.length}</Text>
            </View>
          )}

          <Animated.View
            pointerEvents="none"
            style={[
              s.heartBurst,
              {
                opacity: heartAnim,
                transform: [{
                  scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }),
                }],
              },
            ]}
          >
            <Ionicons name="heart" size={focused ? 96 : 72} color="#FFFFFF" />
          </Animated.View>
        </View>
      )}

      {isMulti && (
        <View style={s.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
          ))}
        </View>
      )}

      <Text style={s.likes}>{likesLabel}</Text>
      {isLikeQueued ? <Text style={s.pendingSync}>Like saved; waiting to sync</Text> : null}

      <Text style={s.caption} numberOfLines={expanded ? undefined : 2}>
        <Text style={s.captionName}>{post.authorName}</Text>
        {'  '}
        <Text style={s.captionTitle}>{post.title}</Text>
        {!!post.content && <Text style={s.captionBody}>{`\n${post.content}`}</Text>}
      </Text>
      {hasLongCaption && !expanded && (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Show full caption"
        >
          <Text style={s.more}>more</Text>
        </TouchableOpacity>
      )}

      <Text style={s.timestamp}>{formatRelativeTime(post.created_at)}</Text>
    </View>
  );
}

const ITEM_WIDTH_RATIO = 0.84;

function SingleImage({
  uri,
  authorName,
  maxHeight,
  fallbackWidth,
  onPress,
  onError,
  radius,
}: {
  uri: string;
  authorName: string;
  maxHeight: number;
  fallbackWidth: number;
  onPress: () => void;
  onError: () => void;
  radius: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);

  const effectiveWidth = containerWidth > 0 ? containerWidth : fallbackWidth;
  const ratioSafe = ratio ?? 1;
  const width = Math.min(effectiveWidth * ITEM_WIDTH_RATIO, maxHeight * ratioSafe);
  const height = width / ratioSafe;

  return (
    <View
      style={carouselStyles.singleWrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) setContainerWidth(w);
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo shared by ${authorName}. Double tap to like.`}
      >
        <ExpoImage
          source={{ uri }}
          style={{ width, height, borderRadius: radius, backgroundColor: BG_AVATAR }}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onLoad={(e) => {
            const { width: w, height: h } = e.source;
            if (w > 0 && h > 0) setRatio(w / h);
          }}
          onError={onError}
        />
      </Pressable>
    </View>
  );
}

const ITEM_GAP = 8;
const SIDE_SCALE = 0.78;
const SIDE_OPACITY = 0.35;

const ImageCarousel = memo(function ImageCarousel({
  images,
  authorName,
  maxHeight,
  fallbackWidth,
  onPressImage,
  onIndexChange,
  radius,
}: {
  images: string[];
  authorName: string;
  maxHeight: number;
  fallbackWidth: number;
  onPressImage: () => void;
  onIndexChange: (index: number) => void;
  radius: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const scrollX = useRef(new Animated.Value(0)).current;
  const lastIndex = useRef(0);

  const effectiveWidth = containerWidth > 0 ? containerWidth : fallbackWidth;
  const itemWidth = effectiveWidth * ITEM_WIDTH_RATIO;
  const itemHeight = Math.min(itemWidth, maxHeight);
  const stride = itemWidth + ITEM_GAP;
  const sidePad = (effectiveWidth - itemWidth) / 2;
  const lastItem = images.length - 1;

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          if (stride <= 0) return;
          const index = Math.max(
            0,
            Math.min(lastItem, Math.round(e.nativeEvent.contentOffset.x / stride)),
          );
          if (index !== lastIndex.current) {
            lastIndex.current = index;
            onIndexChange(index);
          }
        },
      }),
    [scrollX, stride, lastItem, onIndexChange],
  );

  return (
    <View
      style={{ width: '100%', height: itemHeight }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) setContainerWidth(w);
      }}
    >
      <Animated.FlatList
        data={images}
        horizontal
        keyExtractor={(uri, i) => `${uri}-${i}`}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        removeClippedSubviews={false}
        initialNumToRender={images.length}
        windowSize={5}
        snapToInterval={stride}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: sidePad }}
        getItemLayout={(_, index) => ({ length: stride, offset: stride * index, index })}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * stride, index * stride, (index + 1) * stride];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [SIDE_SCALE, 1, SIDE_SCALE],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={{
                width: itemWidth,
                height: itemHeight,
                marginRight: index === lastItem ? 0 : ITEM_GAP,
                transform: [{ scale }],
                opacity,
              }}
            >
              <Pressable
                onPress={onPressImage}
                style={{ flex: 1 }}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Photo ${index + 1} of ${images.length} shared by ${authorName}. Double tap to like.`}
              >
                {failed.has(index) ? (
                  <View style={[carouselStyles.fallback, { borderRadius: radius }]}>
                    <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
                  </View>
                ) : (
                  <ExpoImage
                    source={{ uri: item }}
                    style={{ flex: 1, borderRadius: radius, backgroundColor: BG_AVATAR }}
                    contentFit="cover"
                    transition={0}
                    cachePolicy="memory-disk"
                    onError={() =>
                      setFailed((current) => new Set(current).add(index))
                    }
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
});

const carouselStyles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_AVATAR },
  singleWrap: { width: '100%', alignItems: 'center' },
});

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

function makeStyles(focused: boolean) {
  const f = (n: number) => Math.round(n * (focused ? 1.3 : 1));
  const avatarSize = f(30);

  return StyleSheet.create({
    card: { marginBottom: f(22) },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: f(8), paddingBottom: f(9), minHeight: f(40) },
    authorRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: f(9) },
    avatarRing: { padding: 2, borderRadius: (avatarSize + 8) / 2, borderWidth: 2, borderColor: ACCENT_GOLD },
    avatar: { width: avatarSize, height: avatarSize, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: avatarSize / 2, backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: { color: ACCENT_GOLD, fontSize: f(10), fontWeight: '800' },
    authorText: { flex: 1, minWidth: 0 },
    authorName: { color: TEXT_PRIMARY, fontSize: f(11), fontWeight: '700' },
    location: { color: TEXT_SECONDARY, fontSize: f(9), marginTop: 1 },
    photo: { width: '100%', aspectRatio: 1, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
    photoPlaceholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: RADIUS_BTN, backgroundColor: BG_AVATAR },
    placeholderText: { color: TEXT_MUTED, fontSize: f(9) },
    carouselRadius: { borderRadius: f(12) },
    counter: { position: 'absolute', top: f(8), right: f(8), paddingHorizontal: f(8), paddingVertical: f(3), borderRadius: 999, backgroundColor: 'rgba(14,21,32,0.7)' },
    counterText: { color: TEXT_PRIMARY, fontSize: f(9), fontWeight: '700' },
    dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: f(10) },
    dot: { width: f(6), height: f(6), borderRadius: f(3), backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive: { backgroundColor: ACCENT_GOLD },
    heartBurst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    likeButton: { minWidth: 36, minHeight: 34, alignItems: 'flex-end', justifyContent: 'center' },
    likes: { color: TEXT_PRIMARY, fontSize: f(10), fontWeight: '800', marginTop: f(8) },
    pendingSync: { color: ACCENT_GOLD, fontSize: f(9), marginTop: 3 },
    caption: { color: TEXT_SECONDARY, fontSize: f(10), lineHeight: f(15), marginTop: f(4) },
    captionName: { color: TEXT_PRIMARY, fontWeight: '800' },
    captionTitle: { color: TEXT_PRIMARY, fontWeight: '600' },
    captionBody: { color: TEXT_SECONDARY, fontWeight: '400' },
    more: { color: TEXT_FAINT, fontSize: f(10), marginTop: 2 },
    timestamp: { color: TEXT_FAINT, fontSize: f(8), letterSpacing: 0.4, textTransform: 'uppercase', marginTop: f(6) },
  });
}