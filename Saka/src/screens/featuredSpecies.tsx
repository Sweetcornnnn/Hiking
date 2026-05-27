import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useWildTrackStore } from '../store/wildtrackStore';
import { SpeciesCard } from '../components/wildtrack/SpeciesCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function FeaturedSpeciesScreen() {
  const router = useRouter();
  const { featuredSpecies, fetchFeaturedSpecies, selectedMountainId, createDiscovery, cacheSpecies } = useWildTrackStore();
  const [selectedSpecies, setSelectedSpecies] = useState<any | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    console.log('[WildTrack] Featured species screen mounted');
    console.log(`[WildTrack] Loading featured species for mountain: ${selectedMountainId}`);
    fetchFeaturedSpecies(selectedMountainId);
  }, [selectedMountainId]);

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;
    console.log(`[WildTrack] Marking featured species as discovered: ${selectedSpecies.common_name}`);
    setMarking(true);
    
    const { error } = await createDiscovery(selectedSpecies.id, selectedMountainId);
    
    if (!error) {
      await cacheSpecies(selectedSpecies);
      console.log('[WildTrack] Featured species marked as discovered successfully');
    } else {
      console.error('[WildTrack] Error marking featured discovery:', error);
    }
    
    setMarking(false);
    setSelectedSpecies(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.title}>Featured Species</Text>
      </View>

      <FlatList
        data={featuredSpecies}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <SpeciesCard
            species={item}
            onPress={() => setSelectedSpecies(item)}
            isDiscovered={!!item.discovered}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color="#8B7355" />
            <Text style={styles.emptyTitle}>No Featured Species</Text>
            <Text style={styles.emptyText}>Featured species will appear here once curated for this mountain.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={!!selectedSpecies} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedSpecies(null)}
        >
          <View style={styles.modalContent}>
            {selectedSpecies && (
              <SpeciesCard
                species={selectedSpecies}
                onPress={() => {}}
                isDiscovered={!!selectedSpecies.discovered}
                showDiscoveryStatus={false}
              />
            )}
            {!selectedSpecies?.discovered && (
              <TouchableOpacity
                onPress={handleMarkDiscovered}
                style={styles.modalButton}
                disabled={marking}
              >
                {marking ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={20} color="#FFF" />
                    <Text style={styles.modalButtonText}>Mark as Discovered</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setSelectedSpecies(null)} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelButtonText}>Close</Text>
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelButton: {
    paddingVertical: 12,
  },
  modalCancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
