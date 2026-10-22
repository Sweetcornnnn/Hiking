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
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  RadialGradient,
  Stop,
  Circle,
  Line,
  Rect,
  Ellipse,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Change this one line to whatever you want under the logo.
const SUBTITLE = 'Hiking Trails of Aklan';

// Where the Continue button goes.
const NEXT_ROUTE = '/Login' as const;

// How long the loading bar runs before the Continue button appears.
const LOAD_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────
//  CREDITS  →  add people here. One line each, that's it.
//
//    { name: 'Full Name' },
//
//  • Only the name is shown, inside a little message bubble above the hiker.
//  • `pose` is optional: 'cheer' | 'flag' | 'hike' | 'point' | 'wave'.
//    Leave it out and the poses rotate automatically.
//  • Hikers fill the ledge spots in RIDGE_SLOTS below, in order.
//    There are 7 spots. For more people, add another spot to RIDGE_SLOTS
//    (and give it a flat ledge in the mountain paths).
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

// Spots where hikers stand. x/y are the feet position in the same 400 × 240
// space the mountains are drawn in, and each one sits on a flat ledge in the
// ridge paths below. `s` is hiker size (smaller = farther away). `flip` turns
// the hiker to face left. Filled in this order so a few people stay nicely
// spread out across the range.
const RIDGE_SLOTS: { x: number; y: number; s: number; flip?: boolean }[] = [
  { x: 121, y: 104, s: 0.85 },               // far range, left ledge
  { x: 290, y: 108, s: 0.85, flip: true },   // far range, right ledge
  { x: 112, y: 190, s: 1 },                  // near range, left ledge
  { x: 345, y: 150, s: 0.95, flip: true },   // mid range, right ledge
  { x: 40, y: 160, s: 0.95 },                // mid range, left ledge
  { x: 285, y: 194, s: 1, flip: true },      // near range, right ledge
  { x: 232, y: 144, s: 0.95 },               // mid range, center ledge
];

const POSE_ROTATION: Pose[] = ['cheer', 'flag', 'hike', 'point', 'wave'];

const GOLD = '#C9A96E';
const INK = '#080D14';
const CORAL = '#D9674A';
const TEAL = '#4F9A94';
const SAND = '#E8DEC6';
const ROCK = '#2B3748';

const BUBBLE_W = 120;
const BUBBLE_BG = '#0E1520';
const BUBBLE_BORDER = 'rgba(201, 169, 110, 0.4)';

// ── Chibi hiker ──────────────────────────────────────────────────────────
// Drawn in a 36 × 44 box, feet on y = 42. Big head, short body, so it reads
// as cute even when tiny. Everything is drawn facing right; `flip` mirrors it.

const VB_W = 36;
const VB_H = 44;
const FEET_Y = 42;

// Highest point (in viewBox units) of each pose, used to park the name bubble
// just above it. The flag pose is taller because of the flag.
const poseTop = (pose: Pose) => (pose === 'flag' ? 2 : 5.5);

