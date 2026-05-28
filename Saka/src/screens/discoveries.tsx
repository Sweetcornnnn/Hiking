import React, { useEffect, useState } from 'react';
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
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useWildTrackStore } from '../store/wildtrackStore';
import { SpeciesCard } from '../components/wildtrack/SpeciesCard';

import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  RADIUS_CARD,
  RADIUS_BTN,
} from '../theme/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

const isLandscape = SCREEN_WIDTH >= SCREEN_HEIGHT;
const isSmallLandscape = SCREEN_WIDTH < 900;

const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

const getColumns = () => {
  if (SCREEN_WIDTH > 1200) return 4;
  if (SCREEN_WIDTH > 900) return 3;
  return 2;
};

const COLUMNS = getColumns();

const CARD_GAP = 12;

const CARD_WIDTH =
  (SCREEN_WIDTH -
    SPACING.lg * 2 -
    CARD_GAP * (COLUMNS - 1)) /
  COLUMNS;

export default function DiscoveriesScreen() {
  const router = useRouter();

  const {
    discoveries,
    fetchDiscoveries,
    selectedMountainId,
    removeDiscovery,
  } = useWildTrackStore();

  const [selectedDiscovery, setSelectedDiscovery] =
    useState<any | null>(null);

  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    console.log('[WildTrack] Discoveries screen mounted');
    fetchDiscoveries(selectedMountainId);
  }, [selectedMountainId]);

  const handleRemoveDiscovery = async () => {
    if (!selectedDiscovery) return;

    console.log(
      `[WildTrack] Removing discovery: ${selectedDiscovery.id}`
    );

    setRemoving(true);

    const { error } = await removeDiscovery(
      selectedDiscovery.id
    );

    if (!error) {
      console.log(
        '[WildTrack] Discovery removed successfully'
      );

      setSelectedDiscovery(null);
    } else {
      console.error(
        '[WildTrack] Error removing discovery:',
        error
      );
    }

    setRemoving(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={TEXT_PRIMARY}
            />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>
              My Discoveries
            </Text>

            <Text style={styles.subtitle}>
              {discoveries.length} species discovered
            </Text>
          </View>
        </View>

        <View style={styles.discoveryBadge}>
          <Ionicons
            name="leaf-outline"
            size={14}
            color={ACCENT_GOLD}
          />

          <Text style={styles.discoveryBadgeText}>
            WildTrack
          </Text>
        </View>
      </View>

      {/* LIST */}

      <FlatList
        data={discoveries}
        keyExtractor={(item) => item.id.toString()}
        numColumns={COLUMNS}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={
          COLUMNS > 1
            ? styles.columnWrapper
            : undefined
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedDiscovery(item)}
            style={styles.gridItem}
            activeOpacity={0.9}
          >
            <SpeciesCard
              species={{
                id: item.species_id,
                scientific_name:
                  item.scientific_name || 'Unknown',
                common_name:
                  item.common_name || 'Unknown',
                category: item.category || 'Others',
                conservation_status:
                  item.conservation_status,
                image_url: item.image_url,
                discovered: true,
              }}
              onPress={() =>
                setSelectedDiscovery(item)
              }
              isDiscovered={true}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons
                name="leaf-outline"
                size={40}
                color={ACCENT_GOLD}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No Discoveries Yet
            </Text>

            <Text style={styles.emptyText}>
              Start exploring mountain ecosystems and
              mark species discoveries during your
              hiking adventures.
            </Text>

            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.push('/wildtrack')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="compass-outline"
                size={16}
                color="#FFF"
              />

              <Text style={styles.exploreButtonText}>
                Explore WildTrack
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* MODAL */}

      <Modal
        visible={!!selectedDiscovery}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDiscovery(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Discovery Details
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setSelectedDiscovery(null)
                }
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={TEXT_PRIMARY}
                />
              </TouchableOpacity>
            </View>

            {selectedDiscovery && (
              <View style={styles.modalCardWrapper}>
                <SpeciesCard
                  species={{
                    id: selectedDiscovery.species_id,
                    scientific_name:
                      selectedDiscovery.scientific_name ||
                      'Unknown',

                    common_name:
                      selectedDiscovery.common_name ||
                      'Unknown',

                    category:
                      selectedDiscovery.category ||
                      'Others',

                    conservation_status:
                      selectedDiscovery.conservation_status,

                    image_url:
                      selectedDiscovery.image_url,

                    discovered: true,
                  }}
                  onPress={() => {}}
                  isDiscovered={true}
                  showDiscoveryStatus={false}
                />
              </View>
            )}

            <View style={styles.modalActions}>
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
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#FFF"
                    />

                    <Text
                      style={styles.removeButtonText}
                    >
                      Remove Discovery
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setSelectedDiscovery(null)
                }
                style={styles.cancelButton}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_CARD,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
    backgroundColor: BG_CARD,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerTextContainer: {
    flexShrink: 1,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginLeft: 12,
  },

  discoveryBadgeText: {
    color: ACCENT_GOLD,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 6,
  },

  /* LIST */

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
    flexGrow: 1,
  },

  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  gridItem: {
    width: CARD_WIDTH,
    marginBottom: 2,
  },

  /* EMPTY */

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },

  emptyIconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: BG_PANEL,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 420,
  },

  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: ACCENT_GOLD,
    gap: 8,
  },

  exploreButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* MODAL */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  modalContent: {
    width: '100%',
    maxWidth: isLandscape ? 760 : 460,
    maxHeight: '92%',
    backgroundColor: BG_PANEL,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BG_SUBTLE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCardWrapper: {
    overflow: 'hidden',
    borderRadius: 20,
  },

  modalActions: {
    marginTop: 18,
    gap: 10,
  },

  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0392B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8,
  },

  removeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  cancelButtonText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});

