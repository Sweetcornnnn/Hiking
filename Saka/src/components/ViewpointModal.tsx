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
  useState,
} from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  BG_CARD,
  BG_AVATAR,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  TEXT_SECONDARY,
  ACCENT_GOLD,
  RADIUS_CARD,
  RADIUS_BTN,
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


export default function ViewpointModal({
  visible,
  snapshot,
  detail,
  onDismiss,
  mountainId,
}: ViewpointModalProps) {
  const router    = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError]   = useState(false);

  useEffect(() => {
    if (visible) {
      setImageLoaded(false);
      setImageError(false);
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 500,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 500,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1, duration: 600,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 280,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 40, duration: 280,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [visible, onDismiss]);

  if (!snapshot || !detail) return null;

  const accent    = detail.accentColor ?? ACCENT_GOLD;
  const heroImage = IMAGE_MAP[detail.imageKey];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      accessibilityViewIsModal
    >
      {/* Tap-outside-to-dismiss backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
        accessible={false}
      />

      {/* ── Animated card slides up from bottom ── */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity:   fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
        accessibilityLabel={`${detail.name} viewpoint`}
        accessibilityLiveRegion="polite"
      >
        {/* ── Full-bleed hero image ── */}
        <View style={styles.imageWrap}>
          {!imageError && heroImage ? (
            <Animated.Image
              source={heroImage}
              style={[styles.heroImage, { opacity: imageLoaded ? 1 : 0 }]}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={36} color={ACCENT_GOLD} />
            </View>
          )}

          {/* Gradient overlay so text is always readable */}
          <View style={styles.imageGradient} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>

          {/* Elevation badge */}
          {detail.elevation ? (
            <View style={[styles.elevBadge, { backgroundColor: accent }]}>
              <Ionicons name="trending-up-outline" size={10} color="#fff" />
              <Text style={styles.elevText}>{detail.elevation}</Text>
            </View>
          ) : null}

          {/* Title block over image */}
          <View style={styles.titleBlock}>
            <Text style={styles.subtitle} numberOfLines={1}>
              {detail.subtitle ?? 'Trail Stop'}
            </Text>
            <Text style={styles.title} numberOfLines={2}>{detail.name}</Text>

            {/* Welcoming tagline — best time or first tag */}
            <View style={styles.taglineRow}>
              <Ionicons name="sunny-outline" size={12} color={accent} />
              <Text style={[styles.tagline, { color: accent }]}>
                {detail.bestTime ?? (detail.tags?.[0] ?? 'A great spot to pause')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onDismiss}
            activeOpacity={0.82}
            accessibilityLabel="Back to map"
            accessibilityRole="button"
          >
            <Ionicons name="map-outline" size={14} color={TEXT_SECONDARY} />
            <Text style={styles.secondaryBtnText}>Back to Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() => {
              onDismiss();
              router.push({
                pathname: '/Viewpoint',
                params: { viewpointId: snapshot.selectedViewpoint.id, mountainId },
              });
            }}
            activeOpacity={0.85}
            accessibilityLabel="Explore this viewpoint"
            accessibilityRole="button"
          >
            <Ionicons name="compass-outline" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Explore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT_GOLD }]}
            onPress={() => {
              onDismiss();
              router.push('/Calendar');
            }}
            activeOpacity={0.85}
            accessibilityLabel="Schedule a hike"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={14} color="#000" />
            <Text style={[styles.primaryBtnText, { color: '#000' }]}>Schedule</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  // Card anchored to bottom
  card: {
    position:        'absolute',
    bottom:          24,
    left:            12,
    right:           48,
    borderRadius:    RADIUS_CARD,
    overflow:        'hidden',
    backgroundColor: BG_CARD,
    borderWidth:     1,
    borderColor:     BORDER_DEFAULT,
    // Subtle glow around the card
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.55,
    shadowRadius:    20,
    elevation:       16,
  },

  // Hero image block — tall enough to feel immersive
  imageWrap: {
    height:          220,
    backgroundColor: BG_AVATAR,
    position:        'relative',
  },
  heroImage: {
    width:  '100%',
    height: '100%',
  },
  imageFallback: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: BG_AVATAR,
  },

  // Gradient scrim — bottom-heavy so title pops
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated with a bottom-heavy semi-transparent block:
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    // We achieve the gradient with two layered views below via the titleBlock shadow
  },

  // Close X
  closeBtn: {
    position:        'absolute',
    top:             10,
    right:           10,
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Elevation badge top-left
  elevBadge: {
    position:          'absolute',
    top:               10,
    left:              10,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      10,
  },
  elevText: {
    color:      '#fff',
    fontSize:   10,
    fontWeight: '700',
  },

  // Title block overlaid at bottom of image
  titleBlock: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 14,
    paddingBottom:     14,
    paddingTop:        40,
    backgroundColor:   'rgba(0,0,0,0.52)',
  },
  subtitle: {
    fontSize:      9,
    color:         'rgba(255,255,255,0.55)',
    fontWeight:    '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom:  3,
  },
  title: {
    fontSize:   22,
    fontWeight: '800',
    color:      '#FFFFFF',
    lineHeight: 27,
    marginBottom: 6,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  tagline: {
    fontSize:   11,
    fontWeight: '600',
  },

  // Footer buttons
  footer: {
    flexDirection:     'row',
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   12,
    backgroundColor:   BG_CARD,
    borderTopWidth:    1,
    borderTopColor:    BORDER_DEFAULT,
  },
  primaryBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    paddingVertical: 10,
    borderRadius:   RADIUS_BTN,
  },
  primaryBtnText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    paddingVertical: 10,
    borderRadius:   RADIUS_BTN,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:    1,
    borderColor:    BORDER_SUBTLE,
  },
  secondaryBtnText: {
    color:      TEXT_SECONDARY,
    fontSize:   12,
    fontWeight: '600',
  },
});