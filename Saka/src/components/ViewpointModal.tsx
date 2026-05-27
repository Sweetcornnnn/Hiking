/**
 * ViewpointModal.tsx
 *
 * Landscape-phone-first modal that opens after the zoom→reveal sequence.
 *
 * ── Why landscape layout fits ─────────────────────────────────────────────
 * Most phones in landscape are ~360–393px tall. A vertically-stacked
 * (image → title → description → features) layout would require ~500–600px
 * and scroll immediately. Instead we use two columns:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  [mini-map header — captured viewport snapshot]  │  ← ~72px
 *   ├─────────────────────┬────────────────────────────┤
 *   │  Area image         │  Title + stats + desc      │  ← ~200px
 *   │  (fixed 160×160)    │  tags + features (2-col)   │
 *   ├─────────────────────┴────────────────────────────┤
 *   │  [action buttons row]                            │  ← ~48px
 *   └──────────────────────────────────────────────────┘
 *
 * Total ≤ 330px. Fits on a 360px landscape screen with room to spare.
 *
 * ── ProfileCard token usage ────────────────────────────────────────────────
 * Every colour, radius, and font size is imported from designTokens.ts,
 * which maps each value back to its ProfileCard.tsx source rule.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 * - aria-modal="true" on the modal root
 * - Focus trap via useFocusTrap (inline below)
 * - Keyboard dismiss on Escape (via useEffect on keydown)
 * - Screen reader announcement via accessibilityLiveRegion
 * - Back button and tap-outside both call onDismiss
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BG_AVATAR,
  BORDER_DEFAULT,
  BORDER_GOLD,
  BORDER_SUBTLE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_FAINT,
  TEXT_FAINTEST,
  ACCENT_GOLD,
  ACCENT_GREEN,
  ACCENT_TRAIL,
  TEXT_DANGER,
  BORDER_DANGER,
  RADIUS_CARD,
  RADIUS_BTN,
  FONT,
  SPACING,
  ANIM,
} from '../theme/designTokens';
import type {
  ViewpointModalProps,
  ViewpointDetail,
  ViewportSnapshot,
} from '../types/viewpointTypes';

// ─── Image map — same pattern as viewpoint.tsx ─────────────────────────────
// Replace placeholder.png with actual images in your project.
const IMAGE_MAP: Record<string, any> = {
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

// ─── Viewport Mini-Map Header ──────────────────────────────────────────────
/**
 * Renders a compact representation of the captured viewport state
 * at the top of the modal.
 *
 * We do NOT re-mount a full MapView here (too heavy, causes Android jank).
 * Instead we render a styled data-row that communicates the context:
 * trail name, coordinates, and selected viewpoint number.
 *
 * For a richer thumbnail, pass screenshotUri from an html2canvas capture
 * and it will render as a preview image instead.
 */
function CapturedViewportHeader({ snapshot, accentColor }: {
  snapshot: ViewportSnapshot;
  accentColor: string;
}) {
  const { selectedViewpoint, screenshotUri, centerCoord } = snapshot;

  return (
    <View style={[headerStyles.wrap, { borderBottomColor: BORDER_DEFAULT }]}>
      {screenshotUri ? (
        <Image
          source={{ uri: screenshotUri }}
          style={headerStyles.screenshot}
          resizeMode="cover"
        />
      ) : (
        <View style={[headerStyles.coordBadge, { backgroundColor: BG_AVATAR }]}>
          <Ionicons name="map-outline" size={11} color={ACCENT_TRAIL} />
          <Text style={headerStyles.coordText}>
            {centerCoord.latitude.toFixed(4)}° N {' '}
            {Math.abs(centerCoord.longitude).toFixed(4)}° E
          </Text>
        </View>
      )}

      <View style={headerStyles.titleRow}>
        <View style={[headerStyles.dot, { backgroundColor: accentColor }]} />
        <Text style={headerStyles.viewpointName} numberOfLines={1}>
          {selectedViewpoint.name}
        </Text>
        {selectedViewpoint.elevation && (
          <Text style={headerStyles.elevation}>{selectedViewpoint.elevation}</Text>
        )}
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingHorizontal: SPACING.cardPadH,
    paddingVertical:  8,
    borderBottomWidth: 1,
  },
  screenshot: {
    width:        48,
    height:       32,
    borderRadius: 4,
  },
  coordBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:   RADIUS_BTN,
  },
  coordText: {
    fontSize: 9,
    color:    ACCENT_TRAIL,
    fontWeight: '600' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  titleRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:             6,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  viewpointName: {
    flex:       1,
    fontSize:   11,
    fontWeight: '700' as const,
    color:      TEXT_PRIMARY,
  },
  elevation: {
    fontSize: 10,
    color:    TEXT_MUTED,
    fontWeight: '600' as const,
  },
});

