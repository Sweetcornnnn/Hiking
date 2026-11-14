import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  ACCENT_GREEN,
} from '../../theme/designTokens';
import { FULLSCREEN_MODAL_PROPS } from '../ModalScrim';
import { SpeciesGallery } from './SpeciesGallery';
import { TaxonomyTree } from './TaxonomyTree';
import { ObservationTimeline } from './ObservationTimeline';
import { useSpeciesDetails } from '../../hooks/useSpeciesDetails';
import { useOccurrenceData } from '../../hooks/useOccurrenceData';

/**
 * Extra sections the profile can show BELOW the image/description hero.
 * Leave `detailSections` empty (the default) for the plain profile. Pass some
 * of these for screens that need them (e.g. species search).
 */
export type SpeciesDetailSection =
  | 'gallery'
  | 'quickFacts'
  | 'timeline'
  | 'taxonomy';

export interface SpeciesCardProps {
  species: any;
  /**
   * @deprecated The view that opens when the card is pressed IS the profile
   * (it loads its own details), so this is never called. Kept optional so
   * existing usages don't break.
   */
  onPress?: () => void;
  isDiscovered?: boolean;
  showDiscoveryStatus?: boolean;
  /** Fired when the gold bookmark is pulled all the way down. */
  onDiscover?: () => void | boolean | Promise<void | boolean>;
  /** Fired when the green bookmark is pulled all the way down. */
  onUndiscover?: () => void | boolean | Promise<void | boolean>;
  /**
   * Extra sections shown below the profile hero. Default: none, which gives
   * the plain profile (WildTrack, Discovery). SpeciesSearch passes
   * ['gallery', 'timeline', 'taxonomy'].
   */
  detailSections?: SpeciesDetailSection[];
}

/**
 * HOW THIS WORKS
 * --------------
 * Grid card : the original design, unchanged.
 * Press it  : the profile opens.
 *
 * `detailSections` decides which profile you get:
 *   []  (default)  the compact profile above (image LEFT, description RIGHT,
 *                  bookmark). Used by WildTrack and Discovery.
 *   ['gallery','quickFacts','timeline','taxonomy']  a FULL-SCREEN profile
 *                  with the title header (back button, sticky title), the
 *                  gallery, quick facts + description, the observation
 *                  timeline and the taxonomy tree. Used by SpeciesSearch.
 *                  Only this one loads species details
 *                  (useSpeciesDetails + useOccurrenceData).
 *
 * BOOKMARK (compact profile only, shown only when showDiscoveryStatus is true):
 *   GOLD = undiscovered, GREEN = discovered. Pull it down: a confirmation card
 *   asks the question. Keep pulling to the end = yes, release early = no.
 */

const RIBBON_BASE = 56; // resting ribbon length
const RIBBON_PULL = 110; // extra length at a full pull (= "yes")
const GREEN = '#16A34A';
const RED = '#DC2626';

/* ------------------------------ no-info copy ------------------------------ */

type Kind =
  | 'bird'
  | 'mammal'
  | 'reptile'
  | 'amphibian'
  | 'fish'
  | 'insect'
  | 'arachnid'
  | 'plant'
  | 'fungus'
  | 'mollusk'
  | 'other';

const KIND_RULES: Array<[Kind, RegExp]> = [
  ['bird', /\b(aves|bird|owl|eagle|hawk|falcon|sparrow|finch|parrot|duck|heron|kingfisher|pigeon|dove|crow|raven|warbler|thrush|swallow|kite|egret|tern|gull|shrike|bulbul|myna)/],
  ['mammal', /\b(mammal|mammalia|bat|deer|monkey|macaque|cat|dog|boar|pig|squirrel|rat|mouse|civet|shrew|otter|dugong|whale|dolphin|carabao|buffalo)/],
  ['amphibian', /\b(amphib|frog|toad|salamander|newt|caecilian)/],
  ['reptile', /\b(reptil|squamata|snake|lizard|gecko|skink|turtle|tortoise|crocodile|monitor|serpent|python|cobra)/],
  ['fish', /\b(fish|actinopterygii|chondrichthyes|osteichthyes|shark|ray|eel|grouper|goby|tuna|wrasse)/],
  ['arachnid', /\b(arachnid|arachnida|spider|scorpion|mite|tick)/],
  ['insect', /\b(insect|insecta|lepidoptera|coleoptera|diptera|hymenoptera|odonata|butterfly|moth|beetle|dragonfly|bee|wasp|ant|fly|cricket|grasshopper|cicada|mantis)/],
  ['mollusk', /\b(mollus|gastropod|bivalve|snail|slug|clam|oyster|squid|octopus|cuttlefish|nudibranch)/],
  ['fungus', /\b(fung|mushroom|mold|mould|lichen|yeast)/],
  ['plant', /\b(plant|plantae|flower|tree|fern|palm|orchid|grass|shrub|vine|moss|herb|seagrass|mangrove)/],
];

