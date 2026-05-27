import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useWildTrackStore } from '../store/wildtrackStore';
import { SpeciesCard } from '../components/wildtrack/SpeciesCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function DiscoveriesScreen() {
  const router = useRouter();
  const { discoveries, fetchDiscoveries, selectedMountainId, removeDiscovery } = useWildTrackStore();
  const [selectedDiscovery, setSelectedDiscovery] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    console.log('[WildTrack] Discoveries screen mounted');
    fetchDiscoveries(selectedMountainId);
  }, [selectedMountainId]);

  const handleRemoveDiscovery = async () => {
    if (!selectedDiscovery) return;
    console.log(`[WildTrack] Removing discovery: ${selectedDiscovery.id}`);
    setRemoving(true);

    const { error } = await removeDiscovery(selectedDiscovery.id);

    if (!error) {
      console.log('[WildTrack] Discovery removed successfully');
      setSelectedDiscovery(null);
    } else {
      console.error('[WildTrack] Error removing discovery:', error);
    }

    setRemoving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>My Discoveries</Text>
          <Text style={styles.subtitle}>{discoveries.length} species discovered</Text>
        </View>
      </View>

      <FlatList
        data={discoveries}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedDiscovery(item)} style={styles.gridItem}>
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
              isDiscovered={true}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={64} color="#8B7355" />
            <Text style={styles.emptyTitle}>No Discoveries Yet</Text>
            <Text style={styles.emptyText}>
              Start exploring to discover species in the wild. Mark species as discovered while hiking.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={!!selectedDiscovery} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDiscovery(null)}
        >
          <View style={styles.modalContent}>
            {selectedDiscovery && (
              <SpeciesCard
                species={{
                  id: selectedDiscovery.species_id,
                  scientific_name: selectedDiscovery.scientific_name || 'Unknown',
                  common_name: selectedDiscovery.common_name || 'Unknown',
                  category: selectedDiscovery.category || 'Others',
                  conservation_status: selectedDiscovery.conservation_status,
                  image_url: selectedDiscovery.image_url,
                  discovered: true,
                }}
                onPress={() => {}}
                isDiscovered={true}
                showDiscoveryStatus={false}
              />
            )}
            <TouchableOpacity
              onPress={handleRemoveDiscovery}
              style={styles.removeButton}
              disabled={removing}
            >
              {removing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#FFF" />
                  <Text style={styles.removeButtonText}>Remove Discovery</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedDiscovery(null)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gridItem: {
    width: CARD_WIDTH,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
