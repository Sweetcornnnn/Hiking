import React, { memo, useMemo, useRef, useState } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import type { JournalEntry } from '../../types/journal';
import type { Mountain } from '../../services/mountainService';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BG_CARD,
  BORDER_SUBTLE,
  RADIUS_BTN,
  TEXT_DANGER,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

interface Props {
  entries: JournalEntry[];
  mountains: Mountain[];
  isLoading?: boolean;
  onDelete: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl ?? '';
};

const LONG_CONTENT_CHARS = 90;

export default function MyJournalFeed({
  entries,
  mountains,
  isLoading = false,
  onDelete,
  onNewEntry,
}: Props) {
  const mountainsById = useMemo(() => {
    const map = new Map<string, string>();
    mountains.forEach((mountain) => map.set(mountain.id, mountain.name));
    return map;
  }, [mountains]);

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
        >
          <Ionicons name="add" size={15} color="#0E1520" />
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
        />
      ))}
    </View>
  );
}

function MyJournalPostCard({
  entry,
  locationLabel,
  onDelete,
}: {
  entry: JournalEntry;
  locationLabel?: string;
  onDelete: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const images = useMemo(
    () => (entry.images ?? []).filter(Boolean).map(getImageUrl).filter(Boolean),
    [entry.images],
  );
  const isMulti = images.length > 1;
  const photoMaxHeight = windowHeight * 0.72;
  const hasLongContent = (entry.content?.length ?? 0) > LONG_CONTENT_CHARS;

  const profile = useAuthStore((state) => state.profile);
  const authorName = user?.name || profile?.full_name || 'You';
  const avatarUrl = profile?.avatar_url ?? undefined;
  const initials = getInitials(authorName);

  return (
    <View style={styles.card}>
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
            {!!locationLabel && (
              <Text style={styles.location} numberOfLines={1}>
                {locationLabel}
              </Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={onDelete}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete journal entry"
        >
          <Ionicons name="trash-outline" size={22} color={TEXT_DANGER} />
        </Pressable>
      </View>

      {images.length === 0 || (!isMulti && photoFailed) ? (
        <View style={[styles.photoPlaceholder, { maxHeight: photoMaxHeight }]}>
          <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
          <Text style={styles.placeholderText}>No photo in this entry</Text>
        </View>
      ) : (
        <View>
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
            <View style={styles.counter} pointerEvents="none">
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

      {entry.rating ? (
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= entry.rating! ? 'star' : 'star-outline'}
              size={14}
              color={ACCENT_GOLD}
            />
          ))}
          {entry.is_public && (
            <View style={styles.publicBadge}>
              <Ionicons name="earth-outline" size={10} color={ACCENT_GOLD} />
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
      ) : (
        entry.is_public && (
          <View style={styles.starsRow}>
            <View style={styles.publicBadge}>
              <Ionicons name="earth-outline" size={10} color={ACCENT_GOLD} />
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          </View>
        )
      )}

      <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
        <Text style={styles.captionName}>{authorName}</Text>
        {'  '}
        <Text style={styles.captionTitle}>{entry.title || 'Untitled entry'}</Text>
        {!!entry.content && (
          <Text style={styles.captionBody}>{`\n${entry.content}`}</Text>
        )}
      </Text>
      {hasLongContent && !expanded && (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Show full entry"
        >
          <Text style={styles.more}>more</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.timestamp}>{formatRelativeTime(entry.created_at)}</Text>
    </View>
  );
}

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
  const width = Math.min(containerWidth * ITEM_WIDTH_RATIO, maxHeight * ratioSafe);
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
            borderRadius: 12,
            backgroundColor: BG_AVATAR,
          }}
          contentFit="cover"
          transition={180}
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
  const scrollX = useRef(new Animated.Value(0)).current;
  const lastIndex = useRef(0);

  const itemWidth = containerWidth * ITEM_WIDTH_RATIO;
  const itemHeight = Math.min(itemWidth, maxHeight);
  const stride = itemWidth + ITEM_GAP;
  const sidePad = (containerWidth - itemWidth) / 2;
  const lastItem = images.length - 1;

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (event: any) => {
          if (stride <= 0) return;
          const index = Math.max(
            0,
            Math.min(lastItem, Math.round(event.nativeEvent.contentOffset.x / stride)),
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
                  <View style={[carouselStyles.fallback, { borderRadius: 12 }]}>
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
                  style={{ flex: 1, borderRadius: 12, backgroundColor: BG_AVATAR }}
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
  feed: { gap: 0 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    backgroundColor: BG_CARD,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
  },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT_GOLD,
  },
  emptyButtonText: { color: '#0E1520', fontSize: 12, fontWeight: '800' },
  card: { marginBottom: 22 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 9,
    minHeight: 40,
  },
  authorRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: ACCENT_GOLD,
  },
  avatar: {
    width: 30,
    height: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: BG_AVATAR,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '800' },
  authorText: { flex: 1, minWidth: 0 },
  authorName: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '700' },
  location: { color: TEXT_SECONDARY, fontSize: 9, marginTop: 1 },
  actionButton: {
    minWidth: 36,
    minHeight: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: RADIUS_BTN,
    backgroundColor: BG_AVATAR,
  },
  placeholderText: { color: TEXT_MUTED, fontSize: 9 },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(14,21,32,0.7)',
  },
  counterText: { color: TEXT_PRIMARY, fontSize: 9, fontWeight: '700' },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: { backgroundColor: ACCENT_GOLD },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  publicBadge: {
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    backgroundColor: 'rgba(201,169,110,0.08)',
  },
  publicBadgeText: { color: ACCENT_GOLD, fontSize: 9, fontWeight: '700' },
  caption: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  captionName: { color: TEXT_PRIMARY, fontWeight: '800' },
  captionTitle: { color: TEXT_PRIMARY, fontWeight: '600' },
  captionBody: { color: TEXT_SECONDARY, fontWeight: '400' },
  more: { color: TEXT_FAINT, fontSize: 10, marginTop: 2 },
  timestamp: {
    color: TEXT_FAINT,
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
});