const inferKind = (data: any): Kind => {
  const taxonomy = [
    data?.iconic_taxon_name,
    data?.category,
    data?.taxon_group,
    data?.group,
    data?.type,
    data?.kingdom,
    data?.phylum,
    data?.class,
    data?.class_name,
    data?.order,
    data?.family,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // taxonomy fields first, common name only as a fallback
  const name = String(data?.common_name ?? '').toLowerCase();
  for (const hay of [taxonomy, name]) {
    if (!hay) continue;
    for (const [kind, rule] of KIND_RULES) {
      if (rule.test(hay)) return kind;
    }
  }
  return 'other';
};

const KIND_NOUN: Record<Kind, string> = {
  bird: 'bird',
  mammal: 'mammal',
  reptile: 'reptile',
  amphibian: 'amphibian',
  fish: 'fish',
  insect: 'bug',
  arachnid: 'arachnid',
  plant: 'plant',
  fungus: 'fungus',
  mollusk: 'mollusk',
  other: 'species',
};

const KIND_SPECIAL: Record<Kind, string> = {
  bird: 'No info yet. This bird is keeping its song to itself.',
  mammal: 'No info yet, but this mammal is clearly a good one.',
  reptile: 'No info yet, but this reptile is cold-blooded cool.',
  amphibian: 'No info yet, but this one is a certified hopper.',
  fish: 'No info yet, but something smells fishy. In a good way.',
  insect: 'No info yet, but this bug has main-character energy.',
  arachnid: 'No info yet, but eight legs of pure charisma.',
  plant: 'No info yet, but this plant is rooting for you.',
  fungus: 'No info yet, but this fungus is a fun-guy anyway.',
  mollusk: 'No info yet, but this one is shell-ebrating anyway.',
  other: "No info yet, but this one's pretty cool anyway.",
};

const noInfoLine = (data: any, seed: string) => {
  const kind = inferKind(data);
  const n = KIND_NOUN[kind];
  const lines = [
    `There's no info yet, but at least this ${n} is cool.`,
    `Nothing written about this ${n} yet. Still looks like a legend.`,
    KIND_SPECIAL[kind],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return lines[Math.abs(h) % lines.length];
};

// gentle looping 0 -> 1 -> 0 value used for the "pull me" wiggle
const useWiggle = (value: Animated.Value, active: boolean) => {
  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(value, {
          toValue: 1,
          duration: 460,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 460,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      value.setValue(0);
    };
  }, [active, value]);
};

/* ========================================================================== */
/*  GRID CARD (original design)                                               */
/* ========================================================================== */

export const SpeciesCard: React.FC<SpeciesCardProps> = ({
  species,
  isDiscovered = false,
  showDiscoveryStatus = true,
  onDiscover,
  onUndiscover,
  detailSections,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [discovered, setDiscovered] = useState(isDiscovered);

  useEffect(() => {
    setDiscovered(isDiscovered);
  }, [isDiscovered]);

  const resolvedImage =
    typeof species?.image_url === 'number'
      ? Image.resolveAssetSource(species.image_url).uri
      : species?.image_url;

  const hasImage = !!resolvedImage && !imageError;

  const handleSetDiscovered = async (next: boolean): Promise<boolean> => {
    setDiscovered(next);
    try {
      const result = next ? await onDiscover?.() : await onUndiscover?.();
      if (result === false) setDiscovered(!next);
      return result !== false;
    } catch (error) {
      setDiscovered(!next);
      throw error;
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setDetailOpen(true)}
        android_ripple={{ color: '#1E293B' }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* IMAGE */}
        <View style={styles.imageContainer}>
          {hasImage ? (
            <>
              <Image
                source={{ uri: resolvedImage }}
                style={styles.image}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />

              {imageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="small" color={ACCENT_GOLD} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="leaf-outline" size={28} color="#64748B" />
            </View>
          )}

          {showDiscoveryStatus && discovered && (
            <View style={styles.topBadge}>
              <Ionicons name="checkmark-circle" size={11} color={ACCENT_GREEN} />
              <Text style={styles.topBadgeText} numberOfLines={1}>
                Discovered
              </Text>
            </View>
          )}
        </View>

        {/* CONTENT */}
        <View style={styles.content}>
          <Text style={styles.commonName} numberOfLines={1}>
            {species?.common_name || 'Unknown species'}
          </Text>

          {!!species?.scientific_name && (
            <Text style={styles.scientificName} numberOfLines={1}>
              {species.scientific_name}
            </Text>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.detailLink}>View profile</Text>
            <Ionicons name="arrow-forward" size={12} color={ACCENT_GOLD} />
          </View>
        </View>
      </Pressable>

      {detailOpen &&
        (detailSections && detailSections.length > 0 ? (
          <SpeciesFullProfile
            species={species}
            imageUri={resolvedImage}
            sections={detailSections}
            onClose={() => setDetailOpen(false)}
          />
        ) : (
          <SpeciesDetail
            species={species}
            imageUri={resolvedImage}
            discovered={discovered}
            showStatus={showDiscoveryStatus}
            onSetDiscovered={handleSetDiscovered}
            onClose={() => setDetailOpen(false)}
          />
        ))}
    </>
  );
};

/* ========================================================================== */
/*  PROFILE (opens when the card is pressed)                                  */
/* ========================================================================== */

interface SpeciesDetailProps {
  species: any;
  imageUri?: string;
  discovered: boolean;
  showStatus: boolean;
  onSetDiscovered: (next: boolean) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}

const SpeciesDetail: React.FC<SpeciesDetailProps> = ({
  species,
  imageUri,
  discovered,
  showStatus,
  onSetDiscovered,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 460);
  const promptWidth = Math.min(cardWidth - 64, 236); // never overflows
  const maxSheetHeight = height * 0.88;

  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [scrollLocked, setScrollLocked] = useState(false);
  const hasImage = !!imageUri && !imageError;

  const commonName = species?.common_name || 'Unknown species';
  const scientificName: string | undefined = species?.scientific_name;
  const apiDescription: string = String(
    species?.description || species?.summary || '',
  ).trim();
  const hasDescription = apiDescription.length > 0;
  const noInfoMode = !hasDescription;

  const descriptionText = useMemo(
    () =>
      hasDescription
        ? apiDescription
        : noInfoLine(species, `${commonName}${scientificName ?? ''}`),
    [hasDescription, apiDescription, species, commonName, scientificName],
  );

  // ---------------------------------------------------------------- animation
  // native-driven
  const entry = useRef(new Animated.Value(0)).current;
  const flashLight = useRef(new Animated.Value(0)).current;
  const flashDark = useRef(new Animated.Value(0)).current;
  const ribbonScale = useRef(new Animated.Value(1)).current;
  // JS-driven (they drive layout / colour props)
  const ribbonPull = useRef(new Animated.Value(0)).current; // 0..1, 1 = "yes"
  const ribbonHint = useRef(new Animated.Value(0)).current; // wiggle
  const tone = useRef(new Animated.Value(discovered ? 1 : 0)).current; // 0 gold,1 green,2 red,3 gold
  const promptVis = useRef(new Animated.Value(1)).current; // hides prompt on commit

  const busy = useRef(false);
  const committed = useRef(false);
  const requestPending = useRef(false);

  // latest props/callbacks, so gesture handlers never go stale
  const discoveredRef = useRef(discovered);
  discoveredRef.current = discovered;
  const setDiscoveredRef = useRef(onSetDiscovered);
  setDiscoveredRef.current = onSetDiscovered;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  useWiggle(ribbonHint, showStatus);

  // keep colour in sync if the parent changes the state from outside
  useEffect(() => {
    if (!busy.current) tone.setValue(discovered ? 1 : 0);
  }, [discovered, tone]);

  // ribbon eases (no bounce) whenever the state flips, not on first mount
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    ribbonScale.setValue(1.12);
    Animated.timing(ribbonScale, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [discovered, ribbonScale]);

  const dismiss = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(entry, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => closeRef.current());
  }, [entry]);

  // ---- bookmark: pull to the end = yes, release early = no ------------------
  const releaseRibbon = useCallback(() => {
    Animated.parallel([
      Animated.spring(ribbonPull, {
        toValue: 0,
        friction: 9,
        tension: 55,
        useNativeDriver: false,
      }),
      Animated.timing(tone, {
        toValue: discoveredRef.current ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [ribbonPull, tone]);

  const commitRibbon = useCallback(() => {
    if (committed.current) return;
    committed.current = true;
    busy.current = true;
    const wasDiscovered = discoveredRef.current;
    const nextDiscovered = !wasDiscovered;
    let animationFinished = false;
    let saveFinished = false;
    let saveFailed = false;
    requestPending.current = true;

    const rollbackTone = () => {
      tone.stopAnimation();
      tone.setValue(wasDiscovered ? 1 : 0);
      flashLight.stopAnimation();
      flashLight.setValue(0);
      flashDark.stopAnimation();
      flashDark.setValue(0);
    };

    const finishIfReady = () => {
      if (animationFinished) {
        committed.current = false;
        busy.current = false;
      }
      if (animationFinished && saveFinished) requestPending.current = false;
    };

    const finishSave = (saved: boolean) => {
      saveFinished = true;
      saveFailed = !saved;
      if (saveFailed && animationFinished) rollbackTone();
      finishIfReady();
    };

    Animated.timing(promptVis, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();

    Animated.timing(ribbonPull, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      try {
        void Promise.resolve(setDiscoveredRef.current(nextDiscovered)).then(
          (saved) => finishSave(saved !== false),
          (error) => {
            console.error('[SpeciesCard] Failed to update discovery:', error);
            finishSave(false);
          },
        );
      } catch (error) {
        console.error('[SpeciesCard] Failed to update discovery:', error);
        finishSave(false);
      }

      if (wasDiscovered) {
        // YES: remove the discovery. Red blends back to gold.
        Animated.timing(tone, {
          toValue: 3,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }).start(() => tone.setValue(0));
        flashDark.setValue(0.3);
        Animated.timing(flashDark, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      } else {
        // YES: mark as discovered. Gold blends into green.
        Animated.timing(tone, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }).start();
        flashLight.setValue(0.28);
        Animated.timing(flashLight, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }

      // ribbon glides back to its resting length
      Animated.timing(ribbonPull, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        promptVis.setValue(1);
        animationFinished = true;
        if (saveFailed) rollbackTone();
        finishIfReady();
      });
    });
  }, [ribbonPull, tone, promptVis, flashLight, flashDark]);

  const ribbonResponder = useMemo(() => {
    const canStart = () =>
      showStatus && !busy.current && !requestPending.current;

    return PanResponder.create({
      onStartShouldSetPanResponder: canStart,
      onMoveShouldSetPanResponder: canStart,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setScrollLocked(true); // the page must not scroll while pulling
        ribbonPull.stopAnimation();
        tone.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        if (committed.current) return;
        const p = Math.min(Math.max(g.dy / RIBBON_PULL, 0), 1);
        ribbonPull.setValue(p);
        // a discovered ribbon blends green -> red as the question appears
        if (discoveredRef.current) {
          tone.setValue(1 + Math.min(Math.max((p - 0.2) / 0.3, 0), 1));
        }
        if (p >= 0.98) commitRibbon(); // kept pulling to the end = yes
      },
      onPanResponderRelease: () => {
        setScrollLocked(false);
        if (!committed.current) releaseRibbon(); // released early = no
      },
      onPanResponderTerminate: () => {
        setScrollLocked(false);
        if (!committed.current) releaseRibbon();
      },
    });
  }, [showStatus, ribbonPull, tone, commitRibbon, releaseRibbon]);

  // ----------------------------------------------------------- derived values
  const ribbonWiggle = Animated.multiply(
    ribbonHint.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
    ribbonPull.interpolate({
      inputRange: [0, 0.15],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  );
  const ribbonH = Animated.add(
    ribbonPull.interpolate({
      inputRange: [0, 1],
      outputRange: [RIBBON_BASE, RIBBON_BASE + RIBBON_PULL],
    }),
    ribbonWiggle,
  );
  // handle is the ribbon plus a little slack (interpolate, so every arg is an Animated node)
  const ribbonHandleH = ribbonH.interpolate({
    inputRange: [0, 400],
    outputRange: [28, 428],
  });

  const ribbonColor = tone.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [ACCENT_GOLD, GREEN, RED, ACCENT_GOLD],
  });

  // icons blend with the same tone value, so nothing ever "pops"
  const restFactor = ribbonPull.interpolate({
    inputRange: [0.3, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const yesFactor = ribbonPull.interpolate({
    inputRange: [0.3, 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const goldPresence = tone.interpolate({
    inputRange: [0, 0.4, 2.6, 3],
    outputRange: [1, 0, 0, 1],
  });
  const iconBookmark = Animated.multiply(goldPresence, restFactor);
  const iconGoldCheck = Animated.multiply(goldPresence, yesFactor);
  const iconGreenCheck = tone.interpolate({
    inputRange: [0.4, 0.8, 1.2, 1.6],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const iconTrash = tone.interpolate({
    inputRange: [1.3, 1.7, 2.4, 2.8],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  // confirmation card: eases in beside the ribbon as you pull
  const promptOpacity = Animated.multiply(
    ribbonPull.interpolate({
      inputRange: [0.12, 0.3],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    promptVis,
  );
  const promptX = ribbonPull.interpolate({
    inputRange: [0.12, 0.34],
    outputRange: [-14, 0],
    extrapolate: 'clamp',
  });
  const progressWidth = ribbonPull.interpolate({
    inputRange: [0.3, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const theme = discovered ? themes.red : themes.gold;
  const question = discovered
    ? 'Remove this discovery?'
    : 'Did you discover this species?';

  // ------------------------------------------------------------------- render
  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlayRoot}>
        {/* backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: entry }]}>
          <Pressable style={styles.backdrop} onPress={dismiss} />
        </Animated.View>

        {/* wrapper (not clipped, so the prompt can sit over the card edge) */}
        <Animated.View
          style={{
            width: cardWidth,
            opacity: entry,
            transform: [
              {
                translateY: entry.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              },
              {
                scale: entry.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1],
                }),
              },
            ],
          }}
        >
          <View style={[styles.sheet, { maxHeight: maxSheetHeight }]}>
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={!scrollLocked}
            >
              {/* ================= HERO: image LEFT, description RIGHT ================= */}
              <View style={styles.hero}>
                <View style={styles.sheetImagePanel}>
                  {hasImage ? (
                    <>
                      <Image
                        source={{ uri: imageUri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={() => {
                          setImageError(true);
                          setImageLoading(false);
                        }}
                      />
                      {imageLoading && (
                        <View style={styles.sheetImageLoading}>
                          <ActivityIndicator size="small" color={ACCENT_GOLD} />
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.sheetImageFallback}>
                      <Ionicons name="leaf-outline" size={34} color="#64748B" />
                    </View>
                  )}

                  {/* soft light / dark wash on a state change */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.washLight, { opacity: flashLight }]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.washDark, { opacity: flashDark }]}
                  />

                  {/* BOOKMARK: the only status control */}
                  {showStatus && (
                    <>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.ribbonWrap,
                          { transform: [{ scale: ribbonScale }] },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.ribbonBody,
                            { height: ribbonH, backgroundColor: ribbonColor },
                          ]}
                        >
                          <Animated.View
                            style={[styles.ribbonIcon, { opacity: iconBookmark }]}
                          >
                            <Ionicons
                              name="bookmark-outline"
                              size={14}
                              color="#1C1917"
                            />
                          </Animated.View>
                          <Animated.View
                            style={[styles.ribbonIcon, { opacity: iconGoldCheck }]}
                          >
                            <Ionicons name="checkmark" size={15} color="#1C1917" />
                          </Animated.View>
                          <Animated.View
                            style={[styles.ribbonIcon, { opacity: iconGreenCheck }]}
                          >
                            <Ionicons name="checkmark" size={15} color="#F0FDF4" />
                          </Animated.View>
                          <Animated.View
                            style={[styles.ribbonIcon, { opacity: iconTrash }]}
                          >
                            <Ionicons name="trash" size={14} color="#FEF2F2" />
                          </Animated.View>
                        </Animated.View>
                        <Animated.View
                          style={[styles.ribbonTip, { borderTopColor: ribbonColor }]}
                        />
                      </Animated.View>

                      <Animated.View
                        style={[styles.ribbonHandle, { height: ribbonHandleH }]}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={
                          discovered
                            ? `Remove ${commonName} from discovered`
                            : `Mark ${commonName} as discovered`
                        }
                        accessibilityHint="Pull down to confirm"
                        onAccessibilityTap={commitRibbon}
                        {...ribbonResponder.panHandlers}
                      />
                    </>
                  )}
                </View>

                <View
                  style={[
                    styles.sheetInfoPanel,
                    noInfoMode && styles.sheetInfoPanelCentered,
                  ]}
                >
                  <View style={styles.infoTop}>
                    <Text
                      style={[styles.sheetName, noInfoMode && styles.sheetNameBig]}
                      numberOfLines={3}
                    >
                      {commonName}
                    </Text>
                    {!!scientificName && (
                      <Text
                        style={[styles.sheetSci, noInfoMode && styles.sheetSciBig]}
                        numberOfLines={2}
                      >
                        {scientificName}
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.sheetDescription,
                        !hasDescription && styles.sheetDescriptionEmpty,
                      ]}
                      numberOfLines={hasDescription ? 6 : 3}
                    >
                      {descriptionText}
                    </Text>

                    {(!!species?.family || !!species?.conservation_status) && (
                        <View style={styles.chipRow}>
                          {!!species?.family && (
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1}>
                                {species.family}
                              </Text>
                            </View>
                          )}
                          {!!species?.conservation_status && (
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1}>
                                {species.conservation_status}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                  </View>
                </View>
              </View>

            </ScrollView>
          </View>

          {/* close button stays visible while the profile scrolls */}
          <Pressable
            onPress={dismiss}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={16} color={TEXT_MUTED} />
          </Pressable>

          {/* ===== confirmation card: fixed spot beside the ribbon ===== */}
          {showStatus && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.prompt,
                theme.box,
                {
                  width: promptWidth,
                  opacity: promptOpacity,
                  transform: [{ translateX: promptX }],
                },
              ]}
            >
              <Text style={[styles.promptTitle, theme.title]} numberOfLines={2}>
                {question}
              </Text>
              <Text style={styles.promptSub}>
                Keep pulling to confirm. Release to cancel.
              </Text>
              <View style={styles.track}>
                <Animated.View
                  style={[styles.trackFill, theme.fill, { width: progressWidth }]}
                />
              </View>
              <View style={[styles.tail, theme.tail]} />
            </Animated.View>
          )}

        </Animated.View>
      </View>
    </Modal>
  );
};

/* ========================================================================== */
/*  FULL-SCREEN PROFILE (used when detailSections is passed, e.g. search)     */
/* ========================================================================== */

interface SpeciesFullProfileProps {
  species: any;
  imageUri?: string;
  sections: SpeciesDetailSection[];
  onClose: () => void;
}

const SpeciesFullProfile: React.FC<SpeciesFullProfileProps> = ({
  species,
  imageUri,
  sections,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const {
    detail,
    isLoading: detailLoading,
    loadSpeciesDetails,
    clearSpeciesDetails,
  } = useSpeciesDetails();
  const { records, loadOccurrenceData } = useOccurrenceData();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSpeciesDetails(species);
      } catch (error) {
        console.log('Species detail fetch failed:', error);
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
      clearSpeciesDetails();
    };
    // load once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!detail) return;
    loadOccurrenceData(detail.gbif_id, detail.inaturalist_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const loading = detailLoading || !settled;
  const displayData = detail || species;

  const galleryImages = useMemo(() => {
    const images =
      detail?.gallery_images ||
      species?.gallery_images ||
      (imageUri ? [imageUri] : []);
    return (images || []).filter(Boolean);
  }, [detail, species, imageUri]);

  // ---- sticky header that fades in while scrolling (same as the old modal) --
  const detailScrollY = useSharedValue(0);
  const onDetailScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      detailScrollY.value = event.contentOffset.y;
    },
  });
  const stickyTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      detailScrollY.value,
      [24, 100],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          detailScrollY.value,
          [24, 100],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const stickyHeaderStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          detailScrollY.value,
          [0, 72],
          [-68, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const detailBackButtonStyle = useAnimatedStyle(() => ({
    opacity:
      1 -
      interpolate(detailScrollY.value, [24, 100], [0, 1], Extrapolation.CLAMP),
  }));

  const titleName =
    displayData?.common_name || displayData?.scientific_name || 'Unknown Species';
  const showScientific = !!displayData?.common_name && !!displayData?.scientific_name;

  const has = (key: SpeciesDetailSection) => sections.includes(key);

  // blocks inside the info card (separated by dividers)
  const infoBlocks: React.ReactNode[] = [];
  if (detail && has('quickFacts')) {
    infoBlocks.push(
      <View key="facts">
        <Text style={styles.cardTitle}>Quick facts</Text>
        <View style={styles.quickFactsGrid}>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Status</Text>
            <Text style={styles.factText}>
              {detail?.conservation_status || 'Not listed'}
            </Text>
          </View>

          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Habitat</Text>
            <Text style={styles.factText}>
              {detail?.habitat || 'Mountain ecosystem'}
            </Text>
          </View>

          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Native</Text>
            <Text style={styles.factText}>
              {detail?.is_native === false ? 'Introduced' : 'Native'}
            </Text>
          </View>

          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Occurrence</Text>
            <Text style={styles.factText}>
              {detail?.occurrence_count != null
                ? `${detail.occurrence_count.toLocaleString()} ${
                    detail.occurrence_count === 1 ? 'record' : 'records'
                  }`
                : `${(records?.length ?? 0).toLocaleString()} ${
                    (records?.length ?? 0) === 1 ? 'record' : 'records'
                  } in this timeline`}
            </Text>
          </View>
        </View>
      </View>,
    );
  }
  if (detail?.description) {
    infoBlocks.push(
      <View key="desc">
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.descriptionText}>{detail.description}</Text>
        {!!detail.description_source && (
          <Text style={styles.descriptionSource}>
            Source: {detail.description_source}
          </Text>
        )}
      </View>,
    );
  }
  if (detail && has('timeline')) {
    infoBlocks.push(
      <ObservationTimeline key="timeline" observations={records || []} embedded />,
    );
  }

  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalBackdrop,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.modalScreen}>
          {/* sticky header: slides in once you scroll past the title */}
          <Reanimated.View style={[styles.modalHeader, stickyHeaderStyle]}>
            <Reanimated.View
              pointerEvents="none"
              style={[styles.stickyTitle, stickyTitleStyle]}
            >
              <Text style={styles.modalTitle} numberOfLines={1}>
                {titleName}
              </Text>
              {showScientific && (
                <Text style={styles.modalScientific} numberOfLines={1}>
                  {displayData.scientific_name}
                </Text>
              )}
            </Reanimated.View>

            <Reanimated.View
              pointerEvents="none"
              style={[styles.modalHeaderLine, stickyTitleStyle]}
            />
            <Pressable
              style={styles.closeModalButton}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to species search"
            >
              <Ionicons name="chevron-back" size={22} color="#94A3B8" />
            </Pressable>
          </Reanimated.View>

          <Reanimated.ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onDetailScroll}
          >
            {/* title block with back button */}
            <View style={styles.detailTitle}>
              <Reanimated.View
                style={[styles.detailBackButton, detailBackButtonStyle]}
              >
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back to species search"
                >
                  <Ionicons name="chevron-back" size={22} color="#94A3B8" />
                </Pressable>
              </Reanimated.View>
              <Text style={styles.detailTitleCommon} numberOfLines={1}>
                {titleName}
              </Text>
              {showScientific && (
                <Text style={styles.detailTitleScientific} numberOfLines={1}>
                  {displayData.scientific_name}
                </Text>
              )}
            </View>

            {loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#D4A574" />
                <Text style={styles.modalLoadingText}>
                  Loading species details...
                </Text>
              </View>
            ) : detail ? (
              <View style={styles.modalBody}>
                {has('gallery') &&
                  (galleryImages.length > 0 ? (
                    <SpeciesGallery images={galleryImages} />
                  ) : (
                    <View style={styles.noImageCard}>
                      <Ionicons name="images-outline" size={28} color="#94A3B8" />
                      <Text style={styles.noImageText}>No image data available</Text>
                    </View>
                  ))}

                {infoBlocks.length > 0 && (
                  <View style={styles.infoSection}>
                    {infoBlocks.map((block, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <View style={styles.infoSectionDivider} />}
                        {block}
                      </React.Fragment>
                    ))}
                  </View>
                )}

                {has('taxonomy') && (
                  <TaxonomyTree
                    taxonomy={detail?.taxonomy}
                    source={detail?.taxonomy_source}
                  />
                )}
              </View>
            ) : (
              <View style={styles.noImageCard}>
                <Ionicons name="leaf-outline" size={28} color="#94A3B8" />
                <Text style={styles.noImageText}>Species summary unavailable</Text>
              </View>
            )}
          </Reanimated.ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ========================================================================== */
/*  STYLES                                                                    */
/* ========================================================================== */

// black base with a gold (discover) or red (remove) accent
const themes = {
  gold: StyleSheet.create({
    box: { backgroundColor: '#0A0A0A', borderColor: ACCENT_GOLD },
    title: { color: ACCENT_GOLD },
    fill: { backgroundColor: ACCENT_GOLD },
    tail: { backgroundColor: '#0A0A0A', borderColor: ACCENT_GOLD },
  }),
  red: StyleSheet.create({
    box: { backgroundColor: '#0A0A0A', borderColor: '#EF4444' },
    title: { color: '#FCA5A5' },
    fill: { backgroundColor: '#EF4444' },
    tail: { backgroundColor: '#0A0A0A', borderColor: '#EF4444' },
  }),
};

const styles = StyleSheet.create({
  /* ---------- original grid card (unchanged) ---------- */
  card: {
    flex: 1,
    minHeight: 148,
    backgroundColor: BG_PANEL,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },

  imageContainer: {
    width: '100%',
    aspectRatio: 1.55,
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },

  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },

  topBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 83, 45, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    maxWidth: '70%',
  },

  topBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DCFCE7',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  content: {
    padding: 8,
    gap: 1,
  },

  commonName: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.05,
  },

  scientificName: {
    fontSize: 8.5,
    color: TEXT_MUTED,
    fontStyle: 'italic',
  },

  footerRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  detailLink: {
    color: ACCENT_GOLD,
    fontWeight: '600',
    fontSize: 8.5,
  },

  /* ---------- profile ---------- */
  overlayRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },

  sheet: {
    backgroundColor: BG_PANEL,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  scroll: {
    flexGrow: 0,
  },

  // hero: image LEFT, description RIGHT
  hero: {
    flexDirection: 'row',
    minHeight: 260,
  },

  sheetImagePanel: {
    width: '40%',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: BORDER_DEFAULT,
  },

  sheetImageLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },

  sheetImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },

  washLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },

  washDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },

  // bookmark ribbon (top-left)
  ribbonWrap: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 26,
    alignItems: 'center',
  },

  ribbonBody: {
    width: 26,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  ribbonTip: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  ribbonIcon: {
    position: 'absolute',
    top: 9,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  ribbonHandle: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 42,
  },

  // right panel (description)
  sheetInfoPanel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  sheetInfoPanelCentered: {
    justifyContent: 'center',
  },

  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
    zIndex: 5,
  },

  infoTop: {
    gap: 3,
    paddingRight: 22,
  },

  sheetName: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },

  // no description: the title and subtitle become the focus
  sheetNameBig: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.2,
  },

  sheetSci: {
    fontSize: 12.5,
    color: TEXT_MUTED,
    fontStyle: 'italic',
  },

  sheetSciBig: {
    fontSize: 15,
    lineHeight: 20,
  },

  sheetDescription: {
    marginTop: 8,
    fontSize: 12.5,
    lineHeight: 18,
    color: TEXT_MUTED,
  },

  sheetDescriptionEmpty: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    maxWidth: '100%',
  },

  chipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: TEXT_MUTED,
  },





  /* ---------- sections below the hero (from the old SpeciesSearch modal) ---------- */



  /* ---------- full-screen profile (from the old SpeciesSearch modal) ---------- */
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  modalScreen: { flex: 1, backgroundColor: '#111827' },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 68,
    zIndex: 10,
    elevation: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stickyTitle: {
    position: 'absolute',
    left: 48,
    right: 8,
    top: 10,
    alignItems: 'center',
  },
  modalHeaderLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1E293B',
  },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  modalScientific: {
    marginTop: 3,
    color: '#D4A574',
    fontSize: 12,
    fontStyle: 'italic',
  },
  detailTitle: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  detailBackButton: {
    position: 'absolute',
    top: 12,
    left: 0,
    zIndex: 1,
  },
  detailTitleCommon: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailTitleScientific: {
    color: '#D4A574',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { flex: 1, zIndex: 0, elevation: 0 },
  modalContentContainer: { padding: 12, paddingBottom: 16 },
  modalBody: { gap: 14 },
  descriptionText: { color: '#F8FAFC', fontSize: 12, lineHeight: 18 },
  descriptionSource: { color: '#94A3B8', fontSize: 10, marginTop: 6 },
  modalLoading: { paddingVertical: 40, justifyContent: 'center', alignItems: 'center' },
  modalLoadingText: { marginTop: 12, color: '#94A3B8', fontSize: 12 },

  cardTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 8 },

  quickFactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 20,
  },
  factRow: { flexBasis: '45%', flexGrow: 1 },
  factLabel: {
    color: '#64748B',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  factText: { marginTop: 4, color: '#F8FAFC', fontSize: 13, fontWeight: '600' },

  infoSection: {
    backgroundColor: '#172033',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#233047',
  },
  infoSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#233047',
    marginVertical: 12,
  },

  noImageCard: {
    aspectRatio: 16 / 10,
    borderRadius: 20,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#233047',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  noImageText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  /* ---------- confirmation card (single column, auto height, fixed position) ---------- */
  prompt: {
    position: 'absolute',
    left: 52,
    top: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  promptTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },

  promptSub: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#A1A1AA',
  },

  track: {
    height: 3,
    marginTop: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },

  trackFill: {
    height: '100%',
    borderRadius: 2,
  },

  // small pointer toward the ribbon
  tail: {
    position: 'absolute',
    left: -6,
    top: 18,
    width: 10,
    height: 10,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },

});