function Hiker({ pose, height, flip }: { pose: Pose; height: number; flip?: boolean }) {
  const width = (height * VB_W) / VB_H;
  const limb = {
    stroke: GOLD,
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  // Hikers who are walking / pointing look a touch toward where they're going
  const look = pose === 'hike' || pose === 'point' ? 1 : 0;

  const pack = (
    <>
      <Rect x={10.2} y={23.2} width={6.6} height={9.6} rx={2.5} fill={TEAL} />
      <Rect x={10.8} y={21} width={5.6} height={2.8} rx={1.4} fill={SAND} />
    </>
  );

  const torso = <Line x1={18} y1={22} x2={18} y2={31} {...limb} />;

  const head = (
    <>
      <Circle cx={18} cy={15} r={7.2} fill={GOLD} />
      <Circle cx={15.4 + look} cy={15.8} r={0.95} fill={INK} />
      <Circle cx={20.6 + look} cy={15.8} r={0.95} fill={INK} />
      <Path
        d={`M${16.6 + look} 18.4 Q${18 + look} 19.7 ${19.4 + look} 18.4`}
        stroke={INK}
        strokeWidth={0.75}
        strokeLinecap="round"
        fill="none"
      />
      {/* little bucket hat */}
      <Path d="M10.6 11.4 Q18 3.6 25.4 11.4 Z" fill={CORAL} />
      <Line x1={9.4} y1={11.6} x2={26.6} y2={11.6} stroke={CORAL} strokeWidth={1.7} strokeLinecap="round" />
    </>
  );

  let body: React.ReactNode = null;

  if (pose === 'cheer') {
    // Mid-jump, arms thrown up, one leg kicked out, confetti dots
    body = (
      <>
        <Line x1={18} y1={25} x2={8.5} y2={18.5} {...limb} />
        <Line x1={18} y1={25} x2={27.5} y2={18.5} {...limb} />
        {torso}
        <Line x1={18} y1={31} x2={12.5} y2={41} {...limb} />
        <Path d="M18 31 L25.5 35.5 L27.5 40.5" {...limb} />
        {head}
        <Circle cx={4.5} cy={11} r={0.9} fill={SAND} />
        <Circle cx={31.5} cy={10} r={0.9} fill={CORAL} />
        <Circle cx={33} cy={17} r={0.7} fill={SAND} />
        <Circle cx={3} cy={19} r={0.7} fill={CORAL} />
      </>
    );
  } else if (pose === 'flag') {
    // Planting a summit flag, other hand on hip
    body = (
      <>
        <Line x1={26} y1={2.5} x2={26} y2={41.5} stroke={SAND} strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M26 2.5 L34.5 5.8 L26 9.2 Z" fill={CORAL} />
        <Path d="M18 25 L11.5 28 L15.5 31" {...limb} />
        {torso}
        <Line x1={18} y1={31} x2={13.5} y2={41.5} {...limb} />
        <Line x1={18} y1={31} x2={22} y2={41.5} {...limb} />
        <Line x1={18} y1={25} x2={26} y2={21} {...limb} />
        {head}
      </>
    );
  } else if (pose === 'hike') {
    // Leaning into the climb with a trekking pole, mid-stride
    body = (
      <G rotation={9} origin="18, 42">
        {pack}
        <Line x1={24} y1={28.6} x2={29} y2={40.5} stroke={SAND} strokeWidth={1.2} strokeLinecap="round" />
        <Line x1={18} y1={25} x2={12.5} y2={30} {...limb} />
        {torso}
        <Line x1={18} y1={31} x2={11} y2={41.5} {...limb} />
        <Path d="M18 31 L23.5 36 L25 41.5" {...limb} />
        <Line x1={18} y1={25} x2={24} y2={28.6} {...limb} />
        {head}
      </G>
    );
  } else if (pose === 'point') {
    // Boot up on a rock, pointing out at the next peak
    body = (
      <>
        <Path d="M20 42 L21.5 37.4 L27.5 36.4 L31 42 Z" fill={ROCK} />
        {pack}
        <Line x1={18} y1={25} x2={14} y2={30.5} {...limb} />
        {torso}
        <Line x1={18} y1={31} x2={13} y2={41.5} {...limb} />
        <Path d="M18 31 L24.5 35 L27 36.2" {...limb} />
        <Line x1={18} y1={25} x2={31} y2={17.5} {...limb} />
        {head}
      </>
    );
  } else {
    // wave
    body = (
      <>
        {pack}
        <Line x1={18} y1={25} x2={13.5} y2={31.5} {...limb} />
        {torso}
        <Line x1={18} y1={31} x2={15} y2={41.5} {...limb} />
        <Line x1={18} y1={31} x2={21} y2={41.5} {...limb} />
        <Line x1={18} y1={25} x2={27.5} y2={16.5} {...limb} />
        <Path d="M30.4 14.2 Q32 16.6 30.4 19" stroke={SAND} strokeOpacity={0.6} strokeWidth={0.8} strokeLinecap="round" fill="none" />
        <Path d="M32.4 13 Q34.4 16.6 32.4 20.4" stroke={SAND} strokeOpacity={0.35} strokeWidth={0.8} strokeLinecap="round" fill="none" />
        {head}
      </>
    );
  }

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Ellipse cx={18} cy={FEET_Y} rx={8} ry={1.3} fill="#000" fillOpacity={0.35} />
      {body}
    </Svg>
  );
}

// ── Scenery helpers ──────────────────────────────────────────────────────

// One little two-tier pine as an SVG path string (so a whole row of them can
// be drawn with a single <Path>).
const pine = (x: number, y: number, h: number) => {
  const w = h * 0.32;
  return (
    `M${x} ${y - h} L${x + w} ${y - h * 0.4} L${x + w * 0.55} ${y - h * 0.4} ` +
    `L${x + w * 1.1} ${y} L${x - w * 1.1} ${y} L${x - w * 0.55} ${y - h * 0.4} ` +
    `L${x - w} ${y - h * 0.4} Z`
  );
};

const MID_TREES = [pine(190, 160, 10), pine(198, 152, 8), pine(272, 158, 10), pine(281, 165, 8)].join(' ');
const NEAR_TREES = [
  pine(38, 202, 12),
  pine(48, 202, 16),
  pine(58, 202, 11),
  pine(374, 200, 14),
  pine(386, 203, 10),
].join(' ');