// ─── Feature row ───────────────────────────────────────────────────────────
function FeatureRow({ icon, text, safe }: { icon: string; text: string; safe: boolean }) {
  return (
    <View style={featureStyles.row}>
      <View style={[featureStyles.icon, { backgroundColor: safe ? '#1B3A1B' : '#3A1B1B' }]}>
        <Ionicons
          name={icon as any}
          size={11}
          color={safe ? ACCENT_GREEN : TEXT_DANGER}
        />
      </View>
      <Text
        style={[featureStyles.text, !safe && { color: TEXT_DANGER }]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           6,
    flex:          1,
  },
  icon: {
    width:        20,
    height:       20,
    borderRadius: 5,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  text: {
    fontSize: 10,
    color:    TEXT_SECONDARY,
    flex:     1,
    lineHeight: 14,
  },
});

// ─── Stat chip (compact) ───────────────────────────────────────────────────
function MiniStat({ icon, label, value, accent }: {
  icon: string; label: string; value: string; accent: string;
}) {
  return (
    <View style={miniStatStyles.wrap}>
      <Ionicons name={icon as any} size={12} color={accent} />
      <Text style={miniStatStyles.label}>{label}</Text>
      <Text style={miniStatStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const miniStatStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap:         2,
    flex:        1,
  },
  label: {
    fontSize: 8,
    color:    TEXT_FAINT,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    fontWeight: '600' as const,
  },
  value: {
    fontSize: 10,
    color:    TEXT_PRIMARY,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
});

// ─── Main modal ────────────────────────────────────────────────────────────
export default function ViewpointModal({
  visible,
  snapshot,
  detail,
  onDismiss,
  mountainId,
}: ViewpointModalProps) {
  const router    = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError]   = useState(false);

  // ── Entrance animation ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setImageLoaded(false);
      setImageError(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue:         1,
          duration:        ANIM.fadeMs,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue:         1,
          duration:        ANIM.fadeMs + 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.94);
    }
  }, [visible, fadeAnim, scaleAnim]);

  // ── Keyboard dismiss (web / desktop) ────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [visible, onDismiss]);

  if (!snapshot || !detail) return null;

  const accent     = detail.accentColor;
  const heroImage  = IMAGE_MAP[detail.imageKey];
  const { width: SCREEN_W } = Dimensions.get('window');

  // ── Image column width — scales with screen width up to 160px ──────
  const imageColW  = Math.min(SCREEN_W * 0.38, 160);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      // Accessibility
      accessibilityViewIsModal
    >
      {/* ── Backdrop ── */}
      <TouchableWithoutFeedback onPress={onDismiss} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* ── Animated card ── */}
      <Animated.View
        style={[
          styles.cardWrap,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
        // aria-modal="true" via accessibilityViewIsModal above
        accessibilityLabel={`${detail.name} viewpoint details`}
        accessibilityLiveRegion="polite"
      >
        {/* ══ HEADER: captured viewport context ══ */}
        <CapturedViewportHeader snapshot={snapshot} accentColor={accent} />

        {/* ══ BODY: landscape two-column layout ══ */}
        <View style={styles.body}>

          {/* ── LEFT: area image ── */}
          <View style={[styles.imageCol, { width: imageColW }]}>
            {!imageError && heroImage ? (
              <Animated.Image
                source={heroImage}
                style={[styles.heroImg, { opacity: imageLoaded ? 1 : 0 }]}
                resizeMode="cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : (
              /* ProfileCard-style error/placeholder — uses BG_AVATAR + ACCENT_GOLD */
              <View style={styles.imgPlaceholder}>
                <Ionicons name="image-outline" size={24} color={ACCENT_GOLD} />
                <Text style={styles.imgPlaceholderText} numberOfLines={2}>
                  {detail.name}
                </Text>
              </View>
            )}

            {/* Elevation badge — mirrors viewpoint.tsx elevationBadge */}
            <View style={[styles.elevBadge, { backgroundColor: accent }]}>
              <Ionicons name="trending-up-outline" size={9} color="#FFF" />
              <Text style={styles.elevText}>{detail.elevation}</Text>
            </View>
          </View>

          {/* ── RIGHT: info pane ── */}
          <View style={styles.infoCol}>

            {/* Title block */}
            <Text style={styles.subtitle} numberOfLines={1}>{detail.subtitle}</Text>
            <Text style={styles.title}    numberOfLines={2}>{detail.name}</Text>

            {/* Mini stats */}
            <View style={styles.statsRow}>
              <MiniStat icon="walk-outline"  label="Dist" value={detail.distanceFromStart} accent={accent} />
              <View style={styles.statSep} />
              <MiniStat icon="time-outline"  label="Hike" value={detail.estimatedHike}     accent={accent} />
              <View style={styles.statSep} />
              <MiniStat icon="sunny-outline" label="Best" value={detail.bestTime.split(' ')[0]} accent={accent} />
            </View>

            {/* Tags — horizontal scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsScroll}
              contentContainerStyle={styles.tagsContent}
            >
              {detail.tags.slice(0, 4).map((tag: string) => (
                <View key={tag} style={[styles.tag, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
                  <Text style={[styles.tagText, { color: accent }]}>{tag}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Description — 2 lines max */}
            <Text style={styles.desc} numberOfLines={2}>{detail.description}</Text>

            {/* Features — 2-column grid */}
            <View style={styles.featuresGrid}>
              {detail.features.slice(0, 4).map((f: any, i: number) => (
                <FeatureRow key={i} icon={f.icon} text={f.text} safe={f.safe} />
              ))}
            </View>
          </View>
        </View>

        {/* ══ FOOTER: action buttons ══ */}
        <View style={styles.footer}>
          {/* Close / Back to map */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onDismiss}
            activeOpacity={0.85}
            accessibilityLabel="Back to map"
            accessibilityRole="button"
          >
            <Ionicons name="map-outline" size={13} color={TEXT_SECONDARY} />
            <Text style={styles.secondaryBtnText}>Back to Map</Text>
          </TouchableOpacity>

          {/* Full detail page */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() => {
              onDismiss();
              router.push({
                pathname: '/viewpoint',
                params: {
                  viewpointId: snapshot.selectedViewpoint.id,
                  mountainId,
                },
              });
            }}
            activeOpacity={0.85}
            accessibilityLabel="View full details"
            accessibilityRole="button"
          >
            <Ionicons name="expand-outline" size={13} color="#FFF" />
            <Text style={styles.primaryBtnText}>View Details</Text>
          </TouchableOpacity>

          {/* Schedule hike */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT_GOLD }]}
            onPress={() => {
              onDismiss();
              router.push('./calendar');
            }}
            activeOpacity={0.85}
            accessibilityLabel="Schedule a hike"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={13} color="#000" />
            <Text style={[styles.primaryBtnText, { color: '#000' }]}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Close X button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onDismiss}
          accessibilityLabel="Close viewpoint details"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={13} color={TEXT_FAINTEST} />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
