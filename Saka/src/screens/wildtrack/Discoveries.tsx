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
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useWildTrackStore } from '../../store/wildtrackStore';
import { SpeciesCard } from '../../components/wildtrack/SpeciesCard';

import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
} from '../../theme/designTokens';

const COLUMNS = 3;
const GRID_GAP = 10;
const H_PADDING = 10;

export default function DiscoveriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { discoveries, fetchDiscoveries, selectedMountainId, removeDiscovery } =
    useWildTrackStore();

  const [selectedDiscovery, setSelectedDiscovery] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    fetchDiscoveries(selectedMountainId);
  }, [selectedMountainId]);

  const cardWidth = (width - H_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const handleRemoveDiscovery = async () => {
    if (!selectedDiscovery) return;

    setRemoving(true);
    const { error } = await removeDiscovery(selectedDiscovery.id);
    if (!error) setSelectedDiscovery(null);
    setRemoving(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>My Discoveries</Text>
          <Text style={styles.subtitle}>{discoveries.length} species discovered</Text>
        </View>

        <View style={styles.discoveryBadge}>
          <Ionicons name="leaf-outline" size={13} color={ACCENT_GOLD} />
        </View>
      </View>

      {/* GRID */}
      <FlatList
        data={discoveries}
        keyExtractor={(item) => item.id.toString()}
        numColumns={COLUMNS}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <SpeciesCard
              species={{
                id: item.species_id,
                scientific_name: item.scientific_name || 'Unknown',
                common_name: item.common_name || 'Unknown',
                category: item.category || 'Others',
                conservation_status: item.conservation_status,
                image_url: item.image_url,
                discovered: true,
              }}
              onPress={() => setSelectedDiscovery(item)}
              isDiscovered
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="leaf-outline" size={36} color={ACCENT_GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No Discoveries Yet</Text>
            <Text style={styles.emptyText}>
              Start exploring mountain ecosystems and mark species discoveries during your
              hiking adventures.
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.replace('/wildtrack/WildTrack')}
              activeOpacity={0.85}
            >
              <Ionicons name="compass-outline" size={16} color="#FFF" />
              <Text style={styles.exploreButtonText}>Explore WildTrack</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* MODAL — landscape species profile */}
      <Modal visible={!!selectedDiscovery} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDiscovery(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedDiscovery && (
              <>
                <View style={styles.modalImageWrap}>
                  {selectedDiscovery.image_url ? (
                    <Image
                      source={{
                        uri:
                          typeof selectedDiscovery.image_url === 'number'
                            ? Image.resolveAssetSource(selectedDiscovery.image_url).uri
                            : selectedDiscovery.image_url,
                      }}
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
                    {selectedDiscovery.common_name || 'Discovery'}
                  </Text>
                  <Text style={styles.modalScientific} numberOfLines={1}>
                    {selectedDiscovery.scientific_name || 'Unknown species'}
                  </Text>
                  <Text style={styles.modalDescription} numberOfLines={4}>
                    {selectedDiscovery.category || 'Wildlife'}
                    {selectedDiscovery.conservation_status
                      ? ` • ${selectedDiscovery.conservation_status}`
                      : ''}
                  </Text>

                  <View style={styles.discoveredBadge}>
                    <Ionicons name="checkmark-circle" size={15} color={ACCENT_GOLD} />
                    <Text style={styles.discoveredText}>Recorded</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleRemoveDiscovery}
                    style={styles.removeButton}
                    disabled={removing}
                    activeOpacity={0.85}
                  >
                    {removing ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={18} color="#FFF" />
                        <Text style={styles.removeButtonText}>Remove Discovery</Text>
                      </>
                    )}
                  </TouchableOpacity>

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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: TEXT_PRIMARY },
  subtitle: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  discoveryBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  listContent: { padding: H_PADDING, paddingBottom: 24, flexGrow: 1 },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  emptyIconWrapper: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  emptyText: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: ACCENT_GOLD,
    gap: 8,
  },
  exploreButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

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
  removeButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0392B',
    borderRadius: 13,
    paddingVertical: 12,
    gap: 8,
  },
  removeButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});