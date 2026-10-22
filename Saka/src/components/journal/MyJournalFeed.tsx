import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import type { JournalEntry } from '../../types/journal';
import type { Mountain } from '../../services/mountainService';
import {
  ACCENT_GOLD,
  ANIM,
  BG_AVATAR,
  BG_CARD,
  BG_DANGER_SUBTLE,
  BG_GOLD_ICON,
  BG_GOLD_TINT,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DANGER,
  BORDER_DEFAULT,
  BORDER_GOLD,
  BORDER_GOLD_SOFT,
  BORDER_SUBTLE,
  CHAT_FS_TITLE,
  FONT,
  RADIUS_BTN,
  RADIUS_CARD,
  SPACING,
  TEXT_DANGER,
  TEXT_FAINT,
  TEXT_FAINTEST,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

interface Props {
  entries: JournalEntry[];
  mountains: Mountain[];
  isLoading?: boolean;
  onDelete: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry, index: number, uri: string) => void;
  onNewEntry: () => void;
}

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl ?? '';
};

const LONG_CONTENT_CHARS = 120;
const COLLAPSED_LINES = 3;
const PHOTO_RADIUS = 12;
const OVERLAY = `${BG_CARD}CC`;

export default function MyJournalFeed({
  entries,
  mountains,
  isLoading = false,
  onDelete,
  onEdit,
  onNewEntry,
}: Props) {
  const mountainsById = useMemo(() => {
    const map = new Map<string, string>();
    mountains.forEach((mountain) => map.set(mountain.id, mountain.name));
    return map;
  }, [mountains]);

  if (isLoading && entries.length === 0) {
    return (
      <View style={styles.feed} accessibilityLabel="Loading journal entries">
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  if (!isLoading && entries.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="book-outline" size={22} color={ACCENT_GOLD} />
        </View>
        <Text style={styles.emptyTitle}>Your journal is empty</Text>
        <Text style={styles.emptyText}>
          Write about a hike, add photos, and make the memory part of your profile.
        </Text>
        <TouchableOpacity
          onPress={onNewEntry}
          style={styles.emptyButton}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={15} color={BG_CARD} />
          <Text style={styles.emptyButtonText}>New journal entry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.feed}>
      {entries.map((entry) => (
        <MyJournalPostCard
          key={entry.id}
          entry={entry}
          locationLabel={
            entry.mountain_id ? mountainsById.get(entry.mountain_id) : undefined
          }
          onDelete={() => onDelete(entry)}
          onEdit={onEdit}
        />
      ))}
    </View>
  );
}

function MyJournalPostCard({
  entry,
  locationLabel,
  onDelete,
  onEdit,
}: {
  entry: JournalEntry;
  locationLabel?: string;
  onDelete: () => void;
  onEdit: (entry: JournalEntry, index: number, uri: string) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const images = useMemo(
    () => (entry.images ?? []).filter(Boolean).map(getImageUrl).filter(Boolean),
    [entry.images],
  );
  const isMulti = images.length > 1;
  const photoMaxHeight = windowHeight * 0.6;
  const hasLongContent = (entry.content?.length ?? 0) > LONG_CONTENT_CHARS;

  const authorName = user?.name || profile?.full_name || 'You';
  const avatarUrl = profile?.avatar_url ?? undefined;
  const initials = getInitials(authorName);
  const showFooter = !!entry.rating || !!entry.is_public;
  const overlayInset = isMulti ? '11%' : SPACING.cardPadH + 10;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.authorRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              {avatarUrl && !avatarFailed ? (
                <NativeImage
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            <Text style={styles.timestamp}>{formatRelativeTime(entry.created_at)}</Text>
          </View>
        </View>

        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete journal entry"
        >
          <Ionicons name="trash-outline" size={16} color={TEXT_DANGER} />
        </Pressable>
      </View>

      {images.length === 0 || (!isMulti && photoFailed) ? (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
          <Text style={styles.placeholderText}>No photo in this entry</Text>
        </View>
      ) : (
        <View style={styles.photoContainer}>
          <TouchableOpacity
            onPress={() => onEdit(entry, activeIndex, images[activeIndex])}
            style={[styles.editPhotoButton, { right: overlayInset }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit photo"
          >
            <Ionicons name="pencil-outline" size={15} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          {isMulti ? (
            <ImageCarousel
              images={images}
              maxHeight={photoMaxHeight}
              onIndexChange={setActiveIndex}
              onError={() => {}}
            />
          ) : (
            <SingleImage
              uri={images[0]}
              maxHeight={photoMaxHeight}
              onError={() => setPhotoFailed(true)}
            />
          )}

          {isMulti && (
            <View style={[styles.counter, { left: overlayInset }]} pointerEvents="none">
              <Text style={styles.counterText}>
                {activeIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {isMulti && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        {!!locationLabel && (
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={11} color={ACCENT_GOLD} />
            <Text style={styles.locationText} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        )}
        <Text style={styles.title}>{entry.title || 'Untitled entry'}</Text>
        {!!entry.content && (
          <Text style={styles.content} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
            {entry.content}
          </Text>
        )}
        {hasLongContent && (
          <TouchableOpacity
            onPress={() => setExpanded((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show less' : 'Show full entry'}
          >
            <Text style={styles.more}>{expanded ? 'Show less' : 'Read more'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showFooter && (
        <View style={styles.footer}>
          <View
            style={styles.starsRow}
            accessible={!!entry.rating}
            accessibilityLabel={entry.rating ? `Rated ${entry.rating} out of 5` : undefined}
          >
            {!!entry.rating && [1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= entry.rating! ? 'star' : 'star-outline'}
                size={13}
                color={ACCENT_GOLD}
              />
            ))}
          </View>
          {entry.is_public && (
            <View style={styles.publicBadge}>
              <Ionicons name="earth-outline" size={10} color={ACCENT_GOLD} />
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SkeletonCard() {
  const [pulse] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: ANIM.zoomMs,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.5,
            duration: ANIM.zoomMs,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={styles.headerRow}>
        <View style={skeletonStyles.avatar} />
        <View style={skeletonStyles.nameBlock}>
          <View style={[skeletonStyles.line, { width: '40%' }]} />
          <View style={[skeletonStyles.line, { width: '22%', height: 8 }]} />
        </View>
      </View>
      <View style={skeletonStyles.photo} />
      <View style={styles.body}>
        <View style={[skeletonStyles.line, { width: '55%', height: 14 }]} />
        <View style={[skeletonStyles.line, { width: '92%' }]} />
        <View style={[skeletonStyles.line, { width: '70%' }]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: BG_AVATAR },
  nameBlock: { flex: 1, gap: 6 },
  line: { height: 10, borderRadius: 5, backgroundColor: BG_AVATAR },
  photo: {
    marginHorizontal: SPACING.cardPadH,
    aspectRatio: 4 / 3,
    borderRadius: PHOTO_RADIUS,
    backgroundColor: BG_AVATAR,
  },
});

const ITEM_WIDTH_RATIO = 0.84;

function SingleImage({
  uri,
  maxHeight,
  onError,
}: {
  uri: string;
  maxHeight: number;
  onError: () => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);

  const ratioSafe = ratio ?? 1;
  const available = Math.max(0, containerWidth - SPACING.cardPadH * 2);
  const width = Math.min(available, maxHeight * ratioSafe);
  const height = width / ratioSafe;

  return (
    <View
      style={carouselStyles.singleWrap}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <ExpoImage
          source={{ uri }}
          style={{
            width,
            height,
            borderRadius: PHOTO_RADIUS,
            backgroundColor: BG_AVATAR,
          }}
          contentFit="cover"
          transition={ANIM.fadeMs}
          onLoad={(event) => {
            const { width: imageWidth, height: imageHeight } = event.source;
            if (imageWidth > 0 && imageHeight > 0) setRatio(imageWidth / imageHeight);
          }}
          onError={onError}
        />
      )}
    </View>
  );
}

const ITEM_GAP = 8;
const SIDE_SCALE = 0.78;
const SIDE_OPACITY = 0.35;

const ImageCarousel = memo(function ImageCarousel({
  images,
  maxHeight,
  onIndexChange,
  onError,
}: {
  images: string[];
  maxHeight: number;
  onIndexChange: (index: number) => void;
  onError: () => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [scrollX] = useState(() => new Animated.Value(0));
  const lastIndex = useRef(0);

  const itemWidth = containerWidth * ITEM_WIDTH_RATIO;
  const itemHeight = Math.min(itemWidth, maxHeight);
  const stride = itemWidth + ITEM_GAP;
  const sidePad = (containerWidth - itemWidth) / 2;
  const lastItem = images.length - 1;

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollX.setValue(offsetX);
    if (stride <= 0) return;
    const index = Math.max(0, Math.min(lastItem, Math.round(offsetX / stride)));
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      onIndexChange(index);
    }
  };

  return (
    <View
      style={{ width: '100%', height: itemHeight }}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.FlatList
          data={images}
          horizontal
          keyExtractor={(uri, index) => `${uri}-${index}`}
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
          getItemLayout={(_, index) => ({
            length: stride,
            offset: stride * index,
            index,
          })}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          renderItem={({ item, index }) => {
            const inputRange = [
              (index - 1) * stride,
              index * stride,
              (index + 1) * stride,
            ];
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

            if (failed.has(index)) {
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
                  <View style={[carouselStyles.fallback, { borderRadius: PHOTO_RADIUS }]}>
                    <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
                  </View>
                </Animated.View>
              );
            }

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
                <ExpoImage
                  source={{ uri: item }}
                  style={{ flex: 1, borderRadius: PHOTO_RADIUS, backgroundColor: BG_AVATAR }}
                  contentFit="cover"
                  transition={0}
                  cachePolicy="memory-disk"
                  onError={() => {
                    setFailed((current) => new Set(current).add(index));
                    onError();
                  }}
                />
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
});

const carouselStyles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_AVATAR,
  },
  singleWrap: { width: '100%', alignItems: 'center' },
});

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'Y'
  );
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
  feed: { gap: SPACING.gapLg },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: SPACING.gap,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_CARD,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: BG_GOLD_ICON,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
  },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: CHAT_FS_TITLE, fontWeight: '700' },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: SPACING.gap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT_GOLD,
  },
  emptyButtonText: { color: BG_CARD, fontSize: FONT.itemSize, fontWeight: '800' },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    paddingBottom: SPACING.cardPadB,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gap,
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: SPACING.cardPadT,
    paddingBottom: SPACING.gapLg,
  },
  authorRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gapLg,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: BORDER_GOLD,
  },
  avatar: {
    width: 34,
    height: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: BG_AVATAR,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: ACCENT_GOLD, fontSize: FONT.emailSize, fontWeight: '800' },
  authorText: { flex: 1, minWidth: 0, gap: 1 },
  authorName: { color: TEXT_PRIMARY, fontSize: FONT.nameSize, fontWeight: FONT.namWeight },
  timestamp: { color: TEXT_FAINT, fontSize: FONT.emailSize },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS_BTN,
    backgroundColor: BG_DANGER_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DANGER,
  },
  pressed: { opacity: 0.6 },
  photoPlaceholder: {
    marginHorizontal: SPACING.cardPadH,
    aspectRatio: 16 / 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: PHOTO_RADIUS,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    borderStyle: 'dashed',
  },
  placeholderText: { color: TEXT_MUTED, fontSize: FONT.emailSize },
  photoContainer: { position: 'relative' },
  editPhotoButton: {
    position: 'absolute',
    top: 10,
    zIndex: 2,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: OVERLAY,
    borderWidth: 1,
    borderColor: BORDER_GOLD,
  },
  counter: {
    position: 'absolute',
    top: 10,
    zIndex: 2,
    height: 24,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: OVERLAY,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
  },
  counterText: { color: TEXT_PRIMARY, fontSize: FONT.tagSize, fontWeight: '700' },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: SPACING.gapLg,
  },
  dot: {
    width: 5,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEXT_FAINTEST,
  },
  dotActive: { width: 16, backgroundColor: ACCENT_GOLD },
  body: {
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: SPACING.gapLg,
    gap: 6,
  },
  locationChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BG_GOLD_TINT,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
  },
  locationText: {
    flexShrink: 1,
    color: ACCENT_GOLD,
    fontSize: FONT.emailSize,
    fontWeight: '700',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: CHAT_FS_TITLE,
    fontWeight: '700',
    lineHeight: 20,
  },
  content: { color: TEXT_SECONDARY, fontSize: FONT.itemSize, lineHeight: 18 },
  more: { color: ACCENT_GOLD, fontSize: FONT.emailSize, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.cardPadH,
    marginTop: SPACING.gapLg,
    paddingTop: SPACING.gapLg,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
    backgroundColor: BG_SUBTLE,
  },
  publicBadgeText: { color: ACCENT_GOLD, fontSize: FONT.tagSize, fontWeight: '700' },
});