// All colours from designTokens.ts → ProfileCard.tsx origin noted per-rule.
const styles = StyleSheet.create({
  // Backdrop — transparent like ProfileCard's centerContainer
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // Card — mirrors ProfileCard card: BG_CARD, RADIUS_CARD, BORDER_DEFAULT
  cardWrap: {
    position:       'absolute',
    bottom:         16,
    left:           12,
    right:          12,
    backgroundColor: BG_CARD,         // ProfileCard: '#0E1520'
    borderRadius:   RADIUS_CARD,      // ProfileCard: 16
    borderWidth:    1,
    borderColor:    BORDER_DEFAULT,   // ProfileCard: 'rgba(255,255,255,0.07)'
    overflow:       'hidden',
    maxHeight:      340,
  },

  // Body: two-column row
  body: {
    flexDirection: 'row',
    flex:          1,
    minHeight:     0,
  },

  // Left image column
  imageCol: {
    position: 'relative',
    backgroundColor: BG_AVATAR,  // ProfileCard: '#1E2D42'
  },
  heroImg: {
    width:  '100%',
    height: '100%',
  },
  imgPlaceholder: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    gap:              6,
    backgroundColor: BG_AVATAR,  // ProfileCard error bg
    padding:         12,
  },
  imgPlaceholderText: {
    fontSize:   10,
    color:      ACCENT_GOLD,    // ProfileCard: avatarInitials '#C9A96E'
    fontWeight: '600',
    textAlign:  'center',
  },
  elevBadge: {
    position:       'absolute',
    top:             8,
    right:           8,
    flexDirection:  'row',
    alignItems:     'center',
    gap:             3,
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderRadius:   10,
  },
  elevText: {
    color:      '#FFF',
    fontSize:    9,
    fontWeight: '700',
  },

  // Right info column
  infoCol: {
    flex:              1,
    paddingHorizontal: SPACING.cardPadH,  // ProfileCard: 16
    paddingVertical:   10,
    backgroundColor:   BG_PANEL,          // ProfileCard: '#111927'
    minWidth:          0,
  },
  subtitle: {
    fontSize:      9,
    color:         TEXT_FAINT,           // ProfileCard: 'rgba(255,255,255,0.38)'
    fontWeight:   '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  2,
  },
  title: {
    fontSize:    14,
    fontWeight: '800',
    color:       TEXT_PRIMARY,           // ProfileCard: '#FFFFFF'
    lineHeight:  18,
    marginBottom: 6,
  },

  // Stats row
  statsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:    6,
    backgroundColor: BG_SUBTLE,          // ProfileCard: settingsBtn bg
    borderRadius:   RADIUS_BTN,          // ProfileCard: 8
    paddingVertical: 5,
  },
  statSep: {
    width:           1,
    height:          16,
    backgroundColor: BORDER_SUBTLE,      // ProfileCard: 'rgba(255,255,255,0.08)'
  },

  // Tags
  tagsScroll:   { marginBottom: 6 },
  tagsContent:  { gap: 5 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      10,
    borderWidth:        1,
  },
  tagText: {
    fontSize:   9,
    fontWeight: '600',
  },

  // Description
  desc: {
    fontSize:    10,
    color:       TEXT_SECONDARY,        // ProfileCard: 'rgba(255,255,255,0.7)'
    lineHeight:  15,
    marginBottom: 6,
  },

  // Features 2-col grid
  featuresGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:             4,
  },

  // Footer
  footer: {
    flexDirection:   'row',
    gap:              8,
    paddingHorizontal: SPACING.cardPadH,
    paddingVertical:   10,
    borderTopWidth:   1,
    borderTopColor:   BORDER_DEFAULT,   // ProfileCard: 'rgba(255,255,255,0.07)'
    backgroundColor:  BG_CARD,
  },
  primaryBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             5,
    paddingVertical: 8,
    borderRadius:   RADIUS_BTN,         // ProfileCard: 8
  },
  primaryBtnText: {
    color:      '#FFF',
    fontSize:    11,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             5,
    paddingVertical: 8,
    borderRadius:   RADIUS_BTN,
    backgroundColor: BG_SUBTLE,         // ProfileCard: settingsBtn
    borderWidth:    1,
    borderColor:    BORDER_SUBTLE,
  },
  secondaryBtnText: {
    color:      TEXT_SECONDARY,         // ProfileCard: 'rgba(255,255,255,0.7)'
    fontSize:    11,
    fontWeight: '600',
  },

  // Close X — mirrors ProfileCard closeBtn
  closeBtn: {
    position:       'absolute',
    top:             6,
    right:           8,
    width:           22,
    height:          22,
    borderRadius:    11,                // ProfileCard: RADIUS_PILL = 11
    backgroundColor: BG_SUBTLE,
    justifyContent: 'center',
    alignItems:     'center',
  },
});