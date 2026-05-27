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
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeciesCard } from '../components/wildtrack/SpeciesCard';
import { SpeciesSearchFilters } from '../components/wildtrack/SpeciesSearchFilters';
import { TaxonomyTree } from '../components/wildtrack/TaxonomyTree';
import { DistributionMap } from '../components/wildtrack/DistributionMap';
import { ObservationTimeline } from '../components/wildtrack/ObservationTimeline';
import { SpeciesGallery } from '../components/wildtrack/SpeciesGallery';
import { useSpeciesSearch } from '../hooks/useSpeciesSearch';
import { useSpeciesDetails } from '../hooks/useSpeciesDetails';
import { useOccurrenceData } from '../hooks/useOccurrenceData';
import { useWildTrackStore } from '../store/wildtrackStore';

export default function SpeciesSearchScreen() {
  const { selectedMountainId, createDiscovery, cacheSpecies } = useWildTrackStore();
  const {
    query,
    setQuery,
    filters,
    setFilter,
    clearFilters,
    categoryLabels,
    regionOptions,
    mountainOptions,
    results,
    suggestions,
    isFetching,
    hasMore,
    expandResults,
    selectSuggestion,
  } = useSpeciesSearch();

  const { detail, loadSpeciesDetails, clearSpeciesDetails } = useSpeciesDetails();
  const { records, isLoading: occLoading, loadOccurrenceData } = useOccurrenceData();

  const [selectedSpecies, setSelectedSpecies] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const dimensions = useWindowDimensions();

  const handleSelectSpecies = async (item: any) => {
    setSelectedSpecies(item);
    setModalOpen(true);
    await loadSpeciesDetails(item);
  };

  useEffect(() => {
    if (!detail) return;
    loadOccurrenceData(detail.gbif_id, detail.inaturalist_id);
  }, [detail, loadOccurrenceData]);

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;
    setMarking(true);

    const speciesId = typeof selectedSpecies.id === 'number'
      ? selectedSpecies.id
      : selectedSpecies.gbif_id || selectedSpecies.inaturalist_id;

    const { error: discoveryError } = await createDiscovery(speciesId, selectedMountainId);

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

  const cardWidth = Math.max((dimensions.width - 420) / 2 - 16, 260);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.heading}>WildTrack Explorer</Text>
          <Text style={styles.subheading}>Discover Philippine Mountain Biodiversity</Text>
        </View>
        <Pressable style={styles.badgeAction}>
          <Ionicons name="leaf-outline" size={18} color="#0F766E" />
          <Text style={styles.badgeActionText}></Text>
        </Pressable>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.leftPanel}>
          <SpeciesSearchFilters
            query={query}
            onQueryChange={setQuery}
            onSearch={() => {}}
            suggestions={suggestions}
            onSelectSuggestion={selectSuggestion}
            filters={filters}
            setFilter={setFilter}
            clearFilters={clearFilters}
            categoryLabels={categoryLabels}
            regionOptions={regionOptions}
            mountainOptions={mountainOptions}
            isLoading={isFetching}
          />
        </View>

        <View style={styles.rightPanel}>
          <View style={styles.summaryBar}>
            <View>
              <Text style={styles.resultsTitle}>Explorer results</Text>
              <Text style={styles.resultsSubtitle}>{results.length} species loaded{isFetching ? ' · fetching...' : ''}</Text>
            </View>
            <View style={styles.summaryBadges}>
              <View style={styles.summaryBadge}><Text style={styles.summaryBadgeText}>{filters.category !== 'all' ? filters.category : 'All categories'}</Text></View>
              <View style={styles.summaryBadge}><Text style={styles.summaryBadgeText}>{filters.region === 'philippines' ? 'Philippines only' : regionOptions.find((option) => option.key === filters.region)?.label}</Text></View>
            </View>
          </View>

          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            {isFetching ? renderSkeleton() : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id?.toString() || item.scientific_name}
                renderItem={({ item }) => (
                  <View style={{ width: cardWidth, marginBottom: 14 }}>
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
                ListEmptyComponent={!isFetching && (
                  <View style={styles.emptyState}>
                    <Ionicons name="earth-outline" size={64} color="#0F766E" />
                    <Text style={styles.emptyTitle}>{query ? 'No matching species' : 'Start searching the biodiversity database'}</Text>
                    <Text style={styles.emptyText}>Use the left filters to narrow your search by mountain, category, endemic status, or habitat.</Text>
                  </View>
                )}
              />
            )}

            {hasMore && !isFetching && (
              <Pressable style={styles.loadMoreButton} onPress={expandResults}>
                <Text style={styles.loadMoreText}>Load more species</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detail?.common_name || detail?.scientific_name}</Text>
              <Pressable onPress={handleCloseModal} style={styles.closeModalButton}>
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={styles.modalLeft}>
                  <SpeciesGallery images={detail?.gallery_images || [detail?.image_url].filter(Boolean) as string[]} />
                  <View style={styles.quickFactsCard}>
                    <Text style={styles.cardTitle}>Quick facts</Text>
                    <Text style={styles.factLabel}>Scientific name</Text>
                    <Text style={styles.factText}>{detail?.scientific_name}</Text>
                    <Text style={styles.factLabel}>Common name</Text>
                    <Text style={styles.factText}>{detail?.common_name}</Text>
                    <Text style={styles.factLabel}>Taxon rank</Text>
                    <Text style={styles.factText}>{detail?.taxon_rank || 'Species'}</Text>
                    <Text style={styles.factLabel}>Status</Text>
                    <Text style={styles.factText}>{detail?.conservation_status || 'Data deficient'}</Text>
                  </View>
                </View>
                <View style={styles.modalRight}>
                  <TaxonomyTree taxonomy={detail?.taxonomy} />
                  <DistributionMap occurrences={records} />
                  <ObservationTimeline observations={records} />
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.modalAction} onPress={() => {}}>
                <Ionicons name="share-social-outline" size={16} color="#0F172A" />
                <Text style={styles.modalActionText}>Share Species</Text>
              </Pressable>
              <Pressable style={[styles.modalAction, styles.modalActionPrimary]} onPress={handleMarkDiscovered} disabled={marking}>
                <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>{marking ? 'Saving...' : 'Mark discovered'}</Text>
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
    backgroundColor: '#F1F7FB',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  subheading: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    maxWidth: '70%',
    lineHeight: 20,
  },
  badgeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#DBF7F3',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  badgeActionText: {
    color: '#0F766E',
    fontWeight: '700',
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  leftPanel: {
    width: 360,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 30,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 18,
    elevation: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  resultsSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  summaryBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  resultScroll: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptyState: {
    marginTop: 64,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 360,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: '#0F766E',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  skeletonCard: {
    width: 280,
    height: 280,
    backgroundColor: '#E2E8F0',
    borderRadius: 24,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 1200,
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  closeModalButton: {
    padding: 10,
  },
  modalContent: {
    padding: 20,
  },
  modalBody: {
    flexDirection: 'row',
    gap: 18,
  },
  modalLeft: {
    flex: 1,
  },
  modalRight: {
    flex: 1,
  },
  quickFactsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  factLabel: {
    fontSize: 11,
    color: '#475569',
    textTransform: 'uppercase',
    marginTop: 14,
  },
  factText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  modalAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalActionPrimary: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  modalActionText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  modalActionTextPrimary: {
    color: '#FFFFFF',
  },
});
