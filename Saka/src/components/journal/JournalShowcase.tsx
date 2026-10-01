import React from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
            <View style={styles.grid}>
              {group.images.map(({ entry, image }, index) => {
                const imageUrl = getImageUrl(image);

                return (
                  <TouchableOpacity
                    key={`${entry.id}-${image}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Read journal entry: ${entry.title || group.name}`}
                    onPress={() => setSelectedPhoto({ entry, image, mountainName: group.name })}
                    activeOpacity={0.8}
                  >
                    <Image
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
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptySection}>No photos yet.</Text>
          )}
        </View>
      ))}
    </ScrollView>
    <Modal
      visible={selectedPhoto !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setSelectedPhoto(null)}
    >
      {selectedPhoto && (
        <View style={styles.detailScreen}>
          <Image source={{ uri: getImageUrl(selectedPhoto.image) }} style={styles.detailImage} resizeMode="contain" />
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
            <View style={styles.detailHeader}>
              <View style={styles.detailHeading}>
                <Text style={styles.detailMountain}>{selectedPhoto.mountainName}</Text>
                <Text style={styles.detailDate}>{new Date(selectedPhoto.entry.created_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close journal entry"
                onPress={() => setSelectedPhoto(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
            <Text style={styles.detailTitle}>{selectedPhoto.entry.title || 'Trail memory'}</Text>
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
            ) : null}
            <Text style={styles.detailText}>{selectedPhoto.entry.content || 'No experience was written for this entry.'}</Text>
          </ScrollView>
        </View>
      )}
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  groups: { gap: 16, width: '100%', paddingBottom: 8 },
  group: { gap: 7, width: '100%' },
  mountainName: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  image: { width: 110, height: 85, borderRadius: 6, backgroundColor: BG_AVATAR, borderWidth: 1, borderColor: BORDER_SUBTLE },
  empty: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14 },
  emptySection: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14 },
  detailScreen: { flex: 1, flexDirection: 'row', backgroundColor: BG_PANEL },
  detailImage: { flex: 1, backgroundColor: '#080B10' },
  detailScroll: { flex: 1, backgroundColor: BG_PANEL },
  detailContent: { padding: 24, gap: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailHeading: { gap: 4 },
  detailMountain: { color: ACCENT_GOLD, fontSize: 12, fontWeight: '700' },
  detailDate: { color: TEXT_FAINT, fontSize: 11 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: BG_SUBTLE },
  detailTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: 4 },
  detailText: { color: TEXT_MUTED, fontSize: 15, lineHeight: 23 },
});
