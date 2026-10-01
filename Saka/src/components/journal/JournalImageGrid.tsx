import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_GOLD, BG_AVATAR, BORDER_SUBTLE, RADIUS_BTN } from '../../theme/designTokens';

interface JournalImageGridProps {
  images: string[];
  onRemove?: (index: number) => void;
}

export default function JournalImageGrid({ images, onRemove }: JournalImageGridProps) {
  return (
    <View style={styles.grid}>
      {images.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.imageWrap}>
          <Image source={{ uri }} style={styles.image} />
          {onRemove && (
            <TouchableOpacity style={styles.remove} onPress={() => onRemove(index)}>
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageWrap: { width: 76, height: 62, borderRadius: RADIUS_BTN, overflow: 'hidden', backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
  image: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT_GOLD },
});
