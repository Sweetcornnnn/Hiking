import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWildTrackStore } from '../../store/wildtrackStore';
import { SpeciesCard } from '../../components/wildtrack/SpeciesCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  ACCENT_GREEN,
  RADIUS_BTN,
} from '../../theme/designTokens';

const COLUMNS = 3;
const GRID_GAP = 8;
const H_PADDING = 10;

export default function FeaturedSpeciesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    featuredSpecies,
    fetchFeaturedSpecies,
    selectedMountainId,
    createDiscovery,
    cacheSpecies,
  } = useWildTrackStore();

  const [selectedSpecies, setSelectedSpecies] = useState<any | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchFeaturedSpecies(selectedMountainId);
  }, [selectedMountainId]);

  const cardWidth = (width - H_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;

    setMarking(true);
    const { error } = await createDiscovery(selectedSpecies.id, selectedMountainId);
    if (!error) await cacheSpecies(selectedSpecies);
    setMarking(false);
    setSelectedSpecies(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Featured Species</Text>
          <Text style={styles.subtitle}>Curated for this mountain</Text>
        </View>

        <View style={styles.headerBadge}>
          <Ionicons name="leaf-outline" size={13} color={ACCENT_GOLD} />
          <Text style={styles.headerBadgeText}>{featuredSpecies.length}</Text>
        </View>
      </View>

      {/* GRID */}
      <FlatList
        key={`featured-species-grid-${COLUMNS}`}
        data={featuredSpecies}
        numColumns={COLUMNS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <SpeciesCard
              species={item}
              onPress={() => setSelectedSpecies(item)}
              isDiscovered={!!item.discovered}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="star-outline" size={40} color={ACCENT_GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No Featured Species</Text>
            <Text style={styles.emptyText}>
              Featured species will appear here once curated for this mountain.
            </Text>
          </View>
        }
      />

      {/* MODAL — landscape species profile */}
      <Modal visible={!!selectedSpecies} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedSpecies(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedSpecies && (
              <>
                <View style={styles.modalImageWrap}>
                  {selectedSpecies.image_url ? (
                    <Image
                      source={{ uri: selectedSpecies.image_url }}
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.modalImageFallback}>
                      <Ionicons name="leaf-outline" size={34} color={TEXT_MUTED} />
                    </View>
                  )}
                </View>

                <View style={styles.modalTextBlock}>
                  <Text style={styles.modalName} numberOfLines={1}>
                    {selectedSpecies.common_name || 'Species'}
                  </Text>
                  <Text style={styles.modalScientific} numberOfLines={1}>
                    {selectedSpecies.scientific_name}
                  </Text>
                  <Text style={styles.modalDescription} numberOfLines={4}>
                    {selectedSpecies.description ||
                      'This featured species is part of the mountain checklist. Mark it discovered when you spot it on trail.'}
                  </Text>

                  {selectedSpecies.discovered ? (
                    <View style={styles.discoveredBadge}>
                      <Ionicons name="checkmark-circle" size={15} color={ACCENT_GREEN} />
                      <Text style={styles.discoveredText}>Discovered</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleMarkDiscovered}
                      style={styles.modalButton}
                      disabled={marking}
                    >
                      {marking ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="eye-outline" size={18} color="#FFF" />
                          <Text style={styles.modalButtonText}>Mark as Discovered</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_CARD },

  header: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginRight: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: TEXT_PRIMARY },
  subtitle: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerBadgeText: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },

  listContent: { padding: H_PADDING, paddingBottom: 28 },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },

  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  emptyText: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', lineHeight: 18 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    flexDirection: 'row',
    width: '92%',
    maxWidth: 460,
    height: 240,
    backgroundColor: BG_PANEL,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalImageWrap: {
    flex: 1.3,
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  modalImage: { width: '100%', height: '100%' },
  modalImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalTextBlock: { flex: 1, justifyContent: 'center', gap: 4 },
  modalName: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  modalScientific: { color: ACCENT_GOLD, fontSize: 12, fontStyle: 'italic' },
  modalDescription: { color: TEXT_MUTED, fontSize: 12, lineHeight: 17, marginTop: 6 },
  discoveredBadge: {
    marginTop: 14,
    backgroundColor: BG_SUBTLE,
    borderRadius: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  discoveredText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  modalButton: {
    marginTop: 14,
    backgroundColor: ACCENT_GREEN,
    borderRadius: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});