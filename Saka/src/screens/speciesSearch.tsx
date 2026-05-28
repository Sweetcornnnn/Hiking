import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SpeciesCard } from '../components/wildtrack/SpeciesCard';
import { TaxonomyTree } from '../components/wildtrack/TaxonomyTree';
import { DistributionMap } from '../components/wildtrack/DistributionMap';
import { ObservationTimeline } from '../components/wildtrack/ObservationTimeline';
import { SpeciesGallery } from '../components/wildtrack/SpeciesGallery';

import { useSpeciesSearch } from '../hooks/useSpeciesSearch';
import { useSpeciesDetails } from '../hooks/useSpeciesDetails';
import { useOccurrenceData } from '../hooks/useOccurrenceData';
import { useWildTrackStore } from '../store/wildtrackStore';

const { width, height } = Dimensions.get('window');
const isLandscape = width >= height;

export default function SpeciesSearchScreen() {
  const router = useRouter();
  const {
    selectedMountainId,
    createDiscovery,
    cacheSpecies,
  } = useWildTrackStore();

  const {
    query,
    setQuery,
    results,
    suggestions,
    isFetching,
    hasMore,
    expandResults,
    selectSuggestion,
  } = useSpeciesSearch();

  const {
    detail,
    isLoading: detailLoading,
    loadSpeciesDetails,
    clearSpeciesDetails,
  } = useSpeciesDetails();

  const {
    records,
    isLoading: occLoading,
    loadOccurrenceData,
  } = useOccurrenceData();

  const [selectedSpecies, setSelectedSpecies] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!detail) return;

    loadOccurrenceData(detail.gbif_id, detail.inaturalist_id);
  }, [detail, loadOccurrenceData]);

  const handleSelectSpecies = async (item: any) => {
    setSelectedSpecies(item);

    await loadSpeciesDetails(item);
    setModalOpen(true);
  };

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;

    setMarking(true);

    const speciesId =
      typeof selectedSpecies.id === 'number'
        ? selectedSpecies.id
        : selectedSpecies.gbif_id || selectedSpecies.inaturalist_id;

    const { error: discoveryError } = await createDiscovery(
      speciesId,
      selectedMountainId
    );

    if (!discoveryError) {
      await cacheSpecies(selectedSpecies);
    }

    setMarking(false);
    setModalOpen(false);
    setSelectedSpecies(null);
    clearSpeciesDetails();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedSpecies(null);
    clearSpeciesDetails();
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.skeletonCard} />
      ))}
    </View>
  );

  const horizontalPadding = isLandscape ? 16 : 12;

  const cardWidth = (width - horizontalPadding - 8) / 2;

  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER WITH BACK BUTTON AND SEARCH */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#D4A574" />
        </Pressable>

        <View style={styles.searchContainer}>
          <Ionicons 
            name="search-outline" 
            size={18} 
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search species..."
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable 
              onPress={() => setQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </Pressable>
          )}
        </View>
      </View>

      {/* RESULTS */}
      <View style={styles.resultsContainer}>
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={styles.resultScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isFetching ? (
            renderSkeleton()
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) =>
                item.id?.toString() || item.scientific_name
              }
              renderItem={({ item }) => (
                <View
                  style={{
                    width: cardWidth,
                    marginBottom: 4,
                  }}
                >
                  <SpeciesCard
                    species={item}
                    onPress={() => handleSelectSpecies(item)}
                    showDiscoveryStatus={false}
                  />
                </View>
              )}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                !isFetching && (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconWrapper}>
                      <Ionicons
                        name="leaf-outline"
                        size={56}
                        color="#D4A574"
                      />
                    </View>

                    <Text style={styles.emptyTitle}>
                      {query
                        ? 'No matching species found'
                        : 'Start exploring biodiversity'}
                    </Text>

                    <Text style={styles.emptyText}>
                      Type a species name, scientific name, or keyword to search.
                    </Text>
                  </View>
                )
              }
            />
          )}

          {hasMore && !isFetching && (
            <Pressable
              style={styles.loadMoreButton}
              onPress={expandResults}
            >
              <Text style={styles.loadMoreText}>
                Load More Species
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* MODAL */}
      <Modal visible={modalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            {/* HEADER */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrapper}>
                <Text
                  style={styles.modalTitle}
                  numberOfLines={2}
                >
                  {detail?.common_name ||
                    detail?.scientific_name}
                </Text>

                <Text
                  style={styles.modalScientific}
                  numberOfLines={1}
                >
                  {detail?.scientific_name}
                </Text>
              </View>

              <Pressable
                onPress={handleCloseModal}
                style={styles.closeModalButton}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#CBD5E1"
                />
              </Pressable>
            </View>

            {/* CONTENT */}
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {detailLoading ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator color="#D4A574" size="large" />
                  <Text style={styles.modalLoadingText}>
                    Loading species details...
                  </Text>
                </View>
              ) : detail ? (
              <View
                style={[
                  styles.modalBody,
                  {
                    flexDirection: isLandscape ? 'row' : 'column',
                  },
                ]}
              >
                {/* LEFT */}
                <View style={styles.modalLeft}>
                  <SpeciesGallery
                    images={
                      (detail?.gallery_images || [
                        detail?.image_url,
                      ].filter(Boolean)) as string[]
                    }
                  />

                  <View style={styles.quickFactsCard}>
                    <Text style={styles.cardTitle}>
                      Quick Facts
                    </Text>

                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>
                        Scientific Name
                      </Text>

                      <Text style={styles.factText}>
                        {detail?.scientific_name}
                      </Text>
                    </View>

                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>
                        Common Name
                      </Text>

                      <Text style={styles.factText}>
                        {detail?.common_name}
                      </Text>
                    </View>

                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>
                        Taxon Rank
                      </Text>

                      <Text style={styles.factText}>
                        {detail?.taxon_rank || 'Species'}
                      </Text>
                    </View>

                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>
                        Conservation
                      </Text>

                      <Text style={styles.factText}>
                        {detail?.conservation_status ||
                          'Data deficient'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* RIGHT */}
                <View style={styles.modalRight}>
                  <View style={styles.infoSection}>
                    <TaxonomyTree
                      taxonomy={detail?.taxonomy}
                    />
                  </View>

                  <View style={styles.infoSection}>
                    <DistributionMap
                      occurrences={records}
                    />
                  </View>

                  <View style={styles.infoSection}>
                    {occLoading ? (
                      <View style={styles.timelineLoading}>
                        <ActivityIndicator
                          color="#D4A574"
                        />

                        <Text
                          style={styles.timelineLoadingText}
                        >
                          Loading observations...
                        </Text>
                      </View>
                    ) : (
                      <ObservationTimeline
                        observations={records}
                      />
                    )}
                  </View>
                </View>
              </View>
              ) : null}
            </ScrollView>

            {/* FOOTER */}
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.modalActionSecondary}
                onPress={() => {}}
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color="#E2E8F0"
                />

                <Text style={styles.modalActionTextSecondary}>
                  Share Species
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalActionPrimary}
                onPress={handleMarkDiscovered}
                disabled={marking}
              >
                {marking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="heart-outline"
                      size={16}
                      color="#FFFFFF"
                    />

                    <Text style={styles.modalActionTextPrimary}>
                      Mark Discovered
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1220',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#0B1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#233047',
  },

  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#233047',
    height: 36,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  resultsContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  resultScroll: {
    flex: 1,
  },

  resultScrollContent: {
    paddingBottom: 8,
  },

  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 8,
  },

  emptyState: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 12,
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 420,
  },

  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 6,
    backgroundColor: '#D4A574',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  loadMoreText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
  },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },

  skeletonCard: {
    width: 200,
    height: 200,
    borderRadius: 18,
    backgroundColor: '#172033',
    marginBottom: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isLandscape ? 32 : 18,
    paddingVertical: isLandscape ? 24 : 18,
  },

  modalPanel: {
    width: '100%',
    maxWidth: isLandscape ? 1400 : 900,
    maxHeight: isLandscape ? '92%' : '94%',
    backgroundColor: '#111827',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: isLandscape ? 28 : 22,
    paddingVertical: isLandscape ? 22 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 16,
  },

  modalTitleWrapper: {
    flex: 1,
  },

  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },

  modalScientific: {
    marginTop: 6,
    color: '#D4A574',
    fontSize: 10,
    fontStyle: 'italic',
  },

  closeModalButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    flex: 1,
  },

  modalContentContainer: {
    padding: isLandscape ? 24 : 20,
  },

  modalBody: {
    gap: isLandscape ? 24 : 18,
  },

  modalLeft: {
    flex: isLandscape ? 0.48 : 1,
    gap: isLandscape ? 20 : 18,
  },

  modalRight: {
    flex: isLandscape ? 0.52 : 1,
    gap: isLandscape ? 20 : 18,
  },

  quickFactsCard: {
    backgroundColor: '#172033',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#233047',
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },

  factRow: {
    marginTop: 14,
  },

  factLabel: {
    color: '#64748B',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  factText: {
    marginTop: 5,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '500',
  },

  infoSection: {
    backgroundColor: '#172033',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#233047',
  },

  timelineLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  timelineLoadingText: {
    color: '#94A3B8',
    fontSize: 10,
  },

  modalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  modalLoadingText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 8,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },

  modalActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#233047',
    paddingVertical: 15,
  },

  modalActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#D4A574',
    paddingVertical: 15,
  },

  modalActionTextSecondary: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 10,
  },

  modalActionTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
  },
});