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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LEFT_COLUMN_WIDTH = SCREEN_WIDTH * 0.35;
const RIGHT_COLUMN_WIDTH = SCREEN_WIDTH - LEFT_COLUMN_WIDTH;

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
  camp1:         require('../../assets/images/Camp1.png'),
  waterfall:     require('../../assets/images/Waterfalss.jpg'),
  mossy_forest:  require('../../assets/images/MossyForest.jpg'),
  camp2:         require('../../assets/images/Camp1.jpg'),
  camp3:         require('../../assets/images/Camp2$3.jpg'),
  crown_shyness: require('../../assets/images/CrownShines.png'),
  summit_ridge:  require('../../assets/images/SummitRidge.jpg'),
  summit:        require('../../assets/images/Summit.png'),
};

interface StatChipProps {
  icon: string;
  label: string;
  value: string;
}

interface MediaItem {
  type: 'image' | 'video';
  key?: string;   // local IMAGE_MAP key (images only)
  uri?: string;   // remote source (images or videos)
}

export default function ViewpointScreen() {
  const router      = useRouter();
  const params      = useLocalSearchParams();
  const viewpointId = params.viewpointId as string | undefined;
  const mountainId  = params.mountainId as string | undefined;

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [imageModalVisible, setImageModalVisible] = React.useState(false);
  const [modalMedia, setModalMedia] = React.useState<MediaItem | null>(null);

  React.useEffect(() => {
    let active = true;

    const loadViewpoint = async () => {
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
      // TEMP / DEMO: the backend only gives us one imageKey per viewpoint right
      // now, so we repeat it to populate the stack and preview the carousel
      // effect. Once fetchViewpointDetail returns a real `media` array, this
      // fallback (and the repetition) can be removed.
      return Array.from({ length: 6 }, () => ({ type: 'image' as const, key: data.imageKey }));
    }
    return [];
  }, [data]);

  const openMediaModal = (item: MediaItem) => {
    setModalMedia(item);
    setImageModalVisible(true);
  };

  const modalDimensions = getModalDimensions(modalMedia);
  const modalImageSource = modalMedia?.type === 'image'
    ? (modalMedia.key ? IMAGE_MAP[modalMedia.key] : modalMedia.uri ? { uri: modalMedia.uri } : null)
    : null;

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="trail-sign-outline" size={32} color={PC.gold} />
        </View>
        <Text style={styles.errorTitle}>Loading viewpoint…</Text>
        <Text style={styles.errorSub}>Fetching trail details from Supabase.</Text>
      </View>
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
        <View style={styles.leftColumn}>
          <VerticalMediaCarousel
            media={mediaList}
            height={SCREEN_HEIGHT}
            fallbackLabel={data.name}
            onPressImage={openMediaModal}
          />

          <TouchableOpacity onPress={() => router.back()} style={styles.mapBackBtn}>
            <Ionicons name="map-outline" size={17} color={PC.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── RIGHT: compact info panel (~65%), own scroll ────────────── */}
        <ScrollView
          style={styles.rightColumn}
          contentContainerStyle={styles.rightColumnContent}
          showsVerticalScrollIndicator={false}
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
        </ScrollView>
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

// The carousel loops by repeating the media list many times and starting the
// scroll position in the middle repeat. As the user nears either end, we jump
// back to the equivalent position in the middle repeat with animated:false,
// which is imperceptible since the underlying image at that position is the
// same. This is a "long enough to feel infinite" loop rather than a true
// infinite list, which keeps things simple without a native infinite-scroll lib.
const LOOP_REPEATS = 25;

function VerticalMediaCarousel({
  media,
  height,
  fallbackLabel,
  onPressImage,
}: {
  media: MediaItem[];
  height: number;
  fallbackLabel?: string;
  onPressImage: (item: MediaItem) => void;
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
  const edgeBuffer = media.length * 2;

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
    if (index < edgeBuffer || index > loopedMedia.length - edgeBuffer) {
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
}: {
  item: MediaItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const imageSource = item.key
    ? IMAGE_MAP[item.key]
    : item.type === 'image' && item.uri
      ? { uri: item.uri }
      : undefined;

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
          <Image source={imageSource} style={styles.cardImage} resizeMode="cover" />
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
  },

  // LEFT — card-stack carousel column (~35%)
  leftColumn: {
    width: LEFT_COLUMN_WIDTH,
    height: '100%',
    backgroundColor: PC.bgCard,
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
  rightColumn: {
    width: RIGHT_COLUMN_WIDTH,
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