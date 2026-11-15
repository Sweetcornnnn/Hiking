import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BG_GOLD_TINT,
  BG_PANEL,
  BORDER_GOLD_SOFT,
  BORDER_SUBTLE,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';
import { supabase } from '../../lib/supabase';
import type { Mountain } from '../../services/mountainService';
import type { JournalEntry } from '../../types/journal';
import { PhotoViewerModal } from './MyJournalFeed';

interface JournalShowcaseProps {
  entries: JournalEntry[];
  mountains: Mountain[];
  isLoading?: boolean;
}

interface ShowcasePhoto {
  entry: JournalEntry;
  image: string;
  imageIndex: number;
}

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl;
};

// ─────────────────────────────────────────────────────────────────────────
//  Empty states (these are meant to get a smile)
// ─────────────────────────────────────────────────────────────────────────
const FUNNY_EMPTY: { title: string; body: (mountain: string) => string }[] = [
  { title: 'Zero photos. Suspicious.', body: (m) => `Did you really climb ${m}, or just stare at it from the parking lot?` },
  { title: 'Nothing to see here (yet)', body: (m) => `${m} is still waiting for its glamour shots.` },
  { title: 'This gallery is on a snack break', body: () => 'Add a journal entry with a photo and it will get right back to work.' },
  { title: 'Your camera roll called', body: (m) => `It misses ${m}. Please send photos.` },
  { title: 'No proof, no pics', body: () => 'The mountain says you were never there. Prove it.' },
];

// Same mountain always gets the same joke, so the card doesn't change on every re-render
const pickJoke = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FUNNY_EMPTY[hash % FUNNY_EMPTY.length];
};

function EmptyCard({ title, body }: { title: string; body: string }) {
  const bob = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  return (
    <View style={styles.emptyCard}>
      <Animated.View
        style={[
          styles.emptyIcon,
          {
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) },
            ],
          },
        ]}
      >
        <Ionicons name="camera-outline" size={20} color={ACCENT_GOLD} />
      </Animated.View>
      <View style={styles.emptyText}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Showcase
// ─────────────────────────────────────────────────────────────────────────
export default function JournalShowcase({ entries, mountains, isLoading = false }: JournalShowcaseProps) {
  const [selectedPhoto, setSelectedPhoto] = React.useState<ShowcasePhoto | null>(null);
  const imagesByMountain = new Map<string, ShowcasePhoto[]>();
  entries.forEach((entry) => {
    const mountainKey = entry.mountain_id || '__unassigned__';
    imagesByMountain.set(mountainKey, [
      ...(imagesByMountain.get(mountainKey) || []),
      ...(entry.images || [])
        .filter(Boolean)
        .map((image, imageIndex) => ({ entry, image, imageIndex })),
    ]);
  });
  const mountainPriority = (name: string) => {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedName.includes('madjaas')) return 0;
    if (normalizedName.includes('nausang')) return 1;
    return 2;
  };
  const groups = [...mountains]
    .sort((first, second) => mountainPriority(first.name) - mountainPriority(second.name))
    .map((mountain) => ({
      id: mountain.id,
      name: mountain.name,
      images: imagesByMountain.get(mountain.id) || [],
    }));
  const unassignedImages = imagesByMountain.get('__unassigned__') || [];
  if (unassignedImages.length) {
    groups.push({ id: '__unassigned__', name: 'Mountain not selected', images: unassignedImages });
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={ACCENT_GOLD} size="small" />
        <Text style={styles.loadingText}>Developing your photos…</Text>
      </View>
    );
  }
  if (!mountains.length && !unassignedImages.length) {
    return (
      <EmptyCard
        title="No mountains, no photos"
        body="Go climb something. This page will be right here, looking very empty."
      />
    );
  }

  const closePhoto = () => {
    setSelectedPhoto(null);
  };
  const selectedEntry = selectedPhoto?.entry ?? null;
  const viewerImages = selectedEntry
    ? selectedEntry.images.filter(Boolean).map(getImageUrl).filter(Boolean)
    : [];
  const selectedMountainName = selectedEntry?.mountain_id
    ? mountains.find((mountain) => mountain.id === selectedEntry.mountain_id)?.name
    : undefined;

  return <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.groups} showsVerticalScrollIndicator={false}>
      {groups.map((group) => (
        <MountainSection
          key={group.id}
          id={group.id}
          name={group.name}
          photos={group.images}
          onSelect={setSelectedPhoto}
        />
      ))}
    </ScrollView>
    <PhotoViewerModal
      visible={selectedPhoto !== null && viewerImages.length > 0}
      images={viewerImages}
      entry={selectedEntry}
      locationLabel={selectedMountainName}
      startIndex={selectedPhoto?.imageIndex ?? 0}
      dateOnlyHeader
      onClose={closePhoto}
    />
  </>;
}

const CAROUSEL_IMAGE_WIDTH = 200;
const CAROUSEL_IMAGE_HEIGHT = 136;
const CAROUSEL_IMAGE_GAP = 10;
const MAX_DOTS = 8;

