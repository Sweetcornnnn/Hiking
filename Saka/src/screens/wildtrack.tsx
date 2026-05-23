import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWildTrackStore, Species } from '../store/wildtrackStore';
import { useAuthStore } from '../store/authStore';
import { SpeciesCarousel } from '../components/wildtrack/SpeciesCarousel';
import { ProgressCard } from '../components/wildtrack/ProgressCard';
import { getMountainBiodiversity } from '../data/curatedSpecies';

const MOUNTAINS = [
  { id: '1', name: 'Mt. Madjaas', image: require('../../assets/images/Mt. Madjaas.jpg') },
  { id: '2', name: 'Mt. Guiting-Guiting', image: require('../../assets/images/Mt. Guiting-Guiting.jpg') },
  { id: '3', name: 'Mt. Pulag', image: require('../../assets/images/Mt. Pulag.jpg') },
  { id: '4', name: 'Mt. Apo', image: require('../../assets/images/Mt. Apo.jpg') },
  { id: '5', name: 'Mt. Mayon', image: require('../../assets/images/Mt. Mayon.jpg') },
  { id: '6', name: 'Mt. Kanlaon', image: require('../../assets/images/Mt. Kanlaon.jpg') },
];

export default function WildTrackScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    selectedMountainId,
    setSelectedMountainId,
    featuredSpecies,
    mountainSpecies,
    stats,
    isLoading,
    fetchFeaturedSpecies,
    fetchMountainSpecies,
    fetchStats,
    fetchMountainBiodiversity,
    mountainBiodiversity,
    createDiscovery,
  } = useWildTrackStore();

  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showMountainInfo, setShowMountainInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentMountain = MOUNTAINS.find(m => m.id === selectedMountainId) || MOUNTAINS[0];
  const localMountainInfo = getMountainBiodiversity(selectedMountainId);

  useEffect(() => {
    console.log('[WildTrack] WildTrack screen mounted');
    loadWildTrackData();
  }, [selectedMountainId]);

  const loadWildTrackData = async () => {
    console.log(`[WildTrack] Loading data for mountain: ${selectedMountainId}`);
    await Promise.all([
      fetchFeaturedSpecies(selectedMountainId),
      fetchMountainSpecies(selectedMountainId),
      fetchStats(selectedMountainId),
      fetchMountainBiodiversity(selectedMountainId),
    ]);
  };

  const handleSpeciesPress = (species: Species) => {
    setSelectedSpecies(species);
    setShowLockedModal(true);
  };

  const handleDiscoverSpecies = async () => {
    if (!selectedSpecies) return;

    console.log(`[WildTrack] Marking species as discovered: ${selectedSpecies.common_name}`);
    const { error } = await createDiscovery(
      selectedSpecies.id,
      selectedMountainId,
    );

    if (!error) {
      setShowLockedModal(false);
      setSelectedSpecies(null);
      await loadWildTrackData();
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      console.log(`[WildTrack] Navigating to search with query: ${searchQuery}`);
      router.push('/speciesSearch');
    }
  };

  const mountainInfo = mountainBiodiversity || localMountainInfo;

  // Type compatibility - ensure we use the correct property names
  const displayMountainInfo = mountainInfo ? {
    ...mountainInfo,
    curated_species_count: (mountainInfo as any).curated_species_count || (mountainInfo as any).curatedSpeciesCount || 0,
    endemic_species_count: (mountainInfo as any).endemic_species_count || (mountainInfo as any).endemicSpeciesCount || 0,
    conservation_status: (mountainInfo as any).conservation_status || (mountainInfo as any).conservationStatus || '',
  } : null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <View style={styles.hero}>
          <Image source={currentMountain.image} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.replace('/drawer/home')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            {/* Search Bar */}
            <TouchableOpacity 
              onPress={() => router.push('/speciesSearch')}
              style={styles.searchBar}
            >
              <Ionicons name="search" size={18} color="#FFF" />
              <Text style={styles.searchPlaceholder}>Search species...</Text>
            </TouchableOpacity>

            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>WildTrack</Text>
              <Text style={styles.heroSubtitle}>
                {currentMountain.name} Biodiversity
              </Text>
            </View>
          </View>
        </View>

        {/* Mountain Selector */}
        <View style={styles.mountainSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {MOUNTAINS.map((mountain) => (
              <TouchableOpacity
                key={mountain.id}
                onPress={() => setSelectedMountainId(mountain.id)}
                style={[
                  styles.mountainButton,
                  selectedMountainId === mountain.id && styles.mountainButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.mountainButtonText,
                    selectedMountainId === mountain.id && styles.mountainButtonTextActive,
                  ]}
                >
                  {mountain.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Mountain Info Section */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setShowMountainInfo(!showMountainInfo)}
            style={styles.mountainInfoHeader}
          >
            <View style={styles.mountainInfoTitleRow}>
              <Ionicons name="information-circle" size={20} color="#2C3E50" />
              <Text style={styles.mountainInfoTitle}>Mountain Biodiversity</Text>
            </View>
            <Ionicons 
              name={showMountainInfo ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#8B7355" 
            />
          </TouchableOpacity>
          
          {showMountainInfo && displayMountainInfo && (
            <View style={styles.mountainInfoContent}>
              <Text style={styles.mountainInfoDescription}>{displayMountainInfo.description}</Text>
              <View style={styles.mountainInfoStats}>
                <View style={styles.mountainInfoStat}>
                  <Text style={styles.mountainInfoStatValue}>{displayMountainInfo.curated_species_count}</Text>
                  <Text style={styles.mountainInfoStatLabel}>Curated Species</Text>
                </View>
                <View style={styles.mountainInfoStat}>
                  <Text style={styles.mountainInfoStatValue}>{displayMountainInfo.endemic_species_count}</Text>
                  <Text style={styles.mountainInfoStatLabel}>Endemic Species</Text>
                </View>
              </View>
              <View style={styles.mountainInfoTags}>
                <Text style={styles.mountainInfoTag}>{displayMountainInfo.ecosystem}</Text>
                <Text style={[styles.mountainInfoTag, styles.mountainInfoTagConservation]}>{displayMountainInfo.conservation_status}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Discovery Progress Card */}
        <View style={styles.section}>
          <ProgressCard
            stats={stats}
            mountainName={currentMountain.name}
            onExplorePress={() => router.push('/speciesSearch')}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={() => router.push('/discoveries')}
              style={styles.quickActionButton}
            >
              <Ionicons name="trophy-outline" size={24} color="#2C3E50" />
              <Text style={styles.quickActionLabel}>Discoveries</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/featuredSpecies')}
              style={styles.quickActionButton}
            >
              <Ionicons name="star-outline" size={24} color="#2C3E50" />
              <Text style={styles.quickActionLabel}>Featured</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Endemic Species Carousel */}
        {featuredSpecies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Endemic Species</Text>
            <SpeciesCarousel
              species={featuredSpecies}
              onSpeciesPress={handleSpeciesPress}
              discoveredSpecies={new Set()}
            />
          </View>
        )}

        {/* Species Around This Mountain */}
        {mountainSpecies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Species Around This Mountain</Text>
            <View style={styles.speciesGrid}>
              {mountainSpecies.slice(0, 6).map((species) => (
                <TouchableOpacity
                  key={species.id}
                  onPress={() => handleSpeciesPress(species)}
                  style={styles.gridItem}
                >
                  <View style={styles.gridItemImage}>
                    {species.image_url ? (
                      <Image
                        source={{ uri: species.image_url }}
                        style={styles.gridImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Image
                        source={require('../../assets/images/wildtrackdefaultimg.png')}
                        style={styles.gridImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <Text style={styles.gridItemName} numberOfLines={1}>
                    {species.common_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {mountainSpecies.length > 6 && (
              <TouchableOpacity
                onPress={() => router.push('/speciesSearch')}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllButtonText}>View All Species</Text>
                <Ionicons name="chevron-forward" size={16} color="#2C3E50" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Species Detail Modal */}
      <Modal visible={showLockedModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLockedModal(false)}
        >
          <View style={styles.speciesModalContent}>
            {selectedSpecies && (
              <>
                <View style={styles.speciesModalImageContainer}>
                  {selectedSpecies.image_url ? (
                    <Image
                      source={{ uri: selectedSpecies.image_url }}
                      style={styles.speciesModalImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require('../../assets/images/wildtrackdefaultimg.png')}
                      style={styles.speciesModalImage}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <View style={styles.speciesModalInfo}>
                  <Text style={styles.speciesModalName}>{selectedSpecies.common_name}</Text>
                  <Text style={styles.speciesModalScientific}>{selectedSpecies.scientific_name}</Text>
                  {selectedSpecies.description && (
                    <Text style={styles.speciesModalDescription}>{selectedSpecies.description}</Text>
                  )}
                  {selectedSpecies.habitat && (
                    <View style={styles.speciesModalMeta}>
                      <Ionicons name="location-outline" size={16} color="#8B7355" />
                      <Text style={styles.speciesModalMetaText}>{selectedSpecies.habitat}</Text>
                    </View>
                  )}
                  {selectedSpecies.category && (
                    <View style={styles.speciesModalMeta}>
                      <Ionicons name="pricetag-outline" size={16} color="#8B7355" />
                      <Text style={styles.speciesModalMetaText}>{selectedSpecies.category}</Text>
                    </View>
                  )}
                </View>
                {!selectedSpecies.discovered && (
                  <TouchableOpacity
                    onPress={handleDiscoverSpecies}
                    style={styles.speciesModalButton}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={20} color="#FFF" />
                        <Text style={styles.speciesModalButtonText}>Mark as Discovered</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {selectedSpecies.discovered && (
                  <View style={styles.speciesModalDiscovered}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.speciesModalDiscoveredText}>Already Discovered</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setShowLockedModal(false)}
                  style={styles.speciesModalCancelButton}
                >
                  <Text style={styles.speciesModalCancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
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
  scrollView: {
    flex: 1,
  },
  hero: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 8,
    opacity: 0.8,
  },
  heroContent: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
  mountainSelector: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  mountainButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mountainButtonActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  mountainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  mountainButtonTextActive: {
    color: '#FFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  mountainInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  mountainInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mountainInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
  },
  mountainInfoContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  mountainInfoDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  mountainInfoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  mountainInfoStat: {
    alignItems: 'center',
  },
  mountainInfoStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C3E50',
  },
  mountainInfoStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  mountainInfoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mountainInfoTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
    backgroundColor: '#F5E6D3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mountainInfoTagConservation: {
    backgroundColor: '#D4A574',
    color: '#FFF',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 12,
  },
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    width: '33.33%',
    padding: 8,
  },
  gridItemImage: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  lockedImage: {
    opacity: 0.5,
    filter: 'grayscale(100%)',
  },
  gridImagePlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginRight: 4,
  },
  spacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5E6D3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
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
    width: '100%',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  modalCancelButton: {
    paddingVertical: 12,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  speciesModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 0,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  speciesModalImageContainer: {
    height: 200,
  },
  speciesModalImage: {
    width: '100%',
    height: '100%',
  },
  speciesModalImagePlaceholder: {
    backgroundColor: '#F5E6D3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speciesModalInfo: {
    padding: 20,
  },
  speciesModalName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 4,
  },
  speciesModalScientific: {
    fontSize: 14,
    color: '#8B7355',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  speciesModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  speciesModalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  speciesModalMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  speciesModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    gap: 8,
  },
  speciesModalButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  speciesModalDiscovered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    gap: 8,
  },
  speciesModalDiscoveredText: {
    color: '#16A34A',
    fontSize: 15,
    fontWeight: '600',
  },
  speciesModalCancelButton: {
    paddingVertical: 12,
    marginHorizontal: 20,
  },
  speciesModalCancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