export default function IntroScreen() {
  const router = useRouter();
  const isMounted = useRef(true);
  const navigating = useRef(false);
  const { width: screenW } = useWindowDimensions();
  const [ready, setReady] = useState(false);

  const glowFade   = useRef(new Animated.Value(0)).current;
  const logoFade   = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(12)).current;
  const quoteFade  = useRef(new Animated.Value(0)).current;
  const ridgeFade  = useRef(new Animated.Value(0)).current;
  const barWidth   = useRef(new Animated.Value(0)).current;
  const barFade    = useRef(new Animated.Value(1)).current;
  const ctaFade    = useRef(new Animated.Value(0)).current;
  const ctaSlide   = useRef(new Animated.Value(10)).current;

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

    // Background: ridges fade in slowly, glow fades in then keeps gently breathing
    Animated.timing(ridgeFade, { toValue: 1, duration: 2800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();

    Animated.sequence([
      Animated.timing(glowFade, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowFade, { toValue: 0.55, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowFade, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Foreground: logo, then subtitle, then quote
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(logoFade,  { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(textFade,  { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(quoteFade, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    // The one orchestrated moment: the hikers appear on the ledges one by one,
    // each name bubble fading in with them. Finishes well before the loading bar does.
    Animated.sequence([
      Animated.delay(2400),
      Animated.stagger(
        260,
        personAnims.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        )
      ),
    ]).start();

    // Loading bar. When it completes, the bar steps aside and Continue appears.
    Animated.timing(barWidth, {
      toValue: 1,
      duration: LOAD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished || !isMounted.current) return;
      setReady(true);
      Animated.parallel([
        Animated.timing(barFade, { toValue: 0, duration: 400, useNativeDriver: true }),
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

  const ridgeHeight = Math.round(screenW * 0.6);
  // Hikers grow a little on bigger screens, never shrink too far on small ones
  const figureScale = Math.min(1.25, Math.max(0.85, screenW / 390));

  return (
    <View style={styles.root}>

      {/* Mountain range along the bottom: three layers, far to near. Each layer
          has flat ledges where the hikers stand, plus a camp, a summit flag,
          pines and a dotted trail linking the spots. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ridgeWrap, { height: ridgeHeight, opacity: ridgeFade }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice">
          {/* far range: ledges at x 30–52, 106–136, 268–312, summit at 192–206 */}
          <Path
            d="M0 146 L30 122 L52 122 L82 148 L106 104 L136 104 L168 136 L192 88 L206 88 L240 130 L268 108 L312 108 L344 132 L370 112 L400 130 L400 240 L0 240 Z"
            fill="#111C2B"
          />
          {/* sunlit slopes on the far range, one quiet highlight */}
          <Path
            d="M82 148 L106 104 M168 136 L192 88 M240 130 L268 108 M344 132 L370 112"
            stroke="#C9A96E"
            strokeOpacity={0.2}
            strokeWidth={0.8}
            fill="none"
            strokeLinecap="round"
          />

          {/* summit flag */}
          <Line x1={199} y1={88} x2={199} y2={67} stroke={SAND} strokeOpacity={0.85} strokeWidth={0.9} strokeLinecap="round" />
          <Path d="M199 67 L211 71.5 L199 76 Z" fill={CORAL} />

          {/* little camp on the far-left ledge: tent + fire */}
          <Path d="M32 122 L38.5 111 L45 122 Z" fill="#2E6F6A" />
          <Path d="M37 122 L38.5 116.6 L40 122 Z" fill="#0B1A1E" />
          <Path d="M48.4 122 Q47.6 119.2 49.2 117.2 Q50.8 119.2 50 122 Z" fill={CORAL} />
          <Path d="M48.9 122 Q48.6 120.4 49.2 119.4 Q49.8 120.4 49.5 122 Z" fill={GOLD} />

          {/* mid range: ledges at x 20–64, 206–256, 322–366 */}
          <Path
            d="M0 184 L20 160 L64 160 L96 180 L136 154 L170 180 L206 144 L256 144 L286 170 L322 150 L366 150 L388 164 L400 160 L400 240 L0 240 Z"
            fill="#0D1624"
          />
          <Path d={MID_TREES} fill="#0E1F27" />

          {/* near range: ledges at x 30–66, 98–126, 270–300 */}
          <Path
            d="M0 214 L30 202 L66 202 L98 190 L126 190 L152 206 L190 200 L224 210 L270 194 L300 194 L330 208 L366 198 L400 206 L400 240 L0 240 Z"
            fill="#0A111C"
          />
          <Path d={NEAR_TREES} fill="#0C1D22" />

          {/* the trail, passing through every hiker's spot */}
          <Path
            d="M40 160 Q70 175 112 190 Q190 186 232 144 Q262 120 290 108 Q330 126 345 150 Q330 178 285 194"
            stroke={GOLD}
            strokeOpacity={0.22}
            strokeWidth={1}
            strokeDasharray="2.5 3.5"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Credits: hikers standing on the ledges with their name in a message
          bubble above their head. This layer is the same size as the mountains,
          so the 400 × 240 spots line up with the drawn ledges. */}
      <View pointerEvents="none" style={[styles.creditsLayer, { height: ridgeHeight }]}>
        {people.map((person, i) => {
          const slot = RIDGE_SLOTS[i];
          const pose = person.pose ?? POSE_ROTATION[i % POSE_ROTATION.length];
          const figH = 30 * slot.s * figureScale;
          const anim = personAnims[i];
          // distance from the feet up to just above the hiker's highest point
          const bubbleBottom = (figH * (FEET_Y - poseTop(pose))) / VB_H + 1;

          return (
            <Animated.View
              key={`${person.name}-${i}`}
              style={[
                styles.anchor,
                {
                  left: `${(slot.x / 400) * 100}%`,
                  top: `${(slot.y / 240) * 100}%`,
                  zIndex: Math.round(slot.y),
                  opacity: anim,
                  transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  ],
                },
              ]}
            >
              <View
                style={{
                  position: 'absolute',
                  left: -((figH * VB_W) / VB_H) / 2,
                  top: -(figH * FEET_Y) / VB_H,
                }}
              >
                <Hiker pose={pose} height={figH} flip={slot.flip} />
              </View>

              {/* name bubble */}
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

      {/* Logo with soft gold glow behind it */}
      <Animated.View style={[styles.logoWrap, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
        <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowFade }]}>
          <Svg width={460} height={460}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#C9A96E" stopOpacity={0.10} />
                <Stop offset="55%" stopColor="#C9A96E" stopOpacity={0.03} />
                <Stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={230} cy={230} r={230} fill="url(#glow)" />
          </Svg>
        </Animated.View>
        <Image
          source={require('../../assets/images/SakaLogo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={[styles.nameWrap, { opacity: textFade, transform: [{ translateY: textSlide }] }]}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </View>
        <Text style={styles.appSub}>{SUBTITLE}</Text>
      </Animated.View>

      {/* Quote */}
      <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
        <Text style={styles.quoteText}>
          {'\u201C'}Don{'\u2019'}t look up at the mountain in awe.{'\n'}
          Climb it until the mountain looks up at you.{'\u201D'}
        </Text>
      </Animated.View>

      {/* Continue: space is always reserved so nothing shifts when it appears */}
      <View style={styles.ctaSlot}>
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
            <Text style={styles.ctaText}>Continue</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Progress bar (fades out once loading is done) */}
      <Animated.View pointerEvents="none" style={[styles.barTrack, { opacity: barFade }]}>
        <Animated.View style={[styles.barFill, {
          width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }]} />
      </Animated.View>

    </View>
  );
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Mountains
  ridgeWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Credits (same box as the mountains)
  creditsLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Zero-size anchor sitting exactly on a ledge spot; hiker and bubble hang off it
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
  },

  // Name bubble (message container with a little tail pointing at the hiker)
  bubbleWrap: {
    position: 'absolute',
    width: BUBBLE_W,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: BUBBLE_W,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9,
    backgroundColor: BUBBLE_BG,
    borderWidth: 1,
    borderColor: BUBBLE_BORDER,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  bubbleTail: {
    width: 7,
    height: 7,
    marginTop: -4.5,
    backgroundColor: BUBBLE_BG,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BUBBLE_BORDER,
    transform: [{ rotate: '45deg' }],
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  glow: {
    position: 'absolute',
    width: 460,
    height: 460,
    left: (290 - 460) / 2,
    top: (290 - 460) / 2,
  },
  logoImage: {
    width: 290,
    height: 290,
  },

  // Subtitle
  nameWrap: {
    alignItems: 'center',
    marginTop: -70,
    marginBottom: 28,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: '#C9A96E',
    transform: [{ rotate: '45deg' }],
  },
  appSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  // Quote
  quoteWrap: {
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  quoteText: {
    color: 'rgba(255,255,255,0.38)',
    fontFamily: SERIF,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Continue button. Same look as the pills in the MountainTop header.
  // Slot height + margin keep the original 90px of room under the quote,
  // so the layout above it doesn't move.
  ctaSlot: {
    height: 46,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 20,
    paddingRight: 14,
    borderRadius: 19,
    backgroundColor: 'rgba(14, 21, 32, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ctaBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Progress bar
  barTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#C9A96E',
  },
});