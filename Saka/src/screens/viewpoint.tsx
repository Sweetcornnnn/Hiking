/**
 * Viewpoint screen for a single trail stop.
 *
 * Layout: a left-side media rail and a right-side info panel. The screen reads a
 * viewpoint record from Supabase, with a static fallback for old data structures.
 *
 * LEFT RAIL (35% width): media items render as a stack of rounded cards.
 * The current card sits at full size/opacity; the next and previous cards
 * peek in slightly at the top/bottom edges and are scaled down + faded,
 * giving a "flipping through a stack" feel as you scroll up/down.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Dimensions,
  StatusBar,
  Image,
  ImageSourcePropType,
  ViewToken,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchViewpointDetail } from '../services/viewpointService';
import SakagramSection from '../components/sakagram/SakagramSection';
import LoadingScreen from './Loading';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LEFT_COLUMN_WIDTH = SCREEN_WIDTH * 0.35;
const RIGHT_COLUMN_WIDTH = SCREEN_WIDTH - LEFT_COLUMN_WIDTH;

// ── Sakagram focus mode ───────────────────────────────────────────────────
// When the Sakagram section scrolls into view, the media rail slides out to the
// left, the info panel widens to the full screen, and the feed grows into a
// centered, larger column so it's the only thing to focus on.
const FOCUS_MS = 700;                      // slide / widen duration (slow + gentle)
const FOCUS_EASING = Easing.inOut(Easing.cubic); // soft start, soft landing
const FOCUS_COOLDOWN_MS = FOCUS_MS + 500;   // ignore focus toggles while settling
const FOCUS_ENTER_VISIBLE = .01;           // fraction of viewport showing Sakagram to enter
const FOCUS_EXIT_VISIBLE = 0;             // scrolling up past this leaves focus mode
const SAKAGRAM_FOCUSED_WIDTH = Math.min(SCREEN_WIDTH - 32, 560); // Instagram-like centered feed
const SAKAGRAM_CONTENT_FADE_MS = 600;

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

// ── Mt. Madja-as viewpoint image map ───────────────────────────────────────
const IMAGE_MAP: Record<string, ImageSourcePropType> = {
  v1:  require('../../assets/Viewpoints/mt-madjaas/v1-barangay-flores-trailhead/TrailHead.jpg'),
  v2:  require('../../assets/Viewpoints/mt-madjaas/v2-first-water-source/Waterfalss.jpg'),
  v3:  require('../../assets/Viewpoints/mt-madjaas/v3-camp-1-mamay-camp/Camp1.png'),
  v4:  require('../../assets/Viewpoints/mt-madjaas/v4-ridge-trail-section/CrownShines.png'),
  v5:  require('../../assets/Viewpoints/mt-madjaas/v5-lake-viewpoint/Waterfalss.jpg'),
  v6:  require('../../assets/Viewpoints/mt-madjaas/v6-camp-2-upper-camp/Camp1.jpg'),
  v7:  require('../../assets/Viewpoints/mt-madjaas/v7-hidden-spring/Waterfalss.jpg'),
  v8:  require('../../assets/Viewpoints/mt-madjaas/v8-grassy-meadow/MossyForest.jpg'),
  v9:  require('../../assets/Viewpoints/mt-madjaas/v9-mt-madjaas-summit/Summit.png'),
  v10: require('../../assets/Viewpoints/mt-madjaas/v10-summit-ridge/SummitRidge.jpg'),
};

interface StatChipProps {
  icon: string;
  label: string;
  value: string;
}

interface MediaItem {
  type: 'image' | 'video';
  key?: string;   // local viewpoint ID in IMAGE_MAP (images only)
  uri?: string;   // remote source (images or videos)
}

export default function ViewpointScreen() {
  const router      = useRouter();
  const params      = useLocalSearchParams();
  const viewpointId = params.viewpointId as string | undefined;
  const mountainId  = params.mountainId as string | undefined;

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingScreenComplete, setLoadingScreenComplete] = React.useState(false);
  const [activeImageReady, setActiveImageReady] = React.useState(false);
  const [imageModalVisible, setImageModalVisible] = React.useState(false);
  const [modalMedia, setModalMedia] = React.useState<MediaItem | null>(null);

  // Sakagram focus mode (0 = normal split layout, 1 = Sakagram fills the screen)
  const [sakagramFocused, setSakagramFocused] = React.useState(false);
  // Type size inside Sakagram swaps mid-transition, hidden by a brief fade dip.
  const [sakagramSized, setSakagramSized] = React.useState(false);
  const contentFade = React.useRef(new Animated.Value(1)).current;
  const focusAnim = React.useRef(new Animated.Value(0)).current;
  const sakagramY = React.useRef(0);
  const lastScrollY = React.useRef(0);
  const focusedRef = React.useRef(false);
  const lastToggleAt = React.useRef(0);

  React.useEffect(() => {
    return () => {
      focusAnim.stopAnimation();
      contentFade.stopAnimation();
    };
  }, [focusAnim, contentFade]);

  const setFocus = React.useCallback((next: boolean) => {
    if (focusedRef.current === next) {
      return;
    }
    focusedRef.current = next;
    lastToggleAt.current = Date.now();
    setSakagramFocused(next);

    // Hide Sakagram before changing its layout, then reveal it after the resize.
    Animated.timing(contentFade, {
      toValue: 0,
      duration: SAKAGRAM_CONTENT_FADE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setSakagramSized(next);

      Animated.timing(focusAnim, {
        toValue: next ? 1 : 0,
        duration: FOCUS_MS,
        easing: FOCUS_EASING,
        useNativeDriver: false,
      }).start(({ finished: layoutFinished }) => {
        if (!layoutFinished) {
          return;
        }
        Animated.timing(contentFade, {
          toValue: 1,
          duration: SAKAGRAM_CONTENT_FADE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
    });
  }, [focusAnim, contentFade]);

  const handleRightScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const viewportH = e.nativeEvent.layoutMeasurement.height;
    const goingDown = y > lastScrollY.current;
    lastScrollY.current = y;

    if (sakagramY.current <= 0) {
      return;
    }
    // Layout changes while animating shift the offsets; wait until it settles.
    if (Date.now() - lastToggleAt.current < FOCUS_COOLDOWN_MS) {
      return;
    }

    // How much of the viewport Sakagram currently occupies (0..1+).
    const visible = (y + viewportH - sakagramY.current) / viewportH;
    if (!focusedRef.current && goingDown && visible > FOCUS_ENTER_VISIBLE) {
      setFocus(true);
    } else if (focusedRef.current && !goingDown && visible < FOCUS_EXIT_VISIBLE) {
      setFocus(false);
    }
  };

  const exitFocus = () => {
    setFocus(false);
  };

  React.useEffect(() => {
    let active = true;

    const loadViewpoint = async () => {
      setLoading(true);
      setData(null);
      setLoadingScreenComplete(false);
      setActiveImageReady(false);

      try {
        const selectedId = viewpointId || 'v1';
        const nextData = await fetchViewpointDetail(selectedId);
        if (active) {
          setData(nextData);
        }
      } catch (error) {
        console.warn('[ViewpointScreen] Failed to load data from Supabase', error);
        if (active) {
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadViewpoint();

    return () => {
      active = false;
    };
  }, [viewpointId]);

  const mediaList: MediaItem[] = React.useMemo(() => {
    if (data?.media && Array.isArray(data.media) && data.media.length > 0) {
      return data.media as MediaItem[];
    }
    if (data?.imageKey) {
      // The image assets are organized by viewpoint, so use its ID rather than
      // the shared image_key value to resolve the local asset.
      return Array.from({ length: 6 }, () => ({ type: 'image' as const, key: data.id }));
    }
    return [];
  }, [data]);
  const firstMedia = mediaList[0];
  const waitsForFirstImage = Boolean(
    firstMedia?.type === 'image' &&
    (firstMedia.key ? IMAGE_MAP[firstMedia.key] : firstMedia.uri)
  );
  const markActiveImageReady = React.useCallback(() => {
    setActiveImageReady(true);
  }, []);

  const openMediaModal = (item: MediaItem) => {
    setModalMedia(item);
    setImageModalVisible(true);
  };

  const modalDimensions = getModalDimensions(modalMedia);
  const modalImageSource = modalMedia?.type === 'image'
    ? (modalMedia.key ? IMAGE_MAP[modalMedia.key] : modalMedia.uri ? { uri: modalMedia.uri } : null)
    : null;

  if (loading || (!data && !loadingScreenComplete)) {
    return (
      <LoadingScreen
        ready={!loading}
        loadingDuration={1000}
        onComplete={() => setLoadingScreenComplete(true)}
      />
    );
  }

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.bodyRow}>
        {/* ── LEFT: card-stack media carousel (~35%) ──────────────────── */}
        <Animated.View
          pointerEvents={sakagramFocused ? 'none' : 'auto'}
          style={[
            styles.leftColumn,
            {
              opacity: focusAnim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 0.55, 0],
              }),
              transform: [{
                translateX: focusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -LEFT_COLUMN_WIDTH],
                }),
              }],
            },
          ]}
        >
          <VerticalMediaCarousel
            media={mediaList}
            height={SCREEN_HEIGHT}
            fallbackLabel={data.name}
            onPressImage={openMediaModal}
            onActiveImageReady={markActiveImageReady}
          />

          <TouchableOpacity onPress={() => router.back()} style={styles.mapBackBtn}>
            <Ionicons name="map-outline" size={17} color={PC.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── RIGHT: compact info panel (~65%), own scroll ────────────── */}
        <Animated.View
          style={[
            styles.rightWrap,
            {
              marginLeft: focusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [LEFT_COLUMN_WIDTH, 0],
              }),
            },
          ]}
        >
        <ScrollView
          style={styles.rightColumn}
          contentContainerStyle={styles.rightColumnContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleRightScroll}
          scrollEventThrottle={16}
        >
          {/* Header card — title, elevation, stats, tags all in one place */}
          <View style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subtitleText} numberOfLines={1}>{data.subtitle}</Text>
                <Text style={styles.titleText} numberOfLines={2}>{data.name}</Text>
              </View>
              <View style={styles.elevBadge}>
                <Ionicons name="trending-up-outline" size={10} color={PC.bgCard} />
                <Text style={styles.elevText}>{data.elevation}</Text>
              </View>
            </View>

            <View style={styles.statsGridInline}>
              <StatChip icon="walk-outline" label="Distance" value={data.distanceFromStart} />
              <StatChip icon="time-outline" label="Est. hike" value={data.estimatedHike} />
              <StatChip icon="trending-up-outline" label="Elevation" value={data.elevation ?? '—'} />
              <StatChip icon="sunny-outline" label="Best time" value={data.bestTime.split(' ')[0]} />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsScrollInline}
              contentContainerStyle={styles.tagsContent}
            >
              {data.tags.map((tag: string) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Overview card — about + best time + difficulty/status/crowd */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelAccent} />
              <Text style={styles.panelTitle}>About this Stop</Text>
            </View>
            <Text style={styles.description}>{data.description}</Text>

            <View style={styles.innerDivider} />

            <View style={styles.bestTimeInline}>
              <Ionicons name="alarm-outline" size={13} color={PC.gold} />
              <Text style={styles.bestTimeInlineText}>{data.bestTime}</Text>
            </View>

            <View style={styles.innerDivider} />

            <View style={styles.difficultyRowInline}>
              <View style={styles.difficultyChip}>
                <Ionicons name="flag-outline" size={12} color={PC.gold} />
                <Text style={styles.difficultyLabel}>Difficulty</Text>
                <Text style={styles.difficultyValue}>{data.difficulty ?? 'Moderate'}</Text>
              </View>
              <View style={styles.statDividerV} />
              <View style={styles.difficultyChip}>
                <Ionicons name="shield-checkmark-outline" size={12} color={PC.green} />
                <Text style={styles.difficultyLabel}>Status</Text>
                <Text style={[styles.difficultyValue, { color: PC.green }]}>{data.trailStatus ?? 'Open'}</Text>
              </View>
              <View style={styles.statDividerV} />
              <View style={styles.difficultyChip}>
                <Ionicons name="people-outline" size={12} color={PC.textMuted} />
                <Text style={styles.difficultyLabel}>Crowd</Text>
                <Text style={styles.difficultyValue}>{data.crowdLevel ?? 'Low'}</Text>
              </View>
            </View>
          </View>

          {/* Trail info card — features + trail notes */}
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
                    i === data.features.length - 1 && !data.trailNotes?.length && styles.featureRowLast,
                  ]}
                >
                  <View style={[
                    styles.featureIcon,
                    { backgroundColor: f.safe ? 'rgba(111,175,138,0.12)' : PC.bgDangerSubtle },
                  ]}>
                    <Ionicons
                      name={f.icon as any}
                      size={12}
                      color={f.safe ? PC.green : PC.danger}
                    />
                  </View>
                  <Text style={[styles.featureText, !f.safe && { color: PC.danger }]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>

            {data.trailNotes && data.trailNotes.length > 0 && (
              <>
                <View style={styles.innerDivider} />
                <View style={styles.panelHeader}>
                  <View style={styles.panelAccent} />
                  <Text style={styles.panelTitle}>Trail Notes</Text>
                </View>
                {data.trailNotes.map((note: string, i: number) => (
                  <View key={i} style={styles.noteRow}>
                    <Ionicons name="chevron-forward-outline" size={11} color={PC.gold} style={{ marginTop: 2 }} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {/* Actions — compact side-by-side row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!mountainId) {
                  return;
                }
                router.push({
                  pathname: '/Calendar',
                  params: { mountainId },
                });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={14} color={PC.bgCard} />
              <Text style={styles.primaryBtnText}>Schedule Hike</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Ionicons name="map-outline" size={14} color={PC.textSecondary} />
              <Text style={styles.secondaryBtnText}>Back to Map</Text>
            </TouchableOpacity>
          </View>

          {/* Sakagram grows into a larger, centered column in focus mode */}
          <Animated.View
            onLayout={(e) => { sakagramY.current = e.nativeEvent.layout.y; }}
            style={{
              alignSelf: 'center',
              width: focusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [RIGHT_COLUMN_WIDTH, SAKAGRAM_FOCUSED_WIDTH],
              }),
            }}
          >
            <Animated.View style={{ opacity: contentFade }}>
              <SakagramSection
                viewpointId={data.id}
                viewpointName={data.name}
                mountainId={mountainId}
                focused={sakagramSized}
              />
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Floating controls: the media rail (and its map button) are gone in focus mode */}
        <Animated.View
          pointerEvents={sakagramFocused ? 'box-none' : 'none'}
          style={[
            styles.focusBar,
            {
              opacity: focusAnim,
              transform: [{
                translateY: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.focusBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to map"
          >
            <Ionicons name="map-outline" size={16} color={PC.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exitFocus}
            style={styles.focusBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to viewpoint details"
          >
            <Ionicons name="chevron-up" size={15} color={PC.textSecondary} />
            <Text style={styles.focusBtnText}>Details</Text>
          </TouchableOpacity>
        </Animated.View>
        </Animated.View>
      </View>

      {/* ── Full-screen media modal (images + videos) ───────────────────── */}
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
                  styles.imageModalShadowWrap,
                  { width: modalDimensions.width, height: modalDimensions.height },
                ]}
              >
                <View style={styles.imageModalCard}>
                  {modalMedia?.type === 'video' ? (
                    <View style={styles.imageModalPlaceholder}>
                      <Ionicons name="videocam-outline" size={28} color={PC.gold} />
                      <Text style={styles.imageModalPlaceholderText}>Video unavailable</Text>
                    </View>
                  ) : modalImageSource ? (
                    <Image source={modalImageSource} style={styles.imageModalImage} resizeMode="cover" />
                  ) : null}
                  <TouchableOpacity
                    style={styles.imageModalClose}
                    onPress={() => setImageModalVisible(false)}
                    accessibilityLabel="Close media viewer"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={18} color={PC.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {!loadingScreenComplete && (
        <View style={StyleSheet.absoluteFillObject}>
          <LoadingScreen
            ready={!loading && (!waitsForFirstImage || activeImageReady)}
            loadingDuration={1000}
            onComplete={() => setLoadingScreenComplete(true)}
          />
        </View>
      )}
    </View>
  );
}

// ── Modal sizing helper ─────────────────────────────────────────────────────
function getModalDimensions(item: MediaItem | null): { width: number; height: number } {
  if (!item) {
    return { width: SCREEN_WIDTH * 0.92, height: SCREEN_HEIGHT * 0.72 };
  }

  // Local bundled image: we know its real dimensions synchronously.
  if (item.type === 'image' && item.key && IMAGE_MAP[item.key]) {
    const src = Image.resolveAssetSource(IMAGE_MAP[item.key]);
    const ratio = src.width / src.height;
    const w = Math.min(SCREEN_WIDTH * 0.92, src.width);
    const h = Math.min(SCREEN_HEIGHT * 0.84, w / ratio);
    return { width: w, height: h };
  }

  // Remote image or video: dimensions aren't known up front, assume 16:9.
  const w = SCREEN_WIDTH * 0.92;
  const h = Math.min(SCREEN_HEIGHT * 0.7, w * (9 / 16));
  return { width: w, height: h };
}

// ── Card-stack vertical carousel (left column) ──────────────────────────────
// Cards render one after another; the focused card is full scale/opacity while
// the next/previous cards peek in at the edges, scaled down and faded, so the
// whole rail reads as a stack you flip through rather than a flat slideshow.
const CARD_HEIGHT_RATIO = 0.5; // each card is ~half the column height
const CARD_GAP = -10;            // vertical gap between cards
const CARD_INSET = 10;          // horizontal margin so cards don't touch the column edges

// Keep one copy on each side of the starting copy. When scrolling reaches an
// outer copy, recenter on the matching item in the middle copy without animation.
const LOOP_REPEATS = 3;

function VerticalMediaCarousel({
  media,
  height,
  fallbackLabel,
  onPressImage,
  onActiveImageReady,
}: {
  media: MediaItem[];
  height: number;
  fallbackLabel?: string;
  onPressImage: (item: MediaItem) => void;
  onActiveImageReady: () => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const listRef = React.useRef<any>(null);

  const CARD_HEIGHT = height * CARD_HEIGHT_RATIO;
  const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;
  // Padding top/bottom equal to half the leftover space centers the resting
  // card vertically in the column instead of snapping it to the top.
  const VERTICAL_PADDING = (height - CARD_HEIGHT) / 2;

  const loopedMedia = React.useMemo(() => {
    if (media.length === 0) return [];
    return Array.from({ length: media.length * LOOP_REPEATS }, (_, i) => media[i % media.length]);
  }, [media]);
  const middleRepeatStart = media.length * Math.floor(LOOP_REPEATS / 2);
  const edgeBuffer = media.length;

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleMomentumScrollEnd = (e: any) => {
    if (media.length === 0) return;
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    if (index < edgeBuffer || index >= loopedMedia.length - edgeBuffer) {
      const positionInLoop = ((index % media.length) + media.length) % media.length;
      const recenteredIndex = middleRepeatStart + positionInLoop;
      listRef.current?.scrollToOffset({ offset: recenteredIndex * ITEM_HEIGHT, animated: false });
    }
  };

  if (media.length === 0) {
    return (
      <View style={[styles.emptyMediaState, { height }]}>
        <Ionicons name="image-outline" size={28} color={PC.gold} />
        {fallbackLabel ? (
          <Text style={styles.heroPlaceholderText} numberOfLines={2}>{fallbackLabel}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ height, width: '100%' }}>
      <Animated.FlatList
        ref={listRef}
        data={loopedMedia}
        keyExtractor={(_, i) => `media-${i}`}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        initialScrollIndex={middleRepeatStart}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingTop: VERTICAL_PADDING,
          paddingBottom: VERTICAL_PADDING,
          paddingHorizontal: CARD_INSET,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
          ];
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.72, 1, 0.72],
            extrapolate: 'clamp',
          });
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={{
                height: CARD_HEIGHT,
                marginBottom: CARD_GAP,
                transform: [{ scale }],
                opacity,
              }}
            >
              <MediaCard
                item={item}
                isActive={index === activeIndex}
                onPress={() => onPressImage(item)}
                onActiveImageReady={onActiveImageReady}
              />
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

function MediaCard({
  item,
  isActive,
  onPress,
  onActiveImageReady,
}: {
  item: MediaItem;
  isActive: boolean;
  onPress: () => void;
  onActiveImageReady: () => void;
}) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageSource = item.key
    ? IMAGE_MAP[item.key]
    : item.type === 'image' && item.uri
      ? { uri: item.uri }
      : undefined;

  React.useEffect(() => {
    if (isActive && (imageLoaded || imageFailed)) {
      onActiveImageReady();
    }
  }, [isActive, imageLoaded, imageFailed, onActiveImageReady]);

  return (
    <View style={styles.cardShadowWrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.card}
      >
        {item.type === 'video' ? (
          <View style={styles.cardMediaFill}>
            <Ionicons name="videocam-outline" size={24} color={PC.gold} />
            <Text style={styles.heroPlaceholderText}>Video</Text>
          </View>
        ) : imageSource ? (
          <>
            {!imageLoaded && (
              <View style={[styles.cardMediaFill, StyleSheet.absoluteFillObject]}>
                <Ionicons
                  name={imageFailed ? 'alert-circle-outline' : 'image-outline'}
                  size={24}
                  color={PC.gold}
                />
                {imageFailed && (
                  <Text style={styles.heroPlaceholderText}>Image unavailable</Text>
                )}
              </View>
            )}
            {!imageFailed && (
              <Image
                source={imageSource}
                style={[styles.cardImage, !imageLoaded && styles.hiddenCardImage]}
                resizeMode="cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageFailed(true)}
              />
            )}
          </>
        ) : (
          <View style={styles.cardMediaFill}>
            <Ionicons name="image-outline" size={24} color={PC.gold} />
          </View>
        )}

        {item.type === 'video' && (
          <View style={styles.mediaTypeTag}>
            <Ionicons name="videocam" size={11} color={PC.bgCard} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────
function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon as any} size={14} color={PC.gold} />
      <Text style={styles.statChipLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.statChipValue} numberOfLines={1}>{value}</Text>
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

  // ── Split layout ─────────────────────────────────────────────────────────
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },

  // LEFT — card-stack carousel column (~35%)
  leftColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LEFT_COLUMN_WIDTH,
    height: '100%',
    backgroundColor: PC.bgCard,
    zIndex: 2,
    elevation: 2,
  },
  mapBackBtn: {
    position: 'absolute',
    top: 22,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: PC.radiusBtn,
    backgroundColor: 'rgba(14,21,32,0.78)',
    borderWidth: 1,
    borderColor: PC.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  emptyMediaState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: PC.bgAvatar,
  },
  heroPlaceholderText: {
    fontSize: 11,
    fontWeight: '700',
    color: PC.gold,
    textAlign: 'center',
  },

  // Card stack — one item
  cardShadowWrap: {
    flex: 1,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PC.border,
    backgroundColor: PC.bgAvatar,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  hiddenCardImage: {
    opacity: 0,
  },
  cardMediaFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PC.bgAvatar,
  },

  mediaTypeTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PC.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // RIGHT — compact info column (~65%)
  rightWrap: {
    flex: 1,
    zIndex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  focusBar: {
    position: 'absolute',
    top: 22,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  focusBtn: {
    height: 32,
    minWidth: 32,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: PC.radiusBtn,
    backgroundColor: 'rgba(14,21,32,0.85)',
    borderWidth: 1,
    borderColor: PC.border,
  },
  focusBtnText: {
    color: PC.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  rightColumnContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Header card — title, elevation badge, stats, tags combined
  headerCard: {
    marginHorizontal: 12,
    marginTop: 0,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.border,
    padding: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  subtitleText: {
    fontSize: 9,
    color: PC.textFaint,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: PC.textPrimary,
    lineHeight: 22,
  },
  elevBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.gold,
  },
  elevText: {
    color: PC.bgCard,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Stats — compact 2x2 grid, nested inside headerCard ──────────────────
  statsGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PC.border,
  },
  statChip: {
    width: '50%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  statChipLabel: {
    fontSize: 8,
    color: PC.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statChipValue: {
    fontSize: 10,
    color: PC.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Tags ───────────────────────────────────────────────────────────────
  tagsScrollInline: { marginTop: 8 },
  tagsContent: { gap: 5, paddingRight: 4 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.borderGold,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: PC.gold,
  },

  // ── Panel — ProfileCard leftPanel style ────────────────────────────────
  panel: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.border,
    padding: 12,
  },
  innerDivider: {
    height: 1,
    backgroundColor: PC.border,
    marginVertical: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  panelAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: PC.gold,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: PC.textPrimary,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 12,
    color: PC.textSecondary,
    lineHeight: 19,
  },

  // ── Best time — inline row inside overview panel ─────────────────────────
  bestTimeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestTimeInlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: PC.gold,
    flex: 1,
  },

  // ── Features ─────────────────────────────────────────────────────────────
  featuresList: { gap: 0 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
  },
  featureRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    fontSize: 11,
    color: PC.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // ── Actions — compact side-by-side row ───────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.gold,
  },
  primaryBtnText: {
    color: PC.bgCard,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgSubtle,
    borderWidth: 1,
    borderColor: PC.borderSubtle,
  },
  secondaryBtnText: {
    color: PC.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Trail Notes ────────────────────────────────────────────────────────
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  noteText: {
    fontSize: 11,
    color: PC.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // ── Difficulty / Status / Crowd row — inline inside overview panel ──────
  difficultyRowInline: {
    flexDirection: 'row',
    gap: 6,
  },
  difficultyChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  difficultyLabel: {
    fontSize: 8,
    color: PC.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  difficultyValue: {
    fontSize: 10,
    color: PC.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  statDividerV: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: PC.borderSubtle,
  },

  // ── Media modal ──────────────────────────────────────────────────────────
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  imageModalShadowWrap: {
    borderRadius: PC.radius,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  imageModalCard: {
    flex: 1,
    backgroundColor: PC.bgCard,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.gold,
    overflow: 'hidden',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  imageModalPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PC.bgPanel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PC.borderGold,
    gap: 10,
  },
  imageModalPlaceholderText: {
    color: PC.textSecondary,
    fontSize: 12,
    fontWeight: '600',
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
});