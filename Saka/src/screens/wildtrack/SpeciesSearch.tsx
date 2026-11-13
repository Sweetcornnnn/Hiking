import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SpeciesCard } from '../../components/wildtrack/SpeciesCard';

import { useSpeciesSearch } from '../../hooks/useSpeciesSearch';

const COLUMNS = 4;
const GRID_GAP = 10;
const PAGE_GUTTER = 12;
const HEADER_RIGHT_GUTTER = 45;

export default function SpeciesSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { query, setQuery, results, isFetching, hasMore, expandResults } = useSpeciesSearch();

  const horizontalInsets = insets.left + insets.right + PAGE_GUTTER * 2;
  const cardWidth =
    (width - horizontalInsets - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const renderSkeleton = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={[styles.skeletonCard, { width: cardWidth }]} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingLeft: insets.left + PAGE_GUTTER,
            paddingRight: insets.right + HEADER_RIGHT_GUTTER,
          },
        ]}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#D4A574" />
        </Pressable>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={16} color="#64748B" />

          <TextInput
            style={styles.searchInput}
            placeholder="Search species..."
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={setQuery}
          />

          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </Pressable>
          )}
        </View>
      </View>

      {/* RESULTS */}
      <View
        style={[
          styles.resultsContainer,
          {
            paddingLeft: insets.left + PAGE_GUTTER,
            paddingRight: insets.right + PAGE_GUTTER,
          },
        ]}
      >
        {isFetching ? (
          renderSkeleton()
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, index) =>
              item?.id?.toString?.() || item?.scientific_name || index.toString()
            }
            numColumns={COLUMNS}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.resultsContent}
            renderItem={({ item }) => (
              <View style={[styles.speciesCell, { width: cardWidth }]}>
                <SpeciesCard
                  species={item}
                  showDiscoveryStatus={false}
                  detailSections={['gallery', 'quickFacts', 'timeline', 'taxonomy']}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Ionicons name="leaf-outline" size={44} color="#D4A574" />
                </View>
                <Text style={styles.emptyTitle}>
                  {query ? 'No species found' : 'Search biodiversity'}
                </Text>
                <Text style={styles.emptyText}>
                  Search by common name, scientific name, or keyword.
                </Text>
              </View>
            }
            ListFooterComponent={
              hasMore ? (
                <Pressable style={styles.loadMoreButton} onPress={expandResults}>
                  <Text style={styles.loadMoreText}>Load More Species</Text>
                </Pressable>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 13, fontWeight: '600', padding: 0 },

  resultsContainer: {
    flex: 1,
    paddingTop: 8,
  },
  resultsContent: { paddingBottom: 16 },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: GRID_GAP,
  },
  speciesCell: { marginBottom: GRID_GAP },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  skeletonCard: { height: 165, backgroundColor: '#172033', borderRadius: 16, marginBottom: GRID_GAP },

  emptyState: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 12 },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#172033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 16, color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  emptyText: {
    marginTop: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loadMoreText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  modalScreen: { flex: 1, backgroundColor: '#111827' },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 68,
    zIndex: 10,
    elevation: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stickyTitle: {
    position: 'absolute',
    left: 48,
    right: 8,
    top: 10,
    alignItems: 'center',
  },
  modalHeaderLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1E293B',
  },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  modalScientific: {
    marginTop: 3,
    color: '#D4A574',
    fontSize: 12,
    fontStyle: 'italic',
  },
  detailTitle: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  detailBackButton: {
    position: 'absolute',
    top: 12,
    left: 0,
    zIndex: 1,
  },
  detailTitleCommon: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailTitleScientific: {
    color: '#D4A574',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: { flex: 1, zIndex: 0, elevation: 0 },
  modalContentContainer: { padding: 12, paddingBottom: 16 },
  modalBody: { gap: 14 },

  cardTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  quickFactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 20,
  },
  factRow: { flexBasis: '45%', flexGrow: 1 },
  factLabel: { color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  factText: { marginTop: 4, color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  descriptionText: { color: '#F8FAFC', fontSize: 12, lineHeight: 18 },
  descriptionSource: { color: '#94A3B8', fontSize: 10, marginTop: 6 },

  infoSection: {
    backgroundColor: '#172033',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#233047',
  },
  infoSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#233047',
    marginVertical: 12,
  },

  noImageCard: {
    aspectRatio: 16 / 10,
    borderRadius: 20,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#233047',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  noImageText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  modalLoading: { paddingVertical: 40, justifyContent: 'center', alignItems: 'center' },
  modalLoadingText: { marginTop: 12, color: '#94A3B8', fontSize: 12 },
});