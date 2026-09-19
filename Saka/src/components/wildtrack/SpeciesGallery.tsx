import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SpeciesGalleryProps {
  images?: string[];
}

export const SpeciesGallery: React.FC<SpeciesGalleryProps> = ({ images = [] }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [sizeLoading, setSizeLoading] = useState(true);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    if (!open || !images[activeIndex]) return;

    let cancelled = false;
    setSizeLoading(true);
    setNaturalSize(null);

    Image.getSize(
      images[activeIndex],
      (w, h) => {
        if (!cancelled) {
          setNaturalSize({ w, h });
          setSizeLoading(false);
        }
      },
      () => {
        if (!cancelled) setSizeLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [open, activeIndex, images]);

  if (!images.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={22} color="#64748B" />
        <Text style={styles.emptyText}>No image data available</Text>
      </View>
    );
  }

  const openViewer = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const maxBoxWidth = width * (isLandscape ? 0.6 : 0.86);
  const maxBoxHeight = height * (isLandscape ? 0.7 : 0.58);

  let boxWidth = maxBoxWidth;
  let boxHeight = maxBoxHeight;

  if (naturalSize) {
    const ratio = naturalSize.w / naturalSize.h;
    boxHeight = boxWidth / ratio;
    if (boxHeight > maxBoxHeight) {
      boxHeight = maxBoxHeight;
      boxWidth = boxHeight * ratio;
    }
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={16} color="#D4A574" />
          <Text style={styles.title}>Gallery</Text>
        </View>

        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {activeIndex + 1} / {images.length}
          </Text>
        </View>
      </View>

      {/* STRIP — resizeMode "cover" so thumbnails from the API always fill
          their frame, whatever the source photo's aspect ratio is */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {images.map((uri, index) => {
          const active = index === activeIndex;

          return (
            <Pressable
              key={`${uri}-${index}`}
              onPress={() => openViewer(index)}
              style={[styles.thumb, active && styles.thumbActive]}
            >
              <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
              {active && <View style={styles.activeOverlay} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FULLSCREEN VIEWER — the box is sized to each photo's real aspect
          ratio (measured via Image.getSize), so it hugs the picture instead
          of a fixed box with "contain" leaving blank bars around it. Counter,
          close, and nav controls float on top of the image itself rather
          than sitting in their own bars, so the card doesn't stretch edge
          to edge. No dark backdrop tint — tapping outside still closes it. */}
      <Modal visible={open} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setOpen(false)} />

          <View style={[styles.modalCard, { width: boxWidth, height: boxHeight }]}>
            {sizeLoading ? (
              <ActivityIndicator color="#D4A574" />
            ) : (
              <Image
                source={{ uri: images[activeIndex] }}
                style={{ width: boxWidth, height: boxHeight }}
                resizeMode="contain"
              />
            )}

            {/* OVERLAY CONTROLS */}
            <View style={styles.overlayTop} pointerEvents="box-none">
              <View style={styles.overlayCounter}>
                <Text style={styles.modalCounter}>
                  {activeIndex + 1} / {images.length}
                </Text>
              </View>

              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#F59E0B" />
              </Pressable>
            </View>

            {images.length > 1 && (
              <View style={styles.overlayNav} pointerEvents="box-none">
                <Pressable
                  onPress={() => setActiveIndex((p) => (p > 0 ? p - 1 : images.length - 1))}
                  style={styles.navBtn}
                >
                  <Ionicons name="chevron-back" size={22} color="#F59E0B" />
                </Pressable>

                <Pressable
                  onPress={() => setActiveIndex((p) => (p < images.length - 1 ? p + 1 : 0))}
                  style={styles.navBtn}
                >
                  <Ionicons name="chevron-forward" size={22} color="#F59E0B" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
  counterPill: {
    backgroundColor: '#D4A574',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4A574',
  },
  counterText: { fontSize: 10, color: '#111827', fontWeight: '700' },
  strip: { gap: 10 },
  thumb: {
    width: 130,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  thumbActive: {
    borderColor: '#D4A574',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbImage: { width: '100%', height: '100%' },
  activeOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(212,165,116,0.14)' },
  empty: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  emptyText: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTap: { ...StyleSheet.absoluteFill },
  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  overlayCounter: {
    backgroundColor: '#D4A574',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalCounter: { color: '#111827', fontSize: 10, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});