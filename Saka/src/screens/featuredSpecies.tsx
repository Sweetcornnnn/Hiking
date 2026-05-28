import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useWildTrackStore } from '../store/wildtrackStore';
import { SpeciesCard } from '../components/wildtrack/SpeciesCard';
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
  RADIUS_CARD,
  RADIUS_BTN,
} from '../theme/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isLandscape = SCREEN_WIDTH >= SCREEN_HEIGHT;

export default function FeaturedSpeciesScreen() {
  const router = useRouter();

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
    console.log('[WildTrack] Featured species screen mounted');
    console.log(
      `[WildTrack] Loading featured species for mountain: ${selectedMountainId}`
    );

    fetchFeaturedSpecies(selectedMountainId);
  }, [selectedMountainId]);

  /**
   * LANDSCAPE GRID SYSTEM
   * ----------------------
   * Compact + balanced layout.
   * Prevents:
   * - oversized cards
   * - overcrowding
   * - clipping
   * - vertical stretching
   */

  const columns = useMemo(() => {
    if (SCREEN_WIDTH >= 1500) return 4;
    if (SCREEN_WIDTH >= 1100) return 3;
    if (SCREEN_WIDTH >= 760) return 2;

    return 1;
  }, []);

  const cardSpacing = 14;

  const cardWidth = useMemo(() => {
    const horizontalPadding = 48;
    const totalSpacing = (columns - 1) * cardSpacing;

    return (
      (SCREEN_WIDTH - horizontalPadding - totalSpacing) /
      columns
    );
  }, [columns]);

  const handleMarkDiscovered = async () => {
    if (!selectedSpecies) return;

    console.log(
      `[WildTrack] Marking featured species as discovered: ${selectedSpecies.common_name}`
    );

    setMarking(true);

    const { error } = await createDiscovery(
      selectedSpecies.id,
      selectedMountainId
    );

    if (!error) {
      await cacheSpecies(selectedSpecies);

      console.log(
        '[WildTrack] Featured species marked as discovered successfully'
      );
    } else {
      console.error(
        '[WildTrack] Error marking featured discovery:',
        error
      );
    }

    setMarking(false);
    setSelectedSpecies(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={TEXT_PRIMARY}
            />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>
              Featured Species
            </Text>

            <Text style={styles.subtitle}>
              Landscape-optimized endemic species explorer
            </Text>
          </View>
        </View>

        <View style={styles.headerBadge}>
          <Ionicons
            name="leaf-outline"
            size={14}
            color={ACCENT_GOLD}
          />

          <Text style={styles.headerBadgeText}>
            {featuredSpecies.length} Species
          </Text>
        </View>
      </View>

      {/* SPECIES GRID */}
      <FlatList
        data={featuredSpecies}
        key={columns}
        numColumns={columns}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={
          columns > 1
            ? styles.columnWrapper
            : undefined
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.cardWrapper,
              {
                width: cardWidth,
              },
            ]}
          >
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
              <Ionicons
                name="star-outline"
                size={54}
                color={ACCENT_GOLD}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No Featured Species
            </Text>

            <Text style={styles.emptyText}>
              Featured species will appear here once curated
              for this mountain.
            </Text>
          </View>
        }
      />

      {/* MODAL */}
      <Modal
        visible={!!selectedSpecies}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedSpecies(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalShell}
            onPress={() => {}}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              {selectedSpecies && (
                <View style={styles.modalCardWrapper}>
                  <SpeciesCard
                    species={selectedSpecies}
                    onPress={() => {}}
                    isDiscovered={
                      !!selectedSpecies.discovered
                    }
                    showDiscoveryStatus={false}
                  />
                </View>
              )}

              {/* ACTIONS */}
              <View style={styles.modalActions}>
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
                        <Ionicons
                          name="eye-outline"
                          size={18}
                          color="#FFF"
                        />

                        <Text style={styles.modalButtonText}>
                          Mark as Discovered
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setSelectedSpecies(null)}
                  style={styles.modalCancelButton}
                >
                  <Text
                    style={styles.modalCancelButtonText}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /**
   * CONTAINER
   * -----------
   * Premium dark hiking aesthetic.
   */

  container: {
    flex: 1,
    backgroundColor: BG_CARD,
  },

  /**
   * HEADER
   * --------
   * Compact landscape dashboard header.
   */

  header: {
    paddingHorizontal: isLandscape ? 20 : 18,
    paddingTop: isLandscape ? 16 : 14,
    paddingBottom: isLandscape ? 12 : 10,

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  backButton: {
    width: isLandscape ? 40 : 42,
    height: isLandscape ? 40 : 42,
    borderRadius: isLandscape ? 12 : 14,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    marginRight: isLandscape ? 16 : 14,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },

  subtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 3,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    paddingHorizontal: 12,
    paddingVertical: 8,

    borderRadius: 999,
  },

  headerBadgeText: {
    color: ACCENT_GOLD,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },

  /**
   * LIST
   * ------
   * Balanced landscape spacing.
   */

  listContent: {
    paddingHorizontal: isLandscape ? 20 : 18,
    paddingTop: isLandscape ? 18 : 16,
    paddingBottom: isLandscape ? 26 : 24,
  },

  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: isLandscape ? 16 : 14,
  },

  cardWrapper: {
    marginBottom: isLandscape ? 16 : 14,
  },

  /**
   * EMPTY STATE
   */

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: 70,
    paddingHorizontal: 30,
  },

  emptyIconWrapper: {
    width: 92,
    height: 92,
    borderRadius: 999,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,

    marginTop: 18,
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 460,
  },

  /**
   * MODAL
   * -------
   * Proper landscape scaling.
   * Prevents:
   * - clipping
   * - overflow
   * - oversized layouts
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',

    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: isLandscape ? 32 : 22,
    paddingVertical: isLandscape ? 24 : 18,
  },

  modalShell: {
    width: '100%',
    maxWidth: isLandscape ? 1000 : 520,
    maxHeight: SCREEN_HEIGHT * (isLandscape ? 0.88 : 0.92),

    backgroundColor: BG_PANEL,

    borderRadius: 32,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    overflow: 'hidden',
  },

  modalScroll: {
    padding: isLandscape ? 24 : 18,
  },

  modalCardWrapper: {
    width: '100%',
  },

  /**
   * ACTIONS
   * ---------
   * Cleaner CTA hierarchy.
   */

  modalActions: {
    marginTop: 18,
    gap: 10,
  },

  modalButton: {
    height: 52,

    borderRadius: RADIUS_BTN,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: ACCENT_GREEN,

    gap: 8,
  },

  modalButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  modalCancelButton: {
    height: 48,

    borderRadius: RADIUS_BTN,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  modalCancelButtonText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});