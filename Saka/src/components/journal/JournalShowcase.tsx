import React from 'react';
import { ActivityIndicator, Animated, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_GOLD, BG_AVATAR, BG_PANEL, BG_SUBTLE, BORDER_SUBTLE, TEXT_FAINT, TEXT_MUTED, TEXT_PRIMARY } from '../../theme/designTokens';
import { supabase } from '../../lib/supabase';
import type { Mountain } from '../../services/mountainService';
import type { JournalEntry } from '../../types/journal';

interface JournalShowcaseProps {
  entries: JournalEntry[];
  mountains: Mountain[];
  isLoading?: boolean;
}

interface ShowcasePhoto {
  entry: JournalEntry;
  image: string;
}

interface SelectedPhoto extends ShowcasePhoto {
  mountainName: string;
}

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl;
};

export default function JournalShowcase({ entries, mountains, isLoading = false }: JournalShowcaseProps) {
  const [selectedPhoto, setSelectedPhoto] = React.useState<SelectedPhoto | null>(null);
  const [photoAspectRatio, setPhotoAspectRatio] = React.useState(1);
  const [detailCardSize, setDetailCardSize] = React.useState({ width: 0, height: 0 });
  const imagePaneWidth = detailCardSize.width > 0 ? Math.min(detailCardSize.width * 0.58, 420) : 320;
  const { width: detailImageWidth, height: detailImageHeight } = getDetailImageSize(
    imagePaneWidth,
    detailCardSize.height,
    photoAspectRatio,
  );
  const imagesByMountain = new Map<string, ShowcasePhoto[]>();
  entries.forEach((entry) => {
    const mountainKey = entry.mountain_id || '__unassigned__';
    imagesByMountain.set(mountainKey, [
      ...(imagesByMountain.get(mountainKey) || []),
      ...(entry.images || []).map((image) => ({ entry, image })),
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

  if (isLoading) return <ActivityIndicator color={ACCENT_GOLD} size="small" />;
  if (!mountains.length && !unassignedImages.length) {
    return <Text style={styles.empty}>Your saved journal photos will appear here.</Text>;
  }

  return <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.groups} showsVerticalScrollIndicator={false}>
      {groups.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.mountainName}>{group.name}</Text>
          {group.images.length ? (
            <MountainPhotoCarousel
              mountainName={group.name}
              photos={group.images}
              onSelect={(photo) => {
                setPhotoAspectRatio(1);
                setSelectedPhoto({ ...photo, mountainName: group.name });
              }}
            />
          ) : (
            <Text style={styles.emptySection}>No photos yet.</Text>
          )}
        </View>
      ))}
    </ScrollView>
    <Modal
      visible={selectedPhoto !== null}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={() => setSelectedPhoto(null)}
    >
      {selectedPhoto && (
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={() => setSelectedPhoto(null)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={styles.detailCard}
            onLayout={(event) => setDetailCardSize({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })}
          >
            <View style={[styles.detailImageFrame, { width: detailImageWidth }]}>
              <Image
                source={{ uri: getImageUrl(selectedPhoto.image) }}
                style={{ width: detailImageWidth, height: detailImageHeight }}
                resizeMode="contain"
                onLoad={({ nativeEvent }) => {
                  const { width, height } = nativeEvent.source;
                  if (width > 0 && height > 0) setPhotoAspectRatio(width / height);
                }}
              />
            </View>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
              <View style={styles.detailHeader}>
                <View style={styles.detailHeading}>
                  <Text style={styles.detailMountain}>{selectedPhoto.mountainName}</Text>
                  <Text style={styles.detailDate}>{new Date(selectedPhoto.entry.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close journal entry"
                    onPress={() => setSelectedPhoto(null)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Title:</Text>
                <Text style={styles.detailTitle}>{selectedPhoto.entry.title || 'Trail memory'}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Ratings:</Text>
                {selectedPhoto.entry.rating ? (
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= selectedPhoto.entry.rating! ? 'star' : 'star-outline'}
                        size={16}
                        color={ACCENT_GOLD}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.detailText}>Not rated</Text>
                )}
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Experience:</Text>
                <Text style={styles.detailText}>{selectedPhoto.entry.content || 'No experience was written for this entry.'}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </Modal>
  </>;
}

const getDetailImageSize = (
  cardWidth: number,
  cardHeight: number,
  aspectRatio: number,
) => {
  if (!cardWidth || !cardHeight) {
    return { width: 320, height: 220 };
  }

  const maxHeight = Math.max(1, cardHeight);
  const height = Math.min(maxHeight, cardWidth / aspectRatio);

  return {
    width: Math.min(cardWidth, Math.max(1, height * aspectRatio)),
    height: Math.max(1, height),
  };
};

const CAROUSEL_IMAGE_WIDTH = 180;
const CAROUSEL_IMAGE_HEIGHT = 125;
const CAROUSEL_IMAGE_GAP = 2;

function MountainPhotoCarousel({
  mountainName,
  photos,
  onSelect,
}: {
  mountainName: string;
  photos: ShowcasePhoto[];
  onSelect: (photo: ShowcasePhoto) => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
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
          paddingHorizontal: Math.max(0, (viewportWidth - cardWidth) / 2),
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / itemStride);
          setActiveIndex(Math.max(0, Math.min(index, photos.length - 1)));
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
            outputRange: [0.72, 1, 0.72],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const imageUrl = getImageUrl(photo.image);

          return (
            <Animated.View style={{ width: itemStride, height: cardHeight, transform: [{ scale }], opacity }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Read journal entry: ${photo.entry.title || mountainName}`}
                onPress={() => onSelect(photo)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={[styles.image, { width: cardWidth, height: cardHeight }]}
                  onError={(event) => {
                    console.error('[JournalShowcase] Image failed:', imageUrl, event.nativeEvent.error);
                  }}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />
      <Text style={styles.carouselPosition}>
        {activeIndex + 1} / {photos.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  groups: { gap: 16, width: '100%', paddingBottom: 8 },
  group: { gap: 7, width: '100%' },
  mountainName: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },
  carouselContainer: { gap: 6 },
  image: { width: CAROUSEL_IMAGE_WIDTH, height: CAROUSEL_IMAGE_HEIGHT, borderRadius: 6, backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
  carouselPosition: { alignSelf: 'flex-end', color: TEXT_FAINT, fontSize: 10 },
  empty: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14 },
  emptySection: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  detailCard: { width: '86%', maxWidth: 800, height: '74%', maxHeight: 560, flexDirection: 'row', backgroundColor: BG_PANEL, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER_SUBTLE, elevation: 18 },
  detailImageFrame: { height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: BG_PANEL, borderRightWidth: 1, borderRightColor: BORDER_SUBTLE, flexShrink: 0 },
  detailScroll: { flex: 1, minWidth: 0, backgroundColor: BG_PANEL },
  detailContent: { padding: 20, gap: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailHeading: { gap: 4, flex: 1 },
  detailMountain: { color: ACCENT_GOLD, fontSize: 12, fontWeight: '700' },
  detailDate: { color: TEXT_FAINT, fontSize: 11 },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: BG_SUBTLE },
  detailSection: { gap: 5 },
  detailLabel: { color: TEXT_FAINT, fontSize: 11, fontWeight: '700' },
  detailTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: 4 },
  detailText: { color: TEXT_MUTED, fontSize: 15, lineHeight: 23 },
});
