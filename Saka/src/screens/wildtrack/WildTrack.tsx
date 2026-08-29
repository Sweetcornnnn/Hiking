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
 
import { useWildTrackStore, Species } from '../../store/wildtrackStore';
import { useAuthStore } from '../../store/authStore';
import { SpeciesCarousel } from '../../components/wildtrack/SpeciesCarousel';
import { ProgressCard } from '../../components/wildtrack/ProgressCard';
import { getMountainBiodiversity } from '../../data/curatedSpecies';
 
const MOUNTAINS = [
  { id: '1', name: 'Mt. Madjaas' },
  { id: '2', name: 'Mt. Guiting-Guiting' },
  { id: '3', name: 'Mt. Pulag' },
  { id: '4', name: 'Mt. Apo' },
  { id: '5', name: 'Mt. Mayon' },
  { id: '6', name: 'Mt. Kanlaon' },
];
 
const C = {
  bg:              '#09111F',
  surface:         '#0F1A2B',
  surfaceAlt:      '#141F30',
  border:          '#1A2840',
  accent:          '#C8975A',
  accentDim:       'rgba(200,151,90,0.12)',
  accentDimBorder: 'rgba(200,151,90,0.28)',
  textPrimary:     '#EFF3F8',
  textSecondary:   '#8A9BB5',
  textMuted:       '#4E6280',
  green:           '#22C55E',
  greenDim:        'rgba(34,197,94,0.10)',
  greenBorder:     'rgba(34,197,94,0.22)',
};
 
