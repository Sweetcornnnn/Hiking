import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Rect,
  G,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ─────────────────────────────────────────────────────────────────────────
//  Things you'll most likely want to edit
// ─────────────────────────────────────────────────────────────────────────

// Small line under the logo (shown in capitals).
const SUBTITLE = 'Hiking Trails of Aklan';

// The quote. \n starts the second line. The curly quote marks are added for you.
const QUOTE = 'Don’t look up at the mountain in awe.\nClimb it until the mountain looks up at you.';

// Where the Continue button goes.
const NEXT_ROUTE = '/Login' as const;

// How long the thin loading line runs before the Continue button appears.
const LOAD_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────
//  CREDITS  →  add people here. One line each, that's it.
//
//    { name: 'Full Name' },
//
//  • Only the name is shown, in a small message bubble above the hiker.
//  • `pose` is optional: 'cheer' | 'flag' | 'hike' | 'point' | 'wave'.
//    Leave it out and each spot uses its own default pose.
//  • Hikers fill the spots in RIDGE_SLOTS below, in order (7 spots).
//
//  ⚠️ These are placeholder names. Replace them with the real owners.
// ─────────────────────────────────────────────────────────────────────────
type Pose = 'cheer' | 'flag' | 'hike' | 'point' | 'wave';

interface Credit {
  name: string;
  pose?: Pose;
}

const CREDITS: Credit[] = [
  { name: 'Maria Santos' },
  { name: 'Juan dela Cruz' },
  { name: 'Ana Reyes' },
  { name: 'Carlo Mendoza' },
  { name: 'Liza Ramos' },
  { name: 'Paolo Garcia' },
];

// ─────────────────────────────────────────────────────────────────────────
//  Colors
// ─────────────────────────────────────────────────────────────────────────
const GOLD = '#C9A96E';
const INK = '#080D14';
const ROCK = '#2B3B56';

const SKY_TOP = '#070B11';
const SKY_HORIZON = '#0C1423';

const FAR_FILL = '#142033';
const FAR_SHADE = '#101A2A';
const MID_FILL = '#0E1827';
const MID_SHADE = '#0B1522';
const NEAR_FILL = '#0A121D';

const PANEL = '#0E1520'; // bubbles + Continue button share this panel look
const CTA_TEXT = '#E6D5AE';
const PANEL_BORDER = 'rgba(201, 169, 110, 0.4)';

// ─────────────────────────────────────────────────────────────────────────
//  Mountains
//
//  Drawn in a 400 × 380 space that stretches to the screen width. Every layer
//  is a list of [x, y] points (y grows downward). The low points are valleys
//  and the high points are real summits. Between them are long, gentle
//  shoulders: those are the only places hikers stand, so nobody ever balances
//  on a peak and nothing is cut flat.
// ─────────────────────────────────────────────────────────────────────────
type Pt = [number, number];

const SCENE_W = 400;
const SCENE_H = 380;

// Far range: two tall summits in the middle, long shoulders running out to each side.
const FAR: Pt[] = [
  [0, 150], [122, 112], [170, 54], [205, 100], [250, 40], [284, 98],
  [400, 132],
];

// Middle range: a summit on each side of a gentle saddle.
const MID: Pt[] = [
  [0, 236], [110, 206], [150, 160], [170, 196], [236, 214], [292, 168],
  [312, 208], [400, 236],
];

// Near range: low rolling hills that make the ground the Continue button sits on.
const NEAR: Pt[] = [
  [0, 276], [36, 246], [60, 266], [180, 290], [236, 244], [256, 268],
  [350, 288], [380, 262], [400, 270],
];

const LAYERS = { far: FAR, mid: MID, near: NEAR };
type Layer = keyof typeof LAYERS;

// Hiker spots. Only `x` is needed: the feet are placed on the ridge line
// automatically, so changing the mountains never leaves anyone floating.
//   layer → which range they stand on     s    → size (farther = smaller)
//   flip  → true = faces left             pose → default pose for this spot
// Keep x on a gentle shoulder (not on a summit) and ~45+ apart from the next
// spot on the same layer so the name bubbles don't collide.
const RIDGE_SLOTS: { layer: Layer; x: number; s: number; flip?: boolean; pose: Pose }[] = [
  { layer: 'far', x: 88, s: 0.82, pose: 'hike' },
  { layer: 'far', x: 325, s: 0.82, flip: true, pose: 'cheer' },
  { layer: 'near', x: 125, s: 1.0, pose: 'flag' },
  { layer: 'near', x: 285, s: 1.0, flip: true, pose: 'wave' },
  { layer: 'mid', x: 58, s: 0.9, pose: 'point' },
  { layer: 'mid', x: 342, s: 0.9, flip: true, pose: 'hike' },
  { layer: 'mid', x: 210, s: 0.9, pose: 'cheer' },
];

