import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Image,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../../components/ModalScrim';

import { useWildTrackStore, Species } from '../../store/wildtrackStore';
import { SpeciesCarousel } from '../../components/wildtrack/SpeciesCarousel';
import { ProgressCard } from '../../components/wildtrack/ProgressCard';
import { mountainService, Mountain } from '../../services/mountainService';
import { getSpeciesByMountain } from '../../data/curatedSpecies';
import Toast, { ToastHandle } from '../../components/Toast';

const C = {
  bg: '#09111F',
  surface: '#0F1A2B',
  surfaceAlt: '#141F30',
  border: '#1A2840',
  accent: '#C8975A',
  accentDim: 'rgba(200,151,90,0.12)',
  accentDimBorder: 'rgba(200,151,90,0.28)',
  textPrimary: '#EFF3F8',
  textSecondary: '#8A9BB5',
  textMuted: '#4E6280',
  green: '#22C55E',
  greenDim: 'rgba(34,197,94,0.10)',
  greenBorder: 'rgba(34,197,94,0.22)',
};

const MOUNTAIN_DESCRIPTION_PREVIEW_LENGTH = 180;

const getMountainDescriptionPreview = (description: string): string => {
  if (description.length <= MOUNTAIN_DESCRIPTION_PREVIEW_LENGTH) return description;

  const preview = description.slice(0, MOUNTAIN_DESCRIPTION_PREVIEW_LENGTH);
  const lastSpace = preview.lastIndexOf(' ');
  return `${preview.slice(0, lastSpace > 120 ? lastSpace : preview.length).trimEnd()}…`;
};

