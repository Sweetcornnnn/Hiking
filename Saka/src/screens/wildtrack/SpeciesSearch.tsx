import React, { useEffect, useMemo, useState } from 'react';
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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SpeciesCard } from '../../components/wildtrack/SpeciesCard';
import { TaxonomyTree } from '../../components/wildtrack/TaxonomyTree';
import { DistributionMap } from '../../components/wildtrack/DistributionMap';
import { ObservationTimeline } from '../../components/wildtrack/ObservationTimeline';
import { SpeciesGallery } from '../../components/wildtrack/SpeciesGallery';

import { useSpeciesSearch } from '../../hooks/useSpeciesSearch';
import { useSpeciesDetails } from '../../hooks/useSpeciesDetails';
import { useOccurrenceData } from '../../hooks/useOccurrenceData';
import { useWildTrackStore } from '../../store/wildtrackStore';

export default function SpeciesSearchScreen() {
  const router = useRouter();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    selectedMountainId,
    createDiscovery,
    cacheSpecies,
  } = useWildTrackStore();

  const {
    query,
    setQuery,
    results,
    isFetching,
    hasMore,
    expandResults,
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

  const horizontalPadding = isLandscape ? 20 : 12;
  const cardWidth = (width - horizontalPadding - 24) / 2;

  const displayData = useMemo(
    () => detail || selectedSpecies,
    [detail, selectedSpecies]
  );

  const galleryImages = useMemo(() => {
    const images =
      detail?.gallery_images ||
      displayData?.gallery_images ||
      (displayData?.image_url ? [displayData.image_url] : []);

    return (images || []).filter(Boolean);
  }, [detail, displayData]);

  useEffect(() => {
    if (!detail) return;

    loadOccurrenceData(
      detail.gbif_id,
      detail.inaturalist_id
    );
  }, [detail]);

  const handleSelectSpecies = async (item: any) => {
    setSelectedSpecies(item);

    setModalOpen(true);

    try {
      await loadSpeciesDetails(item);
    } catch (error) {
      console.log('Species detail fetch failed:', error);
    }
  };

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;

    setMarking(true);

    try {
      const speciesId =
        typeof selectedSpecies.id === 'number'
          ? selectedSpecies.id
          : selectedSpecies.gbif_id ||
            selectedSpecies.inaturalist_id;

      const { error } = await createDiscovery(
        speciesId,
        selectedMountainId
      );

      if (!error) {
        await cacheSpecies(selectedSpecies);
      }
    } catch (error) {
      console.log('Mark discovery failed:', error);
    }

    setMarking(false);
    handleCloseModal();
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

  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#D4A574"
          />
        </Pressable>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={16}
            color="#64748B"
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
              <Ionicons
                name="close-circle"
                size={18}
                color="#64748B"
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* RESULTS */}
      <View style={styles.resultsContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsContent}
        >
          {isFetching ? (
            renderSkeleton()
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) =>
                item?.id?.toString?.() ||
                item?.scientific_name ||
                index.toString()
              }
              numColumns={2}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.columnWrapper}
              renderItem={({ item }) => (
                <View
                  style={{
                    width: cardWidth,
                    marginBottom: 12,
                  }}
                >
                  <SpeciesCard
                    species={item}
                    onPress={() => handleSelectSpecies(item)}
                    showDiscoveryStatus={false}
                  />
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrapper}>
                    <Ionicons
                      name="leaf-outline"
                      size={44}
                      color="#D4A574"
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    {query
                      ? 'No species found'
                      : 'Search biodiversity'}
                  </Text>

                  <Text style={styles.emptyText}>
                    Search by common name,
                    scientific name, or keyword.
                  </Text>
                </View>
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
      <Modal
        visible={modalOpen}
        animationType="fade"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>

            {/* HEADER */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrapper}>
                <Text
                  style={styles.modalTitle}
                  numberOfLines={2}
                >
                  {displayData?.common_name ||
                    displayData?.scientific_name ||
                    'Unknown Species'}
                </Text>

                <Text
                  style={styles.modalScientific}
                  numberOfLines={1}
                >
                  {displayData?.scientific_name || '—'}
                </Text>
              </View>

              <Pressable
                style={styles.closeModalButton}
                onPress={handleCloseModal}
              >
                <Ionicons
                  name="close"
                  size={20}
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
                  <ActivityIndicator
                    size="large"
                    color="#D4A574"
                  />

                  <Text style={styles.modalLoadingText}>
                    Loading species details...
                  </Text>
                </View>
              ) : detail ? (
                <View
                  style={[
                    styles.modalBody,
                    {
                      flexDirection: isLandscape
                        ? 'row'
                        : 'column',
                    },
                  ]}
                >
                  <View style={styles.modalLeft}>
                    {galleryImages.length > 0 ? (
                      <SpeciesGallery images={galleryImages} />
                    ) : (
                      <View style={styles.noImageCard}>
                        <Ionicons
                          name="images-outline"
                          size={28}
                          color="#94A3B8"
                        />
                        <Text style={styles.noImageText}>
                          No image data available
                        </Text>
                      </View>
                    )}

                    <View style={styles.infoSection}>
                      <TaxonomyTree taxonomy={detail?.taxonomy} />
                    </View>
                  </View>

                  <View style={styles.modalRight}>
                    <View style={styles.quickFactsCard}>
                      <Text style={styles.cardTitle}>Quick facts</Text>

                      <View style={styles.factRow}>
                        <Text style={styles.factLabel}>Status</Text>
                        <Text style={styles.factText}>
                          {detail?.conservation_status || 'Not listed'}
                        </Text>
                      </View>

                      <View style={styles.factRow}>
                        <Text style={styles.factLabel}>Habitat</Text>
                        <Text style={styles.factText}>
                          {detail?.habitat || 'Mountain ecosystem'}
                        </Text>
                      </View>

                      <View style={styles.factRow}>
                        <Text style={styles.factLabel}>Native</Text>
                        <Text style={styles.factText}>
                          {detail?.is_native === false ? 'Introduced' : 'Native'}
                        </Text>
                      </View>

                      <View style={styles.factRow}>
                        <Text style={styles.factLabel}>Occurrence</Text>
                        <Text style={styles.factText}>
                          {detail?.occurrence_count || records?.length || 0}{' '}
                          records
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoSection}>
                      <DistributionMap occurrences={records || []} />
                    </View>

                    <View style={styles.infoSection}>
                      <ObservationTimeline observations={records || []} />
                    </View>
                  </View>
                </View>
              ) : displayData ? (
                <View
                  style={[
                    styles.modalBody,
                    {
                      flexDirection: isLandscape
                        ? 'row'
                        : 'column',
                    },
                  ]}
                >
                  <View style={styles.modalLeft}>
                    <View style={styles.noImageCard}>
                      <Ionicons
                        name="leaf-outline"
                        size={28}
                        color="#94A3B8"
                      />
                      <Text style={styles.noImageText}>
                        Species summary unavailable
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.modalLoading}>
                  <Text style={styles.modalLoadingText}>
                    Unable to load species data.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* FOOTER */}
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.modalActionSecondary}
              >
                <Ionicons
                  name="share-social-outline"
                  size={15}
                  color="#E2E8F0"
                />

                <Text
                  style={
                    styles.modalActionTextSecondary
                  }
                >
                  Share Species
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalActionPrimary}
                onPress={handleMarkDiscovered}
                disabled={marking}
              >
                {marking ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="heart-outline"
                      size={15}
                      color="#FFFFFF"
                    />

                    /* Lines 546-552 omitted */
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
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    borderWidth: 1,
    borderColor: '#233047',
    paddingHorizontal: 12,
    height: 40,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },

  clearButton: {
    padding: 4,
  },

  resultsContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
  },

  resultsContent: {
    paddingBottom: 20,
  },

  columnWrapper: {
    justifyContent: 'space-between',
  },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  skeletonCard: {
    width: '48%',
    height: 220,
    backgroundColor: '#172033',
    borderRadius: 20,
    marginBottom: 12,
  },

  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#172033',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 18,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyText: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },

  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#D4A574',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  modalPanel: {
    width: '100%',
    maxWidth: 1500,
    maxHeight: '95%',
    backgroundColor: '#111827',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },

  modalTitleWrapper: {
    flex: 1,
    paddingRight: 12,
  },

  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },

  modalScientific: {
    marginTop: 4,
    color: '#D4A574',
    fontSize: 11,
    fontStyle: 'italic',
  },

  closeModalButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#172033',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    flex: 1,
  },

  modalContentContainer: {
    padding: 18,
  },

  modalBody: {
    gap: 18,
  },

  modalLeft: {
    flex: 0.48,
    gap: 16,
  },

  modalRight: {
    flex: 0.52,
    gap: 16,
  },

  quickFactsCard: {
    backgroundColor: '#172033',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#233047',
  },

  cardTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  factRow: {
    marginTop: 12,
  },

  factLabel: {
    color: '#64748B',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  factText: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },

  infoSection: {
    backgroundColor: '#172033',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#233047',
  },

  noImageCard: {
    height: 240,
    borderRadius: 22,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#233047',
    justifyContent: 'center',
    alignItems: 'center',
  },

  noImageText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },

  modalLoading: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalLoadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 12,
  },

  timelineLoading: {
    paddingVertical: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  timelineLoadingText: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 11,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },

  modalActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#172033',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#233047',
    paddingVertical: 14,
  },

  modalActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D4A574',
    borderRadius: 16,
    paddingVertical: 14,
  },

  modalActionTextSecondary: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },

  modalActionTextPrimary: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
