import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { ACCENT_GOLD, BG_AVATAR, BORDER_SUBTLE, TEXT_FAINT } from '../../theme/designTokens';
import { supabase } from '../../lib/supabase';
import type { JournalEntry } from '../../types/journal';

interface JournalShowcaseProps {
  entries: JournalEntry[];
  isLoading?: boolean;
}

const getImageUrl = (image: string): string => {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl;
};

export default function JournalShowcase({ entries, isLoading = false }: JournalShowcaseProps) {
  const images = entries.flatMap((entry) => entry.images || []).slice(0, 12);

  if (isLoading) return <ActivityIndicator color={ACCENT_GOLD} size="small" />;
  if (!images.length) {
    return <Text style={styles.empty}>Your saved journal photos will appear here.</Text>;
  }

  return (
    <View style={styles.grid}>
      {images.map((image, index) => {
        const imageUrl = getImageUrl(image);

        return (
          <Image
            key={`${image}-${index}`}
            source={{ uri: imageUrl }}
            style={styles.image}
            onError={(event) => {
              console.error(
                '[JournalShowcase] Image failed:',
                imageUrl,
                event.nativeEvent.error,
              );
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  image: { width: 67, height: 55, borderRadius: 6, backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
  empty: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14 },
});
