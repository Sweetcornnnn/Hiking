import React, { useState } from 'react';
import {
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

export const SpeciesGallery: React.FC<SpeciesGalleryProps> = ({
  images = [],
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!images.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={22} color="#64748B" />
        <Text style={styles.emptyText}>
          No image data available
        </Text>
      </View>
    );
  }

  const openViewer = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

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

      {/* STRIP */}
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
              style={[
                styles.thumb,
                active && styles.thumbActive,
              ]}
            >
              <Image
                source={{ uri }}
                style={styles.thumbImage}
                resizeMode="cover"
              />

              {active && <View style={styles.activeOverlay} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FULLSCREEN VIEWER */}
      <Modal visible={open} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setOpen(false)}
          />

          <View
            style={[
              styles.modalCard,
              {
                height: isLandscape ? '92%' : '80%',
                width: isLandscape ? '85%' : '92%',
              },
            ]}
          >
            {/* TOP BAR */}
            <View style={styles.modalTopBar}>
              <Text style={styles.modalCounter}>
                {activeIndex + 1} / {images.length}
              </Text>

              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color="#CBD5E1"
                />
              </Pressable>
            </View>

            {/* IMAGE */}
            <Image
              source={{ uri: images[activeIndex] }}
              style={styles.modalImage}
              resizeMode="contain"
            />

            {/* NAV */}
            <View style={styles.navRow}>
              <Pressable
                onPress={() =>
                  setActiveIndex((p) =>
                    p > 0 ? p - 1 : images.length - 1
                  )
                }
                style={styles.navBtn}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color="#E2E8F0"
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setActiveIndex((p) =>
                    p < images.length - 1 ? p + 1 : 0
                  )
                }
                style={styles.navBtn}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#E2E8F0"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },

  counterPill: {
    backgroundColor: '#172033',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#233047',
  },

  counterText: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600',
  },

  strip: {
    gap: 10,
  },

  thumb: {
    width: 150,
    height: 110,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  thumbActive: {
    borderColor: '#D4A574',
  },

  thumbImage: {
    width: '100%',
    height: '100%',
  },

  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212,165,116,0.12)',
  },

  empty: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },

  emptyText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },

  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    justifyContent: 'center',
  },

  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },

  modalCounter: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalImage: {
    flex: 1,
    width: '100%',
  },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },

  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },
});