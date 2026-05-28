import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useWildTrackStore, Species } from '../store/wildtrackStore';
import { useAuthStore } from '../store/authStore';
import { SpeciesCarousel } from '../components/wildtrack/SpeciesCarousel';
import { ProgressCard } from '../components/wildtrack/ProgressCard';
import { getMountainBiodiversity } from '../data/curatedSpecies';

const MOUNTAINS = [
  { id: '1', name: 'Mt. Madjaas' },
  { id: '2', name: 'Mt. Guiting-Guiting' },
  { id: '3', name: 'Mt. Pulag' },
  { id: '4', name: 'Mt. Apo' },
  { id: '5', name: 'Mt. Mayon' },
  { id: '6', name: 'Mt. Kanlaon' },
];

export default function WildTrackScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    selectedMountainId,
    setSelectedMountainId,
    featuredSpecies,
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
  const [showMountainInfo, setShowMountainInfo] = useState(true);

  const currentMountain =
    MOUNTAINS.find((m) => m.id === selectedMountainId) || MOUNTAINS[0];

  const localMountainInfo = getMountainBiodiversity(selectedMountainId);

  useEffect(() => {
    loadWildTrackData();
  }, [selectedMountainId]);

  const loadWildTrackData = async () => {
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

    const { error } = await createDiscovery(
      selectedSpecies.id,
      selectedMountainId
    );

    if (!error) {
      setShowLockedModal(false);
      setSelectedSpecies(null);
      await loadWildTrackData();
    }
  };

  const mountainInfo = mountainBiodiversity || localMountainInfo;

  const displayMountainInfo = useMemo(() => {
    if (!mountainInfo) return null;

    return {
      ...mountainInfo,
      curated_species_count:
        (mountainInfo as any).curated_species_count ||
        (mountainInfo as any).curatedSpeciesCount ||
        0,
      endemic_species_count:
        (mountainInfo as any).endemic_species_count ||
        (mountainInfo as any).endemicSpeciesCount ||
        0,
      conservation_status:
        (mountainInfo as any).conservation_status ||
        (mountainInfo as any).conservationStatus ||
        '',
    };
  }, [mountainInfo]);

  // StyleSheet creation with dynamic isLandscape
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0B1220',
    },

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 30,
    },

    heroCard: {
      backgroundColor: '#111827',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: '#1E293B',
      padding: isLandscape ? 20 : 18,
      marginBottom: isLandscape ? 16 : 14,
    },

    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isLandscape ? 18 : 16,
    },

    iconButton: {
      width: isLandscape ? 40 : 42,
      height: isLandscape ? 40 : 42,
      borderRadius: isLandscape ? 20 : 21,
      backgroundColor: '#172033',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#1E293B',
    },

    searchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#172033',
      borderRadius: 999,
      paddingHorizontal: isLandscape ? 18 : 16,
      paddingVertical: isLandscape ? 11 : 10,
      gap: 8,
      borderWidth: 1,
      borderColor: '#1E293B',
    },

    searchButtonText: {
      color: '#E2E8F0',
      fontSize: 12,
      fontWeight: '700',
    },

    heroBody: {
      justifyContent: 'space-between',
      gap: 18,
    },

    heroLeft: {
      flex: 1,
    },

    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: '#172033',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
      marginBottom: 12,
    },

    heroBadgeText: {
      color: '#D4A574',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.4,
    },

    heroTitle: {
      color: '#F8FAFC',
      fontSize: 34,
      fontWeight: '900',
      marginBottom: 4,
    },

    heroSubtitle: {
      color: '#CBD5E1',
      fontSize: 14,
      marginBottom: 10,
    },

    heroMountainPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(212,165,116,0.12)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
    },

    heroMountainText: {
      color: '#D4A574',
      fontSize: 12,
      fontWeight: '700',
    },

    heroStats: {
      flexDirection: 'row',
      gap: 12,
      alignSelf: isLandscape ? 'flex-end' : 'flex-start',
    },

    heroStatCard: {
      minWidth: 110,
      backgroundColor: '#172033',
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 16,
      alignItems: 'center',
    },

    heroStatValue: {
      color: '#F8FAFC',
      fontSize: 24,
      fontWeight: '900',
    },

    heroStatLabel: {
      color: '#94A3B8',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 5,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    selectorWrapper: {
      marginBottom: 14,
    },

    selectorContent: {
      gap: 10,
      paddingRight: 10,
    },

    mountainChip: {
      backgroundColor: '#111827',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#1E293B',
      paddingHorizontal: 16,
      paddingVertical: 11,
    },

    mountainChipActive: {
      borderColor: '#D4A574',
      backgroundColor: '#172033',
    },

    mountainChipText: {
      color: '#CBD5E1',
      fontSize: 12,
      fontWeight: '700',
    },

    mountainChipTextActive: {
      color: '#F8FAFC',
    },

    contentGrid: {
      gap: isLandscape ? 20 : 16,
      alignItems: 'flex-start',
    },

    leftColumn: {
      width: isLandscape ? 380 : '100%',
      gap: isLandscape ? 16 : 14,
    },

    rightColumn: {
      flex: 1,
      width: '100%',
    },

    infoCard: {
      backgroundColor: '#111827',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#1E293B',
      padding: 16,
    },

    infoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    infoTitleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },

    infoIconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#172033',
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoTitle: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '800',
    },

    infoCaption: {
      color: '#64748B',
      fontSize: 11,
      marginTop: 2,
    },

    infoDescription: {
      color: '#94A3B8',
      fontSize: 12,
      lineHeight: 20,
      marginTop: 14,
    },

    infoStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },

    infoMiniCard: {
      flex: 1,
      backgroundColor: '#172033',
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: 'center',
    },

    infoMiniValue: {
      color: '#F8FAFC',
      fontSize: 22,
      fontWeight: '900',
    },

    infoMiniLabel: {
      color: '#94A3B8',
      fontSize: 10,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16,
    },

    tag: {
      backgroundColor: '#172033',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: '100%',
    },

    tagAccent: {
      borderWidth: 1,
      borderColor: '#D4A574',
    },

    tagText: {
      color: '#CBD5E1',
      fontSize: 11,
      fontWeight: '700',
    },

    tagAccentText: {
      color: '#D4A574',
      fontSize: 11,
      fontWeight: '800',
    },

    quickActions: {
      flexDirection: 'row',
      gap: 12,
    },

    quickActionButton: {
      flex: 1,
      backgroundColor: '#111827',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: '#1E293B',
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickActionText: {
      color: '#F8FAFC',
      fontSize: 11,
      fontWeight: '800',
      marginTop: 8,
    },

    featuredCard: {
      backgroundColor: '#111827',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: '#1E293B',
      padding: 16,
      overflow: 'hidden',
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 14,
      gap: 12,
    },

    sectionHeaderLeft: {
      flex: 1,
    },

    sectionTitle: {
      color: '#F8FAFC',
      fontSize: 19,
      fontWeight: '900',
      marginBottom: 4,
    },

    sectionSubtitle: {
      color: '#94A3B8',
      fontSize: 11,
      lineHeight: 16,
    },

    sectionAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    sectionActionText: {
      color: '#D4A574',
      fontSize: 12,
      fontWeight: '800',
    },

    carouselWrapper: {
      overflow: 'hidden',
      borderRadius: 20,
    },

    bottomSpacer: {
      height: 34,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(2,6,23,0.88)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isLandscape ? 32 : 18,
      paddingVertical: isLandscape ? 24 : 22,
    },

    modalContainer: {
      width: '100%',
      maxWidth: isLandscape ? 1100 : 600,
      maxHeight: isLandscape ? '90%' : '85%',
      backgroundColor: '#111827',
      borderRadius: 32,
      borderWidth: 1,
      borderColor: '#1E293B',
      overflow: 'hidden',
    },

    modalScroll: {
      padding: isLandscape ? 24 : 18,
    },

    modalTop: {
      gap: isLandscape ? 24 : 18,
    },

    modalImageWrapper: {
      flex: isLandscape ? 0.48 : undefined,
      height: isLandscape ? 380 : 280,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: '#0B1220',
      borderWidth: 1,
      borderColor: '#1E293B',
    },

    modalImage: {
      width: '100%',
      height: '100%',
    },

    modalInfo: {
      flex: 1,
      justifyContent: 'space-between',
    },

    modalName: {
      color: '#F8FAFC',
      fontSize: 26,
      fontWeight: '900',
      marginBottom: 6,
    },

    modalScientific: {
      color: '#D4A574',
      fontSize: 13,
      fontStyle: 'italic',
      marginBottom: 14,
    },

    modalDescription: {
      color: '#CBD5E1',
      fontSize: 13,
      lineHeight: 21,
      marginBottom: 16,
    },

    modalMetaContainer: {
      gap: 10,
    },

    modalMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    modalMetaText: {
      flex: 1,
      color: '#94A3B8',
      fontSize: 12,
    },

    discoverButton: {
      marginTop: 18,
      backgroundColor: '#D4A574',
      borderRadius: 18,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    discoverButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '800',
    },

    discoveredBadge: {
      marginTop: 18,
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderRadius: 18,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.25)',
    },

    discoveredBadgeText: {
      color: '#22C55E',
      fontSize: 14,
      fontWeight: '800',
    },

    closeButton: {
      alignSelf: 'center',
      marginTop: 14,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },

    closeButtonText: {
      color: '#94A3B8',
      fontSize: 13,
      fontWeight: '700',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              onPress={() => router.replace('/drawer/home')}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={18} color="#F8FAFC" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/speciesSearch')}
              style={styles.searchButton}
              activeOpacity={0.9}
            >
              <Ionicons name="search" size={15} color="#CBD5E1" />
              <Text style={styles.searchButtonText}>Search species</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.heroBody,
              {
                flexDirection: isLandscape ? 'row' : 'column',
              },
            ]}
          >
            <View style={styles.heroLeft}>
              <View style={styles.heroBadge}>
                <Ionicons name="leaf-outline" size={12} color="#D4A574" />
                <Text style={styles.heroBadgeText}>
                  Biodiversity Explorer
                </Text>
              </View>

              <Text style={styles.heroTitle}>WildTrack</Text>

              <Text style={styles.heroSubtitle}>
                Welcome back, {user?.first_name || 'Explorer'}
              </Text>

              <View style={styles.heroMountainPill}>
                <Ionicons name="navigate-outline" size={13} color="#D4A574" />
                <Text style={styles.heroMountainText}>
                  Exploring {currentMountain.name}
                </Text>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>
                  {displayMountainInfo?.curated_species_count ?? '—'}
                </Text>
                <Text style={styles.heroStatLabel}>Curated</Text>
              </View>

              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>
                  {displayMountainInfo?.endemic_species_count ?? '—'}
                </Text>
                <Text style={styles.heroStatLabel}>Endemic</Text>
              </View>
            </View>
          </View>
        </View>

        {/* MOUNTAINS */}
        <View style={styles.selectorWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorContent}
          >
            {MOUNTAINS.map((mountain) => {
              const active = selectedMountainId === mountain.id;

              return (
                <TouchableOpacity
                  key={mountain.id}
                  onPress={() => setSelectedMountainId(mountain.id)}
                  style={[
                    styles.mountainChip,
                    active && styles.mountainChipActive,
                  ]}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.mountainChipText,
                      active && styles.mountainChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {mountain.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* CONTENT */}
        <View
          style={[
            styles.contentGrid,
            {
              flexDirection: isLandscape ? 'row' : 'column',
            },
          ]}
        >
          {/* LEFT PANEL */}
          <View style={styles.leftColumn}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setShowMountainInfo(!showMountainInfo)}
              style={styles.infoCard}
            >
              <View style={styles.infoHeader}>
                <View style={styles.infoTitleWrapper}>
                  <View style={styles.infoIconWrapper}>
                    <Ionicons
                      name="analytics-outline"
                      size={16}
                      color="#D4A574"
                    />
                  </View>

                  <View>
                    <Text style={styles.infoTitle}>
                      Mountain Biodiversity
                    </Text>

                    <Text style={styles.infoCaption}>
                      Ecological insights
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name={showMountainInfo ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94A3B8"
                />
              </View>

              {showMountainInfo && displayMountainInfo && (
                <>
                  <Text style={styles.infoDescription} numberOfLines={4}>
                    {displayMountainInfo.description}
                  </Text>

                  <View style={styles.infoStatsRow}>
                    <View style={styles.infoMiniCard}>
                      <Text style={styles.infoMiniValue}>
                        {displayMountainInfo.curated_species_count}
                      </Text>

                      <Text style={styles.infoMiniLabel}>Curated</Text>
                    </View>

                    <View style={styles.infoMiniCard}>
                      <Text style={styles.infoMiniValue}>
                        {displayMountainInfo.endemic_species_count}
                      </Text>

                      <Text style={styles.infoMiniLabel}>Endemic</Text>
                    </View>
                  </View>

                  <View style={styles.tagsRow}>
                    <View style={styles.tag}>
                      <Text
                        style={styles.tagText}
                        numberOfLines={1}
                      >
                        {displayMountainInfo.ecosystem}
                      </Text>
                    </View>

                    <View style={[styles.tag, styles.tagAccent]}>
                      <Text
                        style={styles.tagAccentText}
                        numberOfLines={1}
                      >
                        {displayMountainInfo.conservation_status}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <ProgressCard
              stats={stats}
              mountainName={currentMountain.name}
              onExplorePress={() => router.push('/speciesSearch')}
            />

            <View style={styles.quickActions}>
              <TouchableOpacity
                onPress={() => router.push('/discoveries')}
                style={styles.quickActionButton}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="trophy-outline"
                  size={18}
                  color="#D4A574"
                />

                <Text style={styles.quickActionText}>Discoveries</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/featuredSpecies')}
                style={styles.quickActionButton}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="star-outline"
                  size={18}
                  color="#D4A574"
                />

                <Text style={styles.quickActionText}>Featured</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* RIGHT PANEL */}
          <View style={styles.rightColumn}>
            <View style={styles.featuredCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionTitle}>
                    Featured Endemic Species
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Landscape optimized species discovery
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/speciesSearch')}
                  style={styles.sectionAction}
                  activeOpacity={0.9}
                >
                  <Text style={styles.sectionActionText}>Browse</Text>

                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color="#D4A574"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.carouselWrapper}>
                <SpeciesCarousel
                  species={featuredSpecies}
                  onSpeciesPress={handleSpeciesPress}
                  discoveredSpecies={new Set()}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={showLockedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedSpecies && (
              <>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScroll}
                >
                  <View
                    style={[
                      styles.modalTop,
                      {
                        flexDirection: isLandscape ? 'row' : 'column',
                      },
                    ]}
                  >
                    <View style={styles.modalImageWrapper}>
                      {selectedSpecies.image_url ? (
                        <Image
                          source={{ uri: selectedSpecies.image_url }}
                          style={styles.modalImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Image
                          source={require('../../assets/images/wildtrackdefaultimg.png')}
                          style={styles.modalImage}
                          resizeMode="cover"
                        />
                      )}
                    </View>

                    <View style={styles.modalInfo}>
                      <View>
                        <Text
                          style={styles.modalName}
                          numberOfLines={2}
                        >
                          {selectedSpecies.common_name}
                        </Text>

                        <Text
                          style={styles.modalScientific}
                          numberOfLines={1}
                        >
                          {selectedSpecies.scientific_name}
                        </Text>
                      </View>

                      {!!selectedSpecies.description && (
                        <Text
                          style={styles.modalDescription}
                          numberOfLines={isLandscape ? 8 : 6}
                        >
                          {selectedSpecies.description}
                        </Text>
                      )}

                      <View style={styles.modalMetaContainer}>
                        {!!selectedSpecies.habitat && (
                          <View style={styles.modalMeta}>
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color="#D4A574"
                            />

                            <Text
                              style={styles.modalMetaText}
                              numberOfLines={1}
                            >
                              {selectedSpecies.habitat}
                            </Text>
                          </View>
                        )}

                        {!!selectedSpecies.category && (
                          <View style={styles.modalMeta}>
                            <Ionicons
                              name="pricetag-outline"
                              size={14}
                              color="#D4A574"
                            />

                            <Text
                              style={styles.modalMetaText}
                              numberOfLines={1}
                            >
                              {selectedSpecies.category}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {!selectedSpecies.discovered ? (
                    <TouchableOpacity
                      onPress={handleDiscoverSpecies}
                      style={styles.discoverButton}
                      disabled={isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Ionicons
                            name="eye-outline"
                            size={18}
                            color="#FFF"
                          />

                          <Text style={styles.discoverButtonText}>
                            Mark as Discovered
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.discoveredBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#22C55E"
                      />

                      <Text style={styles.discoveredBadgeText}>
                        Already Discovered
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => setShowLockedModal(false)}
                    style={styles.closeButton}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}