import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  StatusBar,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VIEWPOINTS_DATA, ViewpointsDataType } from '../data/viewpointsData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map imageKey → local asset. Replace with your actual image imports.
const IMAGE_MAP: Record<string, ImageSourcePropType> = {
  trailhead: require('../../assets/viewpoints/placeholder.png'),
  bantang_river: require('../../assets/viewpoints/placeholder.png'),
  camp1: require('../../assets/viewpoints/placeholder.png'),
  waterfall: require('../../assets/viewpoints/placeholder.png'),
  mossy_forest: require('../../assets/viewpoints/placeholder.png'),
  camp2: require('../../assets/viewpoints/placeholder.png'),
  camp3: require('../../assets/viewpoints/placeholder.png'),
  crown_shyness: require('../../assets/viewpoints/placeholder.png'),
  summit_ridge: require('../../assets/viewpoints/placeholder.png'),
  summit: require('../../assets/viewpoints/placeholder.png'),
};

interface LocalSearchParams {
  viewpointId?: string;
  mountainId?: string;
}

interface StatChipProps {
  icon: string;
  label: string;
  value: string;
  accent: string;
}

export default function ViewpointScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewpointId = params.viewpointId as string | undefined;
  const mountainId = params.mountainId as string | undefined;

  const data = VIEWPOINTS_DATA[(viewpointId as keyof ViewpointsDataType) || 'v1'];

  // Fallback if viewpointId doesn't match
  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#8B7355" />
        <Text style={styles.errorText}>Viewpoint not found.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroImage = IMAGE_MAP[data.imageKey];
  const accent = data.accentColor;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HERO IMAGE ── */}
      <View style={styles.heroWrapper}>
        {heroImage ? (
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: accent + '33' }]}>
            <Ionicons name="image-outline" size={64} color={accent} />
            <Text style={[styles.heroPlaceholderText, { color: accent }]}>
              {data.name}
            </Text>
          </View>
        )}

        {/* Dark gradient at bottom of hero */}
        <View style={styles.heroGradient} />

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Elevation badge — top right */}
        <View style={[styles.elevationBadge, { backgroundColor: accent }]}>
          <Ionicons name="trending-up-outline" size={13} color="#FFF" />
          <Text style={styles.elevationText}>{data.elevation}</Text>
        </View>

        {/* Hero title block */}
        <View style={styles.heroTitleBlock}>
          <Text style={styles.heroSubtitle}>{data.subtitle}</Text>
          <Text style={styles.heroTitle}>{data.name}</Text>
        </View>
      </View>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── QUICK STATS ROW ── */}
        <View style={styles.statsRow}>
          <StatChip icon="walk-outline" label="Distance" value={data.distanceFromStart} accent={accent} />
          <StatChip icon="time-outline" label="Est. hike" value={data.estimatedHike} accent={accent} />
          <StatChip icon="sunny-outline" label="Best time" value={data.bestTime.split(' ')[0]} accent={accent} />
        </View>

        {/* ── TAGS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContent}
        >
          {data.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { borderColor: accent + '55', backgroundColor: accent + '15' }]}>
              <Text style={[styles.tagText, { color: accent }]}>{tag}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── DESCRIPTION ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
            <Text style={styles.sectionTitle}>About this Stop</Text>
          </View>
          <Text style={styles.description}>{data.description}</Text>
        </View>

        {/* ── BEST TIME ── */}
        <View style={[styles.bestTimeCard, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Ionicons name="alarm-outline" size={18} color={accent} />
          <Text style={[styles.bestTimeText, { color: accent }]}>{data.bestTime}</Text>
        </View>

        {/* ── FEATURES ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
            <Text style={styles.sectionTitle}>What to Expect</Text>
          </View>
          <View style={styles.featuresList}>
            {data.features.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: f.safe ? '#E8F5E9' : '#FFEBEE' },
                  ]}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={16}
                    color={f.safe ? '#2E7D32' : '#C62828'}
                  />
                </View>
                <Text style={[styles.featureText, !f.safe && styles.featureWarn]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── ACTIONS ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() => router.push('./calendar')}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFF" />
            <Text style={styles.primaryBtnText}>Schedule Hike</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={18} color="#2C3E50" />
            <Text style={styles.secondaryBtnText}>Back to Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Small reusable stat chip ── */
function StatChip({ icon, label, value, accent }: StatChipProps) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon as any} size={18} color={accent} />
      <Text style={styles.statChipLabel}>{label}</Text>
      <Text style={styles.statChipValue}>{value}</Text>
    </View>
  );
}

/* ─────────────────────── STYLES ─────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F4EF',
  },

  /* Error */
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#F8F4EF',
  },
  errorText: { fontSize: 16, color: '#8B7355', fontWeight: '600' },
  errorButton: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: { color: '#FFF', fontWeight: '600' },

  /* Hero */
  heroWrapper: {
    height: SCREEN_HEIGHT * 0.42,
    width: '100%',
    position: 'relative',
    backgroundColor: '#D4C4B0',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heroPlaceholderText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 0,
    top: '40%',
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elevationBadge: {
    position: 'absolute',
    top: 52,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  elevationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitleBlock: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 32,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  statChipLabel: {
    fontSize: 10,
    color: '#9E9E9E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statChipValue: {
    fontSize: 11,
    color: '#2C3E50',
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Tags */
  tagsScroll: { marginTop: 14 },
  tagsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Section */
  section: {
    marginHorizontal: 16,
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2C3E50',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 23,
  },

  /* Best time card */
  bestTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bestTimeText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  /* Features */
  featuresList: { gap: 10 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#2C3E50',
    flex: 1,
  },
  featureWarn: {
    color: '#C62828',
  },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 28,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#ECDEC8',
  },
  secondaryBtnText: {
    color: '#2C3E50',
    fontSize: 14,
    fontWeight: '700',
  },
});