const ridgeY = (pts: Pt[], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
};

// Solid silhouette for one layer.
const ridgePath = (pts: Pt[]) =>
  `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L${SCENE_W} ${SCENE_H} L0 ${SCENE_H} Z`;

// Darker right-hand face of every summit (two-tone, low-poly look). The valley
// line slants outward as it goes down, like a real mountain base.
const shadeFacets = (pts: Pt[], crease = -6, spread = 30) => {
  const out: string[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    if (!(ay < pts[i - 1][1] && ay < pts[i + 1][1])) continue; // not a summit
    let j = i + 1;
    while (j < pts.length - 1 && pts[j + 1][1] > pts[j][1]) j++; // walk down to the valley
    const face = pts.slice(i, j + 1).map(([x, y]) => `${x} ${y}`).join(' L');
    out.push(`M${face} L${pts[j][0] + spread} ${SCENE_H} L${ax + crease} ${SCENE_H} Z`);
  }
  return out.join(' ');
};

// Thin light catching the steep, sun-facing slopes.
const sunlitEdges = (pts: Pt[], minSlope = 0.35) => {
  const out: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (y1 < y0 && (y0 - y1) / (x1 - x0) >= minSlope) out.push(`M${x0} ${y0} L${x1} ${y1}`);
  }
  return out.join(' ');
};

// ─────────────────────────────────────────────────────────────────────────
//  Hiker
//
//  A little chibi stickman: big round head, short body, all in one color.
//  Drawn in a 36 × 44 box with the feet on y = 42, facing right (`flip`
//  mirrors it). Gear (bucket hat, backpack + bedroll, trekking pole, flag)
//  is the same gold as the body so everything stays one clean silhouette.
// ─────────────────────────────────────────────────────────────────────────
const VB_W = 36;
const VB_H = 44;
const FEET_Y = 42;
const FIG_BASE = 36; // rendered height in px of a size-1 hiker's box

const limb = {
  stroke: GOLD,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
};
const thin = {
  stroke: GOLD,
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
};

// Highest point of each pose (viewBox units), so the name bubble can sit just above it.
const POSE_TOP: Record<Pose, number> = { cheer: 7.2, flag: 3.2, hike: 6.2, point: 7.2, wave: 7.2 };