const normalizeMountainName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function WildTrackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Cap the top inset instead of letting SafeAreaView pass through the full
  // value — on devices with a front-camera cutout / Dynamic Island this can
  // be quite large and pushes the header down further than it needs to.
  const headerTopPadding = Math.min(insets.top, 14);

  const {
    selectedMountainId,
    setSelectedMountainId,
    featuredSpecies,
    stats,
    isLoading,
    fetchFeaturedSpecies,
    fetchDiscoveries,
    fetchStats,
    fetchMountainBiodiversity,
    mountainBiodiversityById,
    createDiscovery,
    removeDiscovery,
  } = useWildTrackStore();

  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [isDiscoveryActionLoading, setIsDiscoveryActionLoading] = useState(false);
  const toastRef = useRef<ToastHandle>(null);
  const [expandedDescriptionMountainId, setExpandedDescriptionMountainId] = useState<string | null>(null);
  const [loadedMountainInfoId, setLoadedMountainInfoId] = useState<string | null>(null);
  const [mountains, setMountains] = useState<Mountain[]>(() =>
    mountainService.getCachedMountains()
  );

  const currentMountain =
    mountains.find((m) => m.id === selectedMountainId) || mountains[0];
  const selectedMountainBiodiversity = mountainBiodiversityById[selectedMountainId];

  useEffect(() => {
    let mounted = true;

    const loadMountains = async () => {
      try {
        const data = await mountainService.fetchMountains();
        if (!mounted) return;
        setMountains(data);
        if (!selectedMountainId && data[0]) {
          setSelectedMountainId(data[0].id);
        }
      } catch (error) {
        console.error('[WildTrack] Failed to load mountains:', error);
      }
    };

    loadMountains();
    return () => {
      mounted = false;
    };
  }, [selectedMountainId, setSelectedMountainId]);

  const loadWildTrackData = useCallback(async () => {
    if (!selectedMountainId) return;

    await Promise.all([
      fetchFeaturedSpecies(selectedMountainId),
      fetchDiscoveries(selectedMountainId),
      fetchStats(selectedMountainId),
    ]);
  }, [selectedMountainId, fetchFeaturedSpecies, fetchDiscoveries, fetchStats]);

  useFocusEffect(
    useCallback(() => {
      void loadWildTrackData();
    }, [loadWildTrackData]),
  );

  useEffect(() => {
    if (!selectedMountainId) return;

    let active = true;
    if (selectedMountainBiodiversity) {
      setLoadedMountainInfoId(selectedMountainId);
      return () => {
        active = false;
      };
    }

    setLoadedMountainInfoId(null);
    fetchMountainBiodiversity(selectedMountainId).finally(() => {
      if (active) setLoadedMountainInfoId(selectedMountainId);
    });

    return () => {
      active = false;
    };
  }, [selectedMountainId, selectedMountainBiodiversity, fetchMountainBiodiversity]);

  const handleSpeciesPress = (species: Species) => {
    setImageError(false);
    setDiscoveryError(null);
    const normalizeName = (name?: string) => name?.trim().toLowerCase();
    const curatedSpecies = getSpeciesByMountain(selectedMountainId).find(
      (candidate) =>
        normalizeName(candidate.scientific_name) === normalizeName(species.scientific_name) ||
        normalizeName(candidate.common_name) === normalizeName(species.common_name),
    );
    setSelectedSpecies({
      ...species,
      description: species.description?.trim() || curatedSpecies?.description,
    });
    setShowLockedModal(true);
  };

  const saveSpeciesDiscovery = async (
    species: Species,
    discovered: boolean,
  ): Promise<string | null> => {
    if (!selectedMountainId) return 'Select a mountain before recording a discovery.';

    if (discovered) {
      return (await createDiscovery(species.id, selectedMountainId)).error;
    }

    let discovery = useWildTrackStore.getState().discoveries.find(
      (item) =>
        item.species_id === species.id &&
        item.mountain_id === selectedMountainId,
    );
    if (!discovery) {
      await fetchDiscoveries(selectedMountainId);
      discovery = useWildTrackStore.getState().discoveries.find(
        (item) =>
          item.species_id === species.id &&
          item.mountain_id === selectedMountainId,
      );
    }
    if (!discovery) return 'Could not find this discovery to remove. Please try again.';

    return (await removeDiscovery(discovery.id)).error;
  };

  const handlePulledDiscovery = async (
    species: Species,
    discovered: boolean,
  ): Promise<boolean> => {
    const speciesName = species.common_name || species.scientific_name;
    const error = await saveSpeciesDiscovery(species, discovered);
    if (error) {
      toastRef.current?.show({
        type: 'error',
        title: discovered ? 'Discovery not saved' : 'Discovery not removed',
        message: error,
      });
      return false;
    }

    toastRef.current?.show({
      type: 'success',
      title: discovered ? 'Discovery recorded' : 'Discovery removed',
      message: discovered
        ? `${speciesName} added to your discoveries.`
        : `${speciesName} removed from your discoveries.`,
    });
    return true;
  };

  const handleDiscoverSpecies = async () => {
    if (!selectedSpecies) return;
    const speciesName = selectedSpecies.common_name || selectedSpecies.scientific_name;
    setIsDiscoveryActionLoading(true);
    try {
      const wasDiscovered = selectedSpecies.discovered;
      const error = await saveSpeciesDiscovery(selectedSpecies, !wasDiscovered);
      if (error) {
        setDiscoveryError(error);
        return;
      }

      setDiscoveryError(null);
      setShowLockedModal(false);
      setSelectedSpecies(null);
      toastRef.current?.show({
        type: 'success',
        title: wasDiscovered ? 'Discovery removed' : 'Discovery recorded',
        message: wasDiscovered
          ? `${speciesName} removed from your discoveries.`
          : `${speciesName} added to your discoveries.`,
      });
    } finally {
      setIsDiscoveryActionLoading(false);
    }
  };

  const displayMountainInfo = useMemo(() => {
    const mountainBiodiversity = selectedMountainBiodiversity;
    if (!mountainBiodiversity) return null;
    const info: any = mountainBiodiversity;
    return {
      ...info,
      curated_species_count: info.curated_species_count || info.curatedSpeciesCount || 0,
      endemic_species_count: info.endemic_species_count || info.endemicSpeciesCount || 0,
      conservation_status: info.conservation_status || info.conservationStatus || '',
    };
  }, [selectedMountainBiodiversity]);
  const isMountainInfoLoading =
    !!selectedMountainId &&
    loadedMountainInfoId !== selectedMountainId &&
    !selectedMountainBiodiversity;
  const mountainDescription =
    isMountainInfoLoading
      ? 'Loading biodiversity information…'
      : displayMountainInfo?.description ||
        currentMountain?.description ||
        'Biodiversity information is not available yet.';
  const normalizedMountainName = normalizeMountainName(currentMountain?.name || '');
  const canExpandMountainDescription =
    (normalizedMountainName.includes('nantud') || normalizedMountainName.includes('nangtud')) &&
    mountainDescription.length > MOUNTAIN_DESCRIPTION_PREVIEW_LENGTH;
  const isMountainDescriptionExpanded =
    currentMountain?.id != null && expandedDescriptionMountainId === currentMountain.id;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerTopPadding + 8,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageContent}>
        {/* TOP NAV */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.replace('/Home')}
            style={styles.navIconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={18} color={C.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navTitleBlock}>
            <View style={styles.navBrandRow}>
              <Ionicons name="leaf" size={28} color={C.accent} />
              <Text style={styles.navBrand}>WILDTRACK</Text>
            </View>
            <Text style={styles.navTitle}>Biodiversity Tracker</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/wildtrack/SpeciesSearch')}
            style={styles.navIconBtnFancy}
            activeOpacity={0.85}
          >
            <Ionicons name="search" size={17} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* HERO: mountain tabs + info (left) + discoveries (right) */}
        <View style={styles.hero}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.selectorContent,
              { minWidth: '100%', justifyContent: 'center' },
            ]}
          >
            {mountains.map((m) => {
              const active = selectedMountainId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    if (m.id !== selectedMountainId) {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setSelectedMountainId(m.id);
                    }
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.heroRow}>
            {/* LEFT: mountain info */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoTitleBlock}>
                  <Text style={styles.infoEyebrow}>CURRENT MOUNTAIN</Text>
                  <Text style={styles.infoTitle} numberOfLines={2}>
                    {currentMountain?.name || 'Loading...'}
                  </Text>
                </View>
              </View>

              <Text
                style={styles.infoDescription}
                numberOfLines={
                  isMountainInfoLoading
                    ? 2
                    : canExpandMountainDescription && !isMountainDescriptionExpanded
                      ? 3
                      : undefined
                }
              >
                {isMountainInfoLoading
                  ? mountainDescription
                  : canExpandMountainDescription && !isMountainDescriptionExpanded
                  ? getMountainDescriptionPreview(mountainDescription)
                  : mountainDescription}
              </Text>
              {!isMountainInfoLoading && canExpandMountainDescription && (
                <TouchableOpacity
                  onPress={() => setExpandedDescriptionMountainId(
                    isMountainDescriptionExpanded ? null : currentMountain?.id || null
                  )}
                  style={styles.descriptionToggle}
                  activeOpacity={0.75}
                >
                  <Text style={styles.descriptionToggleText}>
                    {isMountainDescriptionExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.infoMetaRow}>
                <Text style={styles.infoMetaText} numberOfLines={2}>
                  Ecosystem: {displayMountainInfo?.ecosystem || 'Habitat pending'}
                </Text>
                <Text style={styles.infoMetaText} numberOfLines={2}>
                  Conservation: {displayMountainInfo?.conservation_status || 'Status pending'}
                </Text>
              </View>
            </View>

            {/* RIGHT: your discoveries */}
            <View style={styles.progressWrap}>
              <ProgressCard
                stats={stats}
                mountainName={currentMountain?.name || 'Mountain'}
                onExplorePress={() => router.push('/wildtrack/SpeciesSearch')}
                onDiscoveriesPress={() => router.push('/wildtrack/Discoveries')}
              />
            </View>
          </View>
        </View>

        {/* FEATURED SPECIES */}
        <View style={styles.featuredCard}>
          <View style={styles.featuredHeader}>
            <View>
              <Text style={styles.featuredTitle}>Featured Species</Text>
              <Text style={styles.featuredSubtitle}>Curated for this mountain</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/wildtrack/FeaturedSpecies')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {isLoading && featuredSpecies.length === 0 ? (
            <ActivityIndicator color={C.accent} style={styles.loader} />
          ) : featuredSpecies.length > 0 ? (
            <SpeciesCarousel
              species={featuredSpecies}
              onSpeciesPress={handleSpeciesPress}
              onDiscoveryChange={handlePulledDiscovery}
              discoveredSpecies={
                new Set(featuredSpecies.filter((s) => s.discovered).map((s) => s.id))
              }
            />
          ) : (
            <Text style={styles.emptyFeaturedText}>
              No curated species have been added for this mountain yet.
            </Text>
          )}
        </View>

        </View>
      </ScrollView>

      {/* SPECIES DETAIL — floating centered modal, tap the backdrop to close */}
      <Modal
        {...FULLSCREEN_MODAL_PROPS}
        visible={showLockedModal}
        animationType="fade"
        onRequestClose={() => setShowLockedModal(false)}
      >
        <Pressable
          style={[
            styles.modalOverlay,
            {
              paddingLeft: insets.left + 20,
              paddingRight: insets.right + 20,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          onPress={() => setShowLockedModal(false)}
        >
          <ModalScrim color="rgba(0,0,0,0.55)" />
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedSpecies && (
              <>
                <View style={styles.modalImgWrap}>
                  {selectedSpecies.image_url && !imageError ? (
                    <Image
                      source={{
                        uri:
                          typeof selectedSpecies.image_url === 'number'
                            ? Image.resolveAssetSource(selectedSpecies.image_url).uri
                            : selectedSpecies.image_url,
                      }}
                      style={styles.modalImg}
                      resizeMode="cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <View style={styles.modalImgFallback}>
                      <Ionicons name="leaf-outline" size={34} color={C.textMuted} />
                    </View>
                  )}
                </View>

                <View style={styles.modalTextBlock}>
                  <Text style={styles.modalName} numberOfLines={1}>
                    {selectedSpecies.common_name}
                  </Text>
                  <Text style={styles.modalScientific} numberOfLines={1}>
                    {selectedSpecies.scientific_name}
                  </Text>
                  <Text style={styles.modalDescription} numberOfLines={3}>
                    {selectedSpecies.description ||
                      'No species description is available yet.'}
                  </Text>

                  {selectedSpecies.discovered ? (
                    <TouchableOpacity
                      onPress={handleDiscoverSpecies}
                      style={styles.undiscoverBtn}
                      disabled={isDiscoveryActionLoading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={15} color={C.green} />
                      <Text style={styles.undiscoverBtnText}>
                        {isDiscoveryActionLoading ? 'Updating...' : 'Undiscover'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={handleDiscoverSpecies}
                        style={styles.discoverBtn}
                        disabled={isDiscoveryActionLoading}
                      >
                        <Ionicons name="leaf" size={15} color="#FFF" />
                        <Text style={styles.discoverBtnText}>
                          {isDiscoveryActionLoading ? 'Saving...' : 'Mark discovered'}
                        </Text>
                      </TouchableOpacity>
                      {discoveryError && (
                        <Text style={styles.discoveryError}>{discoveryError}</Text>
                      )}
                    </>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <Toast ref={toastRef} position="top" topOffset={insets.top + 10} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  pageContent: { paddingHorizontal: 46, gap: 12 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  navIconBtnFancy: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  navTitleBlock: { flex: 1, alignItems: 'center', gap: 3 },
  navBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  navBrand: { color: C.accent, fontSize: 27, fontWeight: '800', letterSpacing: 1.4 },
  navTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  hero: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 12,
  },
  // Left info : right discoveries = 4 : 6 (discoveries is the bigger one)
  heroRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  progressWrap: { flex: 6 },

  selectorContent: { gap: 8, paddingVertical: 2 },
  chip: {
    backgroundColor: C.surfaceAlt,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  chipText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: C.textPrimary },

  infoCard: {
    flex: 4,
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  infoTitleBlock: { flex: 1 },
  infoEyebrow: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  infoTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  infoDescription: { color: C.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  descriptionToggle: { alignSelf: 'flex-start', marginTop: 3 },
  descriptionToggleText: { color: C.accent, fontSize: 10, fontWeight: '700' },
  infoMetaRow: { flexDirection: 'column', gap: 2, marginTop: 5 },
  infoMetaText: { color: C.textMuted, fontSize: 10 },

  featuredCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featuredTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  featuredSubtitle: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  seeAllText: { color: C.accent, fontSize: 11, fontWeight: '700' },
  loader: { marginVertical: 28 },
  emptyFeaturedText: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 24,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    flexDirection: 'row',
    width: '92%',
    maxWidth: 460,
    height: 240,
    backgroundColor: C.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalImgWrap: {
    flex: 1.3,
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalImg: { width: '100%', height: '100%' },
  modalImgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalTextBlock: { flex: 1, justifyContent: 'center', gap: 4 },
  modalName: { color: C.textPrimary, fontSize: 17, fontWeight: '700' },
  modalScientific: { color: C.accent, fontSize: 12, fontStyle: 'italic' },
  modalDescription: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 },
  discoverBtn: {
    marginTop: 14,
    backgroundColor: C.accent,
    borderRadius: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  discoverBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  discoveryError: { color: '#E07070', fontSize: 11, lineHeight: 15, marginTop: 6 },
  undiscoverBtn: {
    marginTop: 14,
    backgroundColor: C.greenDim,
    borderRadius: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  undiscoverBtnText: { color: C.green, fontSize: 13, fontWeight: '700' },
});