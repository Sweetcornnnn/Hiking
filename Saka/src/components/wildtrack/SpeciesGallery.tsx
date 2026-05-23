import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface SpeciesGalleryProps {
  images?: string[];
}

export const SpeciesGallery: React.FC<SpeciesGalleryProps> = ({ images = [] }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  if (images.length === 0) {
    return (
      <View style={styles.emptyGallery}>
        <Text style={styles.emptyText}>No image gallery available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Image gallery</Text>
        <Text style={styles.counter}>{`${activeIndex + 1} / ${images.length}`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slider}>
        {images.map((uri, index) => (
          <Pressable key={`${uri}-${index}`} onPress={() => { setActiveIndex(index); setOpen(true); }} style={styles.imageTile}>
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.closeArea} onPress={() => setOpen(false)} />
          <View style={styles.modalContent}>
            <Image source={{ uri: images[activeIndex] }} style={styles.modalImage} resizeMode="contain" />
            <Text style={styles.modalCaption}>{images[activeIndex]}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 13,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  counter: {
    fontSize: 12,
    color: '#64748B',
  },
  slider: {
    gap: 12,
  },
  imageTile: {
    width: 160,
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyGallery: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '92%',
    height: '80%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '88%',
  },
  modalCaption: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    textAlign: 'center',
  },
});