function Hiker({ pose, height, flip }: { pose: Pose; height: number; flip?: boolean }) {
  const width = (height * VB_W) / VB_H;

  const pack = (
    <>
      <Rect x={10.8} y={22.8} width={6.4} height={9.4} rx={2.4} fill={GOLD} />
      <Rect x={11.2} y={20.5} width={5.6} height={2.7} rx={1.3} fill={GOLD} stroke={INK} strokeWidth={0.6} />
    </>
  );

  const torso = (
    <>
      <Line {...limb} x1={18} y1={21.5} x2={18} y2={30.5} />
    </>
  );

  const head = (
    <>
      <Circle cx={18} cy={14.6} r={6.9} fill={GOLD} />
      <Line x1={11.3} y1={12.9} x2={24.7} y2={12.9} stroke={INK} strokeWidth={1} strokeLinecap="round" />
      <Line x1={9.3} y1={11.5} x2={26.7} y2={11.5} stroke={GOLD} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );

  let body: React.ReactNode;
  switch (pose) {
    case 'cheer':
      body = (
        <>
          <Line {...limb} x1={18} y1={24.5} x2={9.4} y2={17.8} />
          <Line {...limb} x1={18} y1={24.5} x2={26.6} y2={17.8} />
          {torso}
          <Line {...limb} x1={18} y1={30.5} x2={12.8} y2={41.5} />
          <Path {...limb} d="M18 30.5 L24.8 35.2 L26.6 40.6" />
          {head}
        </>
      );
      break;
    case 'flag':
      body = (
        <>
          <Line {...thin} x1={26.2} y1={3.2} x2={26.2} y2={41.8} />
          <Path d="M26.2 3.2 L34.6 6.4 L26.2 9.6 Z" fill={GOLD} />
          <Path {...limb} d="M18 24.5 L12.8 27.6 L15.8 30.6" />
          {torso}
          <Line {...limb} x1={18} y1={30.5} x2={13.6} y2={41.6} />
          <Line {...limb} x1={18} y1={30.5} x2={22.2} y2={41.6} />
          <Line {...limb} x1={18} y1={24.5} x2={26} y2={21.2} />
          {head}
        </>
      );
      break;
    case 'hike':
      body = (
        <>
          <G rotation={8} origin="18, 42">
            {pack}
            <Line {...thin} x1={24.4} y1={28.6} x2={29.4} y2={40.6} />
            {torso}
            <Line {...limb} x1={18} y1={30.5} x2={11.4} y2={41.5} />
            <Path {...limb} d="M18 30.5 L23.6 35.6 L25.2 41.4" />
            <Line {...limb} x1={18} y1={24.5} x2={24.4} y2={28.6} />
            {head}
          </G>
        </>
      );
      break;
    case 'point':
      body = (
        <>
          <Path d="M20.4 42 L22.2 37 L29.6 36.4 L33.2 42 Z" fill={ROCK} />
          {pack}
          {torso}
          <Line {...limb} x1={18} y1={30.5} x2={13.2} y2={41.5} />
          <Path {...limb} d="M18 30.5 L23.8 34.4 L26.4 35.9" />
          <Line {...limb} x1={18} y1={24.5} x2={29.2} y2={18.2} />
          {head}
        </>
      );
      break;
    case 'wave':
      body = (
        <>
          {pack}
          {torso}
          <Line {...limb} x1={18} y1={30.5} x2={15.2} y2={41.5} />
          <Line {...limb} x1={18} y1={30.5} x2={21.2} y2={41.5} />
          <Line {...limb} x1={18} y1={24.5} x2={22.2} y2={31.2} />
          <Line {...limb} x1={18} y1={24.5} x2={27.4} y2={16.8} />
          {head}
        </>
      );
      break;
    default:
      body = null;
  }

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {body}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────────────────────────────────

// Space the logo image leaves empty at its bottom edge (same overlap as before).
const LOGO_TRIM = 70 / 290;
// Height of subtitle + divider + quote + their spacing.
const BRAND_EXTRA = 92;
// The mountain scene has empty sky at its top; the brand block may use a bit of it.
const SKY_OVERLAP = 28;

const BUBBLE_W = 128;

const CTA_W = 188;
const CTA_H = 46;
const LOADER_W = 112;

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isMounted = useRef(true);
  const navigating = useRef(false);
  const [ready, setReady] = useState(false);

  const glowFade   = useRef(new Animated.Value(0)).current;
  const logoFade   = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.88)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(10)).current;
  const quoteFade  = useRef(new Animated.Value(0)).current;
  const sceneFade  = useRef(new Animated.Value(0)).current;
  const barWidth   = useRef(new Animated.Value(0)).current;
  const barFade    = useRef(new Animated.Value(1)).current;
  const ctaFade    = useRef(new Animated.Value(0)).current;
  const ctaSlide   = useRef(new Animated.Value(8)).current;

  // People who actually get a spot on the mountain
  const people = CREDITS.slice(0, RIDGE_SLOTS.length);
  if (__DEV__ && CREDITS.length > RIDGE_SLOTS.length) {
    console.warn(
      `[Intro] ${CREDITS.length} credits but only ${RIDGE_SLOTS.length} ridge spots. Add more to RIDGE_SLOTS.`
    );
  }
  const personAnims = useRef(people.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    isMounted.current = true;

    // Background: mountains fade in slowly, glow fades in then keeps gently breathing
    Animated.timing(sceneFade, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();

    Animated.sequence([
      Animated.timing(glowFade, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowFade, { toValue: 0.55, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowFade, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Brand block: logo, then subtitle + divider, then quote
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(logoFade,  { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textFade,  { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.timing(quoteFade, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    // The hikers appear on the mountain one by one, each name bubble fading in
    // with them. Finishes well before the loading line does.
    Animated.sequence([
      Animated.delay(2400),
      Animated.stagger(
        260,
        personAnims.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        )
      ),
    ]).start();

    // Thin loading line. When it completes it steps aside and Continue appears.
    Animated.timing(barWidth, {
      toValue: 1,
      duration: LOAD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished || !isMounted.current) return;
      setReady(true);
      Animated.parallel([
        Animated.timing(barFade, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(ctaFade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ctaSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });

    return () => {
      isMounted.current = false;
      glowFade.stopAnimation();
      barWidth.stopAnimation();
    };
  }, []);

  const handleContinue = () => {
    if (!ready || navigating.current) return;
    navigating.current = true;
    router.replace(NEXT_ROUTE);
  };

  // ── Layout ────────────────────────────────────────────────────────────
  // The mountain scene is anchored to the bottom and scales with screen width.
  // Under it, the near range's color continues through the bottom safe area,
  // so the Continue button always sits on solid "ground".
  const scale = screenW / SCENE_W;
  const sceneH = Math.round(SCENE_H * scale);
  const foot = insets.bottom;
  const sceneBoxH = sceneH + foot;

  // Everything above the mountains belongs to the brand block (logo, subtitle, quote).
  const topH = screenH - sceneBoxH - insets.top;
  const logoSize = Math.round(
    Math.min(270, Math.max(150, (topH - BRAND_EXTRA - 16) / (1 - LOGO_TRIM)))
  );
  const glowSize = Math.round(logoSize * 1.7);

  // Hikers grow a little on bigger screens, never shrink too far on small ones
  const figureScale = Math.min(1.25, Math.max(0.85, screenW / 390));

  const skyStop = Math.min(1, Math.max(0.3, (screenH - sceneBoxH + 24) / screenH));

  return (
    <View style={styles.root}>

      {/* Sky: very slightly lighter toward the horizon */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SKY_TOP} />
            <Stop offset={skyStop} stopColor={SKY_HORIZON} />
            <Stop offset="1" stopColor={SKY_HORIZON} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
      </Svg>

      {/* Brand block: logo, subtitle, divider, quote */}
      <ScrollView
        style={[styles.brand, { marginTop: insets.top, height: topH + SKY_OVERLAP }]}
        contentContainerStyle={[styles.brandContent, { minHeight: topH + SKY_OVERLAP }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            width: logoSize,
            height: logoSize,
            opacity: logoFade,
            transform: [{ scale: logoScale }],
          }}
        >
          {/* soft gold glow behind the logo */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: glowSize,
              height: glowSize,
              left: (logoSize - glowSize) / 2,
              top: (logoSize - glowSize) / 2,
              opacity: glowFade,
            }}
          >
            <Svg width={glowSize} height={glowSize}>
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={GOLD} stopOpacity={0.1} />
                  <Stop offset="55%" stopColor={GOLD} stopOpacity={0.03} />
                  <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#glow)" />
            </Svg>
          </Animated.View>
          <Image
            source={require('../../assets/images/SakaLogo.png')}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.labelBlock,
            { marginTop: -logoSize * LOGO_TRIM, opacity: textFade, transform: [{ translateY: textSlide }] },
          ]}
        >
          <Text style={styles.subtitle}>{SUBTITLE.toUpperCase()}</Text>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDiamond} />
            <View style={styles.dividerLine} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: quoteFade }}>
          <Text style={styles.quote}>
            {'\u201C'}
            {QUOTE}
            {'\u201D'}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Mountains: three layers, far to near. The near range's color carries
          on under the safe area so the Continue button sits on solid ground. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.scene, { height: sceneBoxH, opacity: sceneFade }]}
      >
        <Svg width={screenW} height={sceneH} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
          <Path d={ridgePath(FAR)} fill={FAR_FILL} />
          <Path d={shadeFacets(FAR)} fill={FAR_SHADE} />
          <Path d={sunlitEdges(FAR)} stroke={GOLD} strokeOpacity={0.22} strokeWidth={0.8} strokeLinecap="round" fill="none" />

          <Path d={ridgePath(MID)} fill={MID_FILL} />
          <Path d={shadeFacets(MID)} fill={MID_SHADE} />
          <Path d={sunlitEdges(MID)} stroke={GOLD} strokeOpacity={0.12} strokeWidth={0.8} strokeLinecap="round" fill="none" />

          <Path d={ridgePath(NEAR)} fill={NEAR_FILL} />
        </Svg>
        <View style={{ flex: 1, backgroundColor: NEAR_FILL }} />
      </Animated.View>

      {/* Credits: hikers standing on the shoulders, name in a message bubble
          above each head. Same box as the mountains, so the 400-wide scene
          coordinates map straight onto the screen. */}
      <View pointerEvents="none" style={[styles.creditsLayer, { bottom: foot, height: sceneH }]}>
        {people.map((person, i) => {
          const slot = RIDGE_SLOTS[i];
          const pose = person.pose ?? slot.pose;
          const px = slot.x * scale;
          const py = ridgeY(LAYERS[slot.layer], slot.x) * scale;
          const figH = FIG_BASE * slot.s * figureScale;
          const figW = (figH * VB_W) / VB_H;
          // distance from the feet up to just above the hiker's highest point
          const bubbleBottom = (figH * (FEET_Y - POSE_TOP[pose])) / VB_H + 3;
          const anim = personAnims[i];

          return (
            <Animated.View
              key={`${person.name}-${i}`}
              style={[
                styles.anchor,
                {
                  left: px,
                  top: py,
                  zIndex: Math.round(py),
                  opacity: anim,
                  transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  ],
                },
              ]}
            >
              <View style={{ position: 'absolute', left: -figW / 2, top: -(figH * FEET_Y) / VB_H }}>
                <Hiker pose={pose} height={figH} flip={slot.flip} />
              </View>

              <View style={[styles.bubbleWrap, { left: -BUBBLE_W / 2, bottom: bubbleBottom }]}>
                <View style={styles.bubble}>
                  <Text style={styles.bubbleText} numberOfLines={1}>
                    {person.name}
                  </Text>
                </View>
                <View style={styles.bubbleTail} />
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Loading line, which hands over to the Continue button in the same spot.
          Space is always reserved so nothing shifts when the button appears. */}
      <View style={[styles.ctaSlot, { bottom: foot + 26 }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[styles.loaderTrack, { left: (screenW - LOADER_W) / 2, opacity: barFade }]}
        >
          <Animated.View
            style={[
              styles.loaderFill,
              { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: [0, LOADER_W] }) },
            ]}
          />
        </Animated.View>

        <Animated.View
          pointerEvents={ready ? 'auto' : 'none'}
          style={{ opacity: ctaFade, transform: [{ translateY: ctaSlide }] }}
        >
          <Pressable
            onPress={handleContinue}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
          >
            <Text style={styles.ctaText}>CONTINUE</Text>
            <Svg width={16} height={8} viewBox="0 0 16 8">
              <Path
                d="M0 4 H14.5 M11 0.8 L14.5 4 L11 7.2"
                stroke={CTA_TEXT}
                strokeWidth={1.1}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>
        </Animated.View>
      </View>

    </View>
  );
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY_TOP,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Brand block
  brand: {
    alignSelf: 'stretch',
  },
  brandContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  labelBlock: {
    alignItems: 'center',
  },
  subtitle: {
    color: 'rgba(201, 169, 110, 0.9)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 4,
    paddingLeft: 4, // balances the trailing letter-spacing so the text is truly centered
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  dividerLine: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(201, 169, 110, 0.55)',
  },
  dividerDiamond: {
    width: 5,
    height: 5,
    marginHorizontal: 8,
    backgroundColor: GOLD,
    transform: [{ rotate: '45deg' }],
  },
  quote: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: SERIF,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Mountains
  scene: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Credits (same box as the mountains)
  creditsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // Zero-size anchor sitting exactly on a hiker's feet; hiker and bubble hang off it
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
  },

  // Name bubble: a small message container with a tail pointing at the hiker
  bubbleWrap: {
    position: 'absolute',
    width: BUBBLE_W,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: BUBBLE_W,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
  },
  bubbleText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 10,
    textAlign: 'center',
  },
  bubbleTail: {
    width: 7,
    height: 7,
    marginTop: -4.5,
    backgroundColor: PANEL,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: PANEL_BORDER,
    transform: [{ rotate: '45deg' }],
  },

  // Loading line + Continue button (same slot)
  ctaSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CTA_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTrack: {
    position: 'absolute',
    top: CTA_H / 2 - 0.5,
    width: LOADER_W,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  loaderFill: {
    height: 1,
    backgroundColor: GOLD,
  },
  // Same panel look as the name bubbles: dark navy, thin gold line, small corners
  ctaBtn: {
    width: CTA_W,
    height: CTA_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 5,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.55)',
  },
  ctaBtnPressed: {
    backgroundColor: '#152033',
    borderColor: 'rgba(201, 169, 110, 0.9)',
  },
  ctaText: {
    color: CTA_TEXT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    paddingLeft: 3, // balances the trailing letter-spacing
  },
});