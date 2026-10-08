import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ACCENT_GOLD,
  BG_AVATAR,
  BORDER_SUBTLE,
  TEXT_FAINT,
} from '../../theme/designTokens';
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

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl;
};

export default function JournalShowcase({ entries, mountains, isLoading = false }: JournalShowcaseProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedPhotoUri, setSelectedPhotoUri] = React.useState<string | null>(null);
  const [photoAspectRatio, setPhotoAspectRatio] = React.useState(1);
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

  const maxWidth = windowWidth * 0.9;
  const maxHeight = windowHeight * 0.85;
  let photoWidth = maxWidth;
  let photoHeight = photoWidth / photoAspectRatio;
  if (photoHeight > maxHeight) {
    photoHeight = maxHeight;
    photoWidth = photoHeight * photoAspectRatio;
  }

  const closePhoto = () => {
    setSelectedPhotoUri(null);
    setPhotoAspectRatio(1);
  };

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
                setSelectedPhotoUri(getImageUrl(photo.image));
              }}
            />
          ) : (
            <Text style={styles.emptySection}>No photos yet.</Text>
          )}
        </View>
      ))}
    </ScrollView>
    <Modal
      visible={selectedPhotoUri !== null}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={closePhoto}
    >
      {selectedPhotoUri && (
        <TouchableWithoutFeedback onPress={closePhoto}>
          <View style={styles.modalBackdrop}>
            <Image
              source={{ uri: selectedPhotoUri }}
              style={[styles.lightboxImage, { width: photoWidth, height: photoHeight }]}
              resizeMode="contain"
              onLoad={({ nativeEvent }) => {
                const { width, height } = nativeEvent.source;
                if (width > 0 && height > 0) setPhotoAspectRatio(width / height);
              }}
            />
          </View>
        </TouchableWithoutFeedback>
      )}
    </Modal>
  </>;
}

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
                accessibilityLabel={`Open photo from ${mountainName}`}
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

  // Photo-only lightbox
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lightboxImage: {
    borderRadius: 8,
    backgroundColor: '#000',
  },
});