/**
 * viewpoint.tsx — restyled to match ProfileCard.tsx design system
 *
 * ProfileCard tokens used:
 *   bg: #0E1520 (card) / #111927 (panel) / #1E2D42 (avatar)
 *   gold: #C9A96E — accent, badges, active elements
 *   borders: rgba(255,255,255,0.07/0.08)
 *   text: #FFF / rgba(255,255,255,0.7/0.38/0.28)
 *   green: #6FAF8A — safe features
 *   danger: #E07070 — unsafe features
 *   radius: 16 (card), 8 (btn)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
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

// ── ProfileCard design tokens ─────────────────────────────────────────────
const PC = {
  bgCard:        '#0E1520',
  bgPanel:       '#111927',
  bgAvatar:      '#1E2D42',
  bgSubtle:      'rgba(255,255,255,0.05)',
  bgDangerSubtle:'rgba(224,112,112,0.07)',
  border:        'rgba(255,255,255,0.07)',
  borderSubtle:  'rgba(255,255,255,0.08)',
  borderGold:    'rgba(201,169,110,0.4)',
  borderDanger:  'rgba(224,112,112,0.2)',
  gold:          '#C9A96E',
  green:         '#6FAF8A',
  danger:        '#E07070',
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted:     '#8A9BB0',
  textFaint:     'rgba(255,255,255,0.38)',
  textFaintest:  'rgba(255,255,255,0.28)',
  radius:        16,
  radiusBtn:     8,
};

// ── Image map ─────────────────────────────────────────────────────────────
const IMAGE_MAP: Record<string, ImageSourcePropType> = {
  trailhead:     require('../../assets/images/TrailHead.jpg'),
  bantang_river: require('../../assets/images/Bantang River.jpg'),
  camp1:         require('../../assets/images/Camp1.jpg'),
  waterfall:     require('../../assets/images/Waterfalss.jpg'),
  mossy_forest:  require('../../assets/images/MossyForest.jpg'),
  camp2:         require('../../assets/images/Camp1.jpg'),
  camp3:         require('../../assets/images/Camp2$3.jpg'),
  crown_shyness: require('../../assets/images/CrownShines.jpg'),
  summit_ridge:  require('../../assets/images/SummitRidge.jpg'),
  summit:        require('../../assets/images/Summit.jpg'),
};

interface StatChipProps {
  icon: string;
  label: string;
  value: string;
}

export default function ViewpointScreen() {
  const router      = useRouter();
  const params      = useLocalSearchParams();
  const viewpointId = params.viewpointId as string | undefined;

  const data = VIEWPOINTS_DATA[(viewpointId as keyof ViewpointsDataType) || 'v1'];

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={32} color={PC.gold} />
        </View>
        <Text style={styles.errorTitle}>Viewpoint not found</Text>
        <Text style={styles.errorSub}>This stop doesn't exist in the trail data.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
          <Ionicons name="chevron-back" size={14} color={PC.textSecondary} />
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [imageModalVisible, setImageModalVisible] = React.useState(false);
  const heroImage = IMAGE_MAP[data.imageKey];
  const heroImageSource = heroImage ? Image.resolveAssetSource(heroImage) : null;
  const imageAspectRatio = heroImageSource ? heroImageSource.width / heroImageSource.height : 1;
  const imageModalWidth = heroImageSource
    ? Math.min(SCREEN_WIDTH * 0.92, heroImageSource.width)
    : SCREEN_WIDTH * 0.92;
  const imageModalHeight = heroImageSource
    ? Math.min(SCREEN_HEIGHT * 0.84, imageModalWidth / imageAspectRatio)
    : SCREEN_HEIGHT * 0.72;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <View style={styles.heroWrapper}>
        <TouchableOpacity
          style={styles.heroMediaTouch}
          activeOpacity={heroImage ? 0.85 : 1}
          onPress={heroImage ? () => setImageModalVisible(true) : undefined}
          accessibilityRole={heroImage ? 'button' : undefined}
          accessibilityLabel={heroImage ? 'View full image' : undefined}
        >
          {heroImage ? (
            <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={48} color={PC.gold} />
              <Text style={styles.heroPlaceholderText}>{data.name}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Back button — ProfileCard settingsBtn style */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={PC.textSecondary} />
        </TouchableOpacity>

        {/* Elevation badge — ProfileCard gold accent */}
        <View style={styles.elevBadge}>
          <Ionicons name="trending-up-outline" size={11} color={PC.bgCard} />
          <Text style={styles.elevText}>{data.elevation}</Text>
        </View>

        {/* Title block */}
        <View style={styles.heroTitleBlock}>
          <Text style={styles.heroSubtitle}>{data.subtitle}</Text>
          <Text style={styles.heroTitle}>{data.name}</Text>
        </View>
      </View>

      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setImageModalVisible(false)}>
          <View style={styles.imageModalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.imageModalCard,
                  { width: imageModalWidth, height: imageModalHeight },
                ]}
              >
                {heroImage && (
                  <Image source={heroImage} style={styles.imageModalImage} resizeMode="contain" />
                )}
                <TouchableOpacity
                  style={styles.imageModalClose}
                  onPress={() => setImageModalVisible(false)}
                  accessibilityLabel="Close image viewer"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={18} color={PC.textPrimary} />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── SCROLLABLE BODY ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats row — ProfileCard statsRow pattern */}
        <View style={styles.statsRow}>
          <StatChip icon="walk-outline"  label="Distance" value={data.distanceFromStart} />
          <View style={styles.statSep} />
          <StatChip icon="time-outline"  label="Est. hike" value={data.estimatedHike} />
          <View style={styles.statSep} />
          <StatChip icon="sunny-outline" label="Best time" value={data.bestTime.split(' ')[0]} />
        </View>

        {/* Tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContent}
        >
          {data.tags.map((tag: string) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>

        {/* About — ProfileCard leftPanel section */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelAccent} />
            <Text style={styles.panelTitle}>About this Stop</Text>
          </View>
          <Text style={styles.description}>{data.description}</Text>
        </View>

        {/* Best time — ProfileCard progressTrack style card */}
        <View style={styles.bestTimeCard}>
          <View style={styles.bestTimeIcon}>
            <Ionicons name="alarm-outline" size={14} color={PC.gold} />
          </View>
          <Text style={styles.bestTimeText}>{data.bestTime}</Text>
        </View>

        {/* Features — ProfileCard mountainRow list style */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelAccent} />
            <Text style={styles.panelTitle}>What to Expect</Text>
          </View>
          <View style={styles.featuresList}>
            {data.features.map((f: any, i: number) => (
              <View
                key={i}
                style={[
                  styles.featureRow,
                  i === data.features.length - 1 && styles.featureRowLast,
                ]}
              >
                <View style={[
                  styles.featureIcon,
                  { backgroundColor: f.safe ? 'rgba(111,175,138,0.12)' : PC.bgDangerSubtle },
                ]}>
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={f.safe ? PC.green : PC.danger}
                  />
                </View>
                <Text style={[styles.featureText, !f.safe && { color: PC.danger }]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions — ProfileCard settingsBtn / logoutBtn pattern */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/drawer/calendar')}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={15} color={PC.bgCard} />
            <Text style={styles.primaryBtnText}>Schedule Hike</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={15} color={PC.textSecondary} />
            <Text style={styles.secondaryBtnText}>Back to Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────
function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon as any} size={16} color={PC.gold} />
      <Text style={styles.statChipLabel}>{label}</Text>
      <Text style={styles.statChipValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PC.bgCard,   // ProfileCard: '#0E1520'
  },

  // ── Error ──────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: PC.bgCard,
    paddingHorizontal: 32,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PC.textPrimary,
  },
  errorSub: {
    fontSize: 12,
    color: PC.textFaint,
    textAlign: 'center',
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgSubtle,
    borderWidth: 1,
    borderColor: PC.borderSubtle,
    marginTop: 4,
  },
  errorBtnText: {
    color: PC.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Hero ───────────────────────────────────────────────────────────────
  heroWrapper: {
    height: SCREEN_HEIGHT * 0.42,
    width: '100%',
    backgroundColor: PC.bgAvatar,
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
    gap: 10,
  },
  heroPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: PC.gold,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // ProfileCard card dark overlay pattern
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  imageModalCard: {
    backgroundColor: 'transparent',
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.gold,
    overflow: 'hidden',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  imageModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMediaTouch: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // Back btn — ProfileCard settingsBtn
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Elevation badge — ProfileCard gold accent pill
  elevBadge: {
    position: 'absolute',
    top: 52,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.gold,
  },
  elevText: {
    color: PC.bgCard,
    fontSize: 11,
    fontWeight: '700',
  },

  heroTitleBlock: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  heroSubtitle: {
    fontSize: 10,
    color: PC.textFaint,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: PC.textPrimary,
    lineHeight: 30,
  },

  // ── Scroll ─────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // ── Stats — ProfileCard statsRow ───────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusBtn,
    borderWidth: 1,
    borderColor: PC.border,
    paddingVertical: 10,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statChipLabel: {
    fontSize: 9,
    color: PC.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statChipValue: {
    fontSize: 11,
    color: PC.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: PC.borderSubtle,
  },

  // ── Tags ───────────────────────────────────────────────────────────────
  tagsScroll: { marginTop: 12 },
  tagsContent: { paddingHorizontal: 16, gap: 6 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.borderGold,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: PC.gold,
  },

  // ── Panel — ProfileCard leftPanel style ────────────────────────────────
  panel: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.border,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  // ProfileCard dividerH equivalent as accent bar
  panelAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: PC.gold,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: PC.textPrimary,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    color: PC.textSecondary,
    lineHeight: 21,
  },

  // ── Best time — ProfileCard progressTrack card ─────────────────────────
  bestTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.borderGold,
  },
  bestTimeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(201,169,110,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: PC.gold,
    flex: 1,
  },

  // ── Features — ProfileCard mountainRow list ────────────────────────────
  featuresList: { gap: 0 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
  },
  featureRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    fontSize: 12,
    color: PC.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Actions ────────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 18,
  },
  // ProfileCard avatar border / gold accent → primary CTA
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.gold,
  },
  primaryBtnText: {
    color: PC.bgCard,
    fontSize: 13,
    fontWeight: '700',
  },
  // ProfileCard settingsBtn
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgSubtle,
    borderWidth: 1,
    borderColor: PC.borderSubtle,
  },
  secondaryBtnText: {
    color: PC.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});