function MountainSection({
  id,
  name,
  photos,
  onSelect,
}: {
  id: string;
  name: string;
  photos: ShowcasePhoto[];
  onSelect: (photo: ShowcasePhoto) => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const count = photos.length;
  const joke = React.useMemo(() => pickJoke(id), [id]);

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <View style={styles.headerName}>
          <Ionicons name="triangle" size={9} color={ACCENT_GOLD} />
          <Text style={styles.mountainName} numberOfLines={1}>{name}</Text>
        </View>
        <View style={[styles.countPill, count === 0 && styles.countPillEmpty]}>
          <Text style={[styles.countText, count === 0 && styles.countTextEmpty]}>
            {count === 0 ? 'no photos' : count === 1 ? '1 photo' : `${count} photos`}
          </Text>
        </View>
      </View>

      {count > 0 ? (
        <MountainPhotoCarousel
          mountainName={name}
          photos={photos}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          onSelect={onSelect}
        />
      ) : (
        <EmptyCard title={joke.title} body={joke.body(name)} />
      )}
    </View>
  );
}

function MountainPhotoCarousel({
  mountainName,
  photos,
  activeIndex,
  onActiveChange,
  onSelect,
}: {
  mountainName: string;
  photos: ShowcasePhoto[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onSelect: (photo: ShowcasePhoto) => void;
}) {
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [scrollX] = React.useState(() => new Animated.Value(0));
  const cardWidth = viewportWidth ? Math.min(CAROUSEL_IMAGE_WIDTH, viewportWidth * 0.72) : CAROUSEL_IMAGE_WIDTH;
  const cardHeight = cardWidth * (CAROUSEL_IMAGE_HEIGHT / CAROUSEL_IMAGE_WIDTH);
  const itemStride = cardWidth + CAROUSEL_IMAGE_GAP;

  return (
    <View
      style={styles.carouselContainer}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
    >
      <Animated.FlatList
        horizontal
        data={photos}
        keyExtractor={(photo, index) => `${photo.entry.id}-${photo.image}-${index}`}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        snapToInterval={itemStride}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingHorizontal: Math.max(0, (viewportWidth - itemStride) / 2),
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / itemStride);
          onActiveChange(Math.max(0, Math.min(index, photos.length - 1)));
        }}
        scrollEventThrottle={16}
        renderItem={({ item: photo, index }) => {
          const inputRange = [
            (index - 1) * itemStride,
            index * itemStride,
            (index + 1) * itemStride,
          ];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.35, 1, 0.35],
            extrapolate: 'clamp',
          });
          // Gold frame and expand badge fade in only on the centred photo
          const focus = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          const imageUrl = getImageUrl(photo.image);

          return (
            <Animated.View
              style={{
                width: itemStride,
                height: cardHeight,
                alignItems: 'center',
                transform: [{ scale }],
                opacity,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Open photo ${index + 1} of ${photos.length} from ${mountainName}`}
                onPress={() => onSelect(photo)}
                activeOpacity={0.85}
                style={[styles.imageFrame, { width: cardWidth, height: cardHeight }]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  onError={(event) => {
                    console.error('[JournalShowcase] Image failed:', imageUrl, event.nativeEvent.error);
                  }}
                />
                <Animated.View pointerEvents="none" style={[styles.focusRing, { opacity: focus }]} />
                <Animated.View pointerEvents="none" style={[styles.expandBadge, { opacity: focus }]}>
                  <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />

      <View style={styles.indicator} accessible accessibilityLabel={`Photo ${activeIndex + 1} of ${photos.length}`}>
        {photos.length <= MAX_DOTS ? (
          photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))
        ) : (
          <Text style={styles.carouselPosition}>
            {activeIndex + 1} / {photos.length}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  groups: { gap: 18, width: '100%', paddingBottom: 8 },
  group: { gap: 10, width: '100%' },

  // Section header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  mountainName: { flexShrink: 1, color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: BG_GOLD_TINT,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
  },
  countPillEmpty: { backgroundColor: 'transparent', borderColor: BORDER_SUBTLE },
  countText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
  countTextEmpty: { color: TEXT_FAINT },

  // Carousel
  carouselContainer: { gap: 8 },
  imageFrame: { borderRadius: 12, overflow: 'hidden', backgroundColor: BG_AVATAR },
  image: { width: '100%', height: '100%' },
  focusRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCENT_GOLD,
  },
  expandBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,13,20,0.65)',
  },
  indicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 16, backgroundColor: ACCENT_GOLD },
  carouselPosition: { color: TEXT_FAINT, fontSize: 11, fontWeight: '600' },

  // Loading
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  loadingText: { color: TEXT_MUTED, fontSize: 12 },

  // Empty
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BORDER_GOLD_SOFT,
    backgroundColor: BG_PANEL,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_GOLD_TINT,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
  },
  emptyText: { flex: 1, minWidth: 0 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  emptyBody: { marginTop: 2, color: TEXT_MUTED, fontSize: 12, lineHeight: 17 },
});