export default function WildTrackScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
 
  const S = {
    px:      isLandscape ? 16 : 13,
    gap:     isLandscape ? 10 : 8,
    cardPad: isLandscape ? 13 : 11,
    radius:  15,
    radiusLg: 20,
  };
 
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
 
  const [selectedSpecies, setSelectedSpecies]   = useState<Species | null>(null);
  const [showLockedModal, setShowLockedModal]   = useState(false);
  const [showMountainInfo, setShowMountainInfo] = useState(true);
 
  const currentMountain =
    MOUNTAINS.find((m) => m.id === selectedMountainId) || MOUNTAINS[0];
 
  const localMountainInfo = getMountainBiodiversity(selectedMountainId);
 
  useEffect(() => { loadWildTrackData(); }, [selectedMountainId]);
 
  const loadWildTrackData = async () => {
    await Promise.all([
      fetchFeaturedSpecies(selectedMountainId),
      fetchMountainSpecies(selectedMountainId),
      fetchStats(selectedMountainId),
      fetchMountainBiodiversity(selectedMountainId),
    ]);
  };
 
  const handleSpeciesPress    = (species: Species) => { setSelectedSpecies(species); setShowLockedModal(true); };
  const handleDiscoverSpecies = async () => {
    if (!selectedSpecies) return;
    const { error } = await createDiscovery(selectedSpecies.id, selectedMountainId);
    if (!error) { setShowLockedModal(false); setSelectedSpecies(null); await loadWildTrackData(); }
  };
 
  const mountainInfo = mountainBiodiversity || localMountainInfo;
  const displayMountainInfo = useMemo(() => {
    if (!mountainInfo) return null;
    return {
      ...mountainInfo,
      curated_species_count:
        (mountainInfo as any).curated_species_count  || (mountainInfo as any).curatedSpeciesCount  || 0,
      endemic_species_count:
        (mountainInfo as any).endemic_species_count  || (mountainInfo as any).endemicSpeciesCount  || 0,
      conservation_status:
        (mountainInfo as any).conservation_status    || (mountainInfo as any).conservationStatus   || '',
    };
  }, [mountainInfo]);
 
  const styles = StyleSheet.create({
    container:     { flex: 1, backgroundColor: C.bg },
    scrollView:    { flex: 1 },
    scrollContent: {
      paddingHorizontal: S.px,
      paddingTop: 10,
      paddingBottom: 26,
      gap: S.gap,
    },
    hero: {
      backgroundColor: C.surface,
      borderRadius: S.radiusLg,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: S.cardPad,
      paddingVertical: S.cardPad,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    navIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: C.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
      flexShrink: 0,
    },
    heroTitleBlock: { flex: 1, gap: 3 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: C.accentDim,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
      gap: 4,
    },
    badgeText: { color: C.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    heroTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: C.accentDim,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 4,
    },
    locationText: { color: C.accent, fontSize: 9, fontWeight: '600' },
    heroCounters: { flexDirection: 'row', gap: 5, flexShrink: 0 },
    counterCard: {
      width: 60,
      backgroundColor: C.surfaceAlt,
      borderRadius: 11,
      paddingVertical: 7,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    counterValue: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    counterLabel: {
      color: C.textMuted,
      fontSize: 8,
      fontWeight: '700',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 5,
      borderWidth: 1,
      borderColor: C.border,
      flexShrink: 0,
    },
    searchPillText: { color: C.textSecondary, fontSize: 10, fontWeight: '500' },
    selectorContent: { gap: 6, paddingRight: 4 },
    chip:            { backgroundColor: C.surface, borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive:      { borderColor: C.accent, backgroundColor: C.accentDim },
    chipText:        { color: C.textSecondary, fontSize: 11, fontWeight: '600' },
    chipTextActive:  { color: C.textPrimary },
    grid: {
      flexDirection: isLandscape ? 'row' : 'column',
      alignItems:    'flex-start',
      gap: S.gap,
    },
    leftCol: {
      width: isLandscape ? 310 : '100%',
      gap: S.gap,
      flexShrink: 0,
    },
    rightCol: {
      flex: 1,
      minWidth: 0,
      width: isLandscape ? undefined : '100%',
    },
    infoCard: {
      backgroundColor: C.surface,
      borderRadius: S.radius,
      borderWidth: 1,
      borderColor: C.border,
      padding: S.cardPad,
    },
    infoHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    infoIconWrap:   { width: 28, height: 28, borderRadius: 8, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
    infoTitle:      { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
    infoCaption:    { color: C.textMuted, fontSize: 9, marginTop: 1 },
    infoBody:       { marginTop: 9, gap: 7 },
    infoDesc:       { color: C.textSecondary, fontSize: 10, lineHeight: 15 },
    infoMiniRow:    { flexDirection: 'row', gap: 5 },
    infoMiniCard:   { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    infoMiniVal:    { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    infoMiniLabel:  { color: C.textMuted, fontSize: 9, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
    tagsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    tag:            { backgroundColor: C.surfaceAlt, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
    tagAccent:      { borderWidth: 1, borderColor: C.accentDimBorder },
    tagText:        { color: C.textSecondary, fontSize: 10, fontWeight: '500' },
    tagAccentText:  { color: C.accent, fontSize: 10, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 6 },
    quickBtn: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: S.radius,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 4,
    },
    quickBtnText: { color: C.textPrimary, fontSize: 10, fontWeight: '600' },
    featuredCard: {
      backgroundColor: C.surface,
      borderRadius: S.radiusLg,
      borderWidth: 1,
      borderColor: C.border,
      padding: S.cardPad,
      overflow: 'hidden',
      width: '100%',
    },
    sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
    sectionTitle:    { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
    sectionSubtitle: { color: C.textSecondary, fontSize: 10, marginTop: 2 },
    sectionLink:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sectionLinkText: { color: C.accent, fontSize: 10, fontWeight: '600' },
    carouselWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      width: '100%',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(5,10,20,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isLandscape ? 28 : 16,
      paddingVertical:   isLandscape ? 20 : 18,
    },
    modalContainer: {
      width: '100%',
      maxWidth:  isLandscape ? 860 : 460,
      maxHeight: isLandscape ? '92%' : '88%',
      backgroundColor: C.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    modalScroll: { padding: isLandscape ? 18 : 14 },
    modalBody: {
      flexDirection: isLandscape ? 'row' : 'column',
      gap: isLandscape ? 16 : 12,
    },
    modalImgWrap: {
      width:  isLandscape ? '42%' : '100%',
      height: isLandscape ? 300 : 200,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.border,
      flexShrink: 0,
    },
    modalImg: { width: '100%', height: '100%' },
    modalInfo:       { flex: 1, gap: 8, minWidth: 0 },
    modalName:       { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    modalScientific: { color: C.accent, fontSize: 10, fontStyle: 'italic', marginTop: 1 },
    modalDesc:       { color: C.textSecondary, fontSize: 10, lineHeight: 15 },
    modalMetaList:   { gap: 5 },
    modalMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modalMetaText:   { flex: 1, color: C.textSecondary, fontSize: 10 },
    discoverBtn: {
      marginTop: 12,
      backgroundColor: C.accent,
      borderRadius: 13,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    discoverBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    discoveredBadge: {
      marginTop: 12,
      backgroundColor: C.greenDim,
      borderRadius: 13,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: C.greenBorder,
    },
    discoveredText: { color: C.green, fontSize: 11, fontWeight: '700' },
    closeBtn:     { alignSelf: 'center', marginTop: 8, paddingHorizontal: 16, paddingVertical: 6 },
    closeBtnText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  });
 
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <TouchableOpacity
              onPress={() => router.replace('/Home')}
              style={styles.navIconBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={16} color={C.textPrimary} />
            </TouchableOpacity>

            <View style={styles.heroTitleBlock}>
              <View style={styles.badge}>
                <Ionicons name="leaf-outline" size={10} color={C.accent} />
              </View>
              <Text style={styles.heroTitle}>WildTrack</Text>
              <View style={styles.locationPill}>
                <Ionicons name="navigate-outline" size={11} color={C.accent} />
              </View>
            </View>

            <View style={styles.heroCounters}>
              <View style={styles.counterCard}>
              </View>
              <View style={styles.counterCard}>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/wildtrack/SpeciesSearch')}
              style={styles.searchPill}
              activeOpacity={0.85}
            >
              <Ionicons name="search" size={13} color={C.textSecondary} />
              <Text style={styles.searchPillText}>Search</Text>
            </TouchableOpacity>

          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorContent}
        >
          {MOUNTAINS.map((m) => {
            const active = selectedMountainId === m.id;
            return (
              <TouchableOpacity key={m.id} />
            );
          })}
        </ScrollView>

        <View style={styles.grid}>
          <View style={styles.leftCol}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowMountainInfo(!showMountainInfo)}
              style={styles.infoCard}
            >
            </TouchableOpacity>

            <ProgressCard
              stats={stats}
              mountainName={currentMountain.name}
              onExplorePress={() => router.push('/wildtrack/SpeciesSearch')}
            />

            <View style={styles.quickRow}>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={styles.featuredCard}>
            </View>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showLockedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedSpecies && (
              <View />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
