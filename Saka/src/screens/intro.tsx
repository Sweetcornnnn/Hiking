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
import Svg, { Path, Defs, RadialGradient, Stop, Circle, Line, Rect, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────
//  Editable content
// ─────────────────────────────────────────────────────────────────────────
const SUBTITLE = 'Hiking Trails of Aklan';
const MEMBERS = ['Angel Lanorias', 'Joy Dagohoy', 'Renz Ibañez', 'Carlos Conanan', 'Jered Asuncion'];

// ─────────────────────────────────────────────────────────────────────────
//  Colors
// ─────────────────────────────────────────────────────────────────────────
const GOLD = '#C9A96E';
const INK = '#080D14';
const ROCK = '#2B3B56';

const SUMMIT_FILL = '#152136'; 
const SUMMIT_SHADE = '#0e151f';
const FAR_FILL = '#16253B';
const FAR_SHADE = '#121E31';
const MID_FILL = '#0F1A2B';
const MID_SHADE = '#0C1523';
const NEAR_FILL = '#0A121D';

// ─────────────────────────────────────────────────────────────────────────
//  Mountains
// ─────────────────────────────────────────────────────────────────────────
type Pt = [number, number];
type Layer = 'far' | 'mid' | 'near';
type Pose = 'cheer' | 'flag' | 'hike' | 'point' | 'wave';

const SCENE_W = 400;
const SCENE_H = 290;

const SUMMIT: Pt[] = [
  [0, 290], [40, 240], [80, 190], [120, 130], [160, 80], [200, 45], [240, 80], [280, 130], [320, 190], [360, 240], [400, 290]
];

const FAR: Pt[] = [
  [0, 180], [34, 146], [62, 162], [104, 100], [140, 142], [176, 118],
  [214, 154], [258, 90], [296, 138], [330, 122], [366, 148], [400, 128],
];
const MID: Pt[] = [
  [0, 216], [46, 182], [84, 202], [132, 156], [172, 198], [205, 170],
  [240, 206], [292, 162], [338, 200], [372, 180], [400, 194],
];
const NEAR: Pt[] = [
  [0, 256], [56, 230], [104, 246], [130, 230], [180, 210], [220, 210], [270, 230], [300, 240], [336, 246], [400, 230],
];
const RIDGES: Record<Layer, Pt[]> = { far: FAR, mid: MID, near: NEAR };

const pts = (list: Pt[]) => list.map(([x, y]) => `${x} ${y}`).join(' L');

const ridgeY = (list: Pt[], x: number) => {
  for (let i = 1; i < list.length; i++) {
    const [x0, y0] = list[i - 1];
    const [x1, y1] = list[i];
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return list[list.length - 1][1];
};

const ridgePath = (list: Pt[]) =>
  `M${pts(list)} L${SCENE_W} ${SCENE_H} L0 ${SCENE_H} Z`;

const shadeFacets = (list: Pt[], crease = -6, spread = 30) => {
  const out: string[] = [];
  for (let i = 1; i < list.length - 1; i++) {
    const [ax, ay] = list[i];
    if (!(ay < list[i - 1][1] && ay < list[i + 1][1])) continue;
    let j = i + 1;
    while (j < list.length - 1 && list[j + 1][1] > list[j][1]) j++;
    out.push(`M${pts(list.slice(i, j + 1))} L${list[j][0] + spread} ${SCENE_H} L${ax + crease} ${SCENE_H} Z`);
  }
  return out.join(' ');
};

const sunlitEdges = (list: Pt[], minSlope = 0.35) => {
  const out: string[] = [];
  for (let i = 1; i < list.length; i++) {
    const [x0, y0] = list[i - 1];
    const [x1, y1] = list[i];
    if (y1 < y0 && (y0 - y1) / (x1 - x0) >= minSlope) out.push(`M${x0} ${y0} L${x1} ${y1}`);
  }
  return out.join(' ');
};

// ─────────────────────────────────────────────────────────────────────────
//  Stickmen Positions
// ─────────────────────────────────────────────────────────────────────────
const SPOTS: { layer: Layer; x: number; s: number; pose: Pose; flip?: boolean }[] = [
  { layer: 'far', x: 112, s: 0.8, pose: 'flag' },
  { layer: 'far', x: 257, s: 0.8, pose: 'cheer', flip: true },
  { layer: 'mid', x: 136, s: 0.95, pose: 'wave' },
  { layer: 'mid', x: 292, s: 0.95, pose: 'point', flip: true },
  { layer: 'near', x: 206, s: 1.1, pose: 'hike' },
];

// ─────────────────────────────────────────────────────────────────────────
//  Hiker
// ─────────────────────────────────────────────────────────────────────────
const VB_W = 36;
const VB_H = 44;
const FEET_Y = 42;
const FIG_BASE = 32;

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
//  Screen Constants
// ─────────────────────────────────────────────────────────────────────────
const LOGO_TRIM = 70 / 290;
const BRAND_EXTRA = 116;
const BUBBLE_W = 132;

const STARS = Array.from({ length: 40 }, (_, i) => {
  const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const r2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 12345.6789) % 1;
  const r3 = Math.abs(Math.sin(i * 39.346 + 4.1) * 98765.4321) % 1;
  return { x: r1, y: r2, r: 0.5 + r3 * 0.9, twinkle: i % 3 === 0 };
});

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [brandH, setBrandH] = useState<number | null>(null);
  const navigating = useRef(false);

  const scrollRef = useRef<ScrollView>(null);

  const glowFade   = useRef(new Animated.Value(0)).current;
  const logoFade   = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(12)).current;
  const quoteFade  = useRef(new Animated.Value(0)).current;
  const ridgeFade  = useRef(new Animated.Value(0)).current;
  const starFade   = useRef(new Animated.Value(0)).current;
  const twinkle    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 120, animated: false });
    }, 100);

    Animated.timing(starFade, { toValue: 1, duration: 2500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

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

    Animated.sequence([
      Animated.delay(200),
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
    ]).start(() => {
      if (isMounted) setReady(true);
    });

    return () => {
      isMounted = false;
      [glowFade, logoFade, logoScale, textFade, textSlide, quoteFade, ridgeFade, starFade, twinkle].forEach(v => v.stopAnimation());
    };
  }, []);

  const handleStart = () => {
    if (!ready || navigating.current) return;
    navigating.current = true;
    router.replace('/Login');
  };

  const scale = screenW / SCENE_W;
  const sceneH = Math.round(SCENE_H * scale);
  const foot = insets.bottom;
  
  const roomH = (brandH ?? screenH - (sceneH + foot)) - insets.top;
  const maxLogo = Math.min(340, screenW * 0.85);
  const logoSize = Math.round(
    Math.min(maxLogo, Math.max(140, (roomH - BRAND_EXTRA - 16) / (1 - LOGO_TRIM)))
  );
  const glowSize = Math.round(logoSize * 1.6);
  const figureScale = Math.min(1.25, Math.max(0.9, screenW / 390));

  const hikers = SPOTS.map((spot, i) => {
    const name = MEMBERS[i];
    if (!name) return null;
    const px = spot.x * scale;
    const py = ridgeY(RIDGES[spot.layer], spot.x) * scale;
    const figH = FIG_BASE * spot.s * figureScale;
    const figW = (figH * VB_W) / VB_H;
    const headRise = (figH * (FEET_Y - POSE_TOP[spot.pose])) / VB_H;
    const isOpen = selected === i;

    return (
      <View
        key={name + i}
        style={[styles.anchor, { left: px, top: py, zIndex: isOpen ? 999 : Math.round(py) }]}
      >
        <Pressable
          onPress={() => setSelected(isOpen ? null : i)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? `Hide name` : `Show name of member ${i + 1}`}
          style={{
            position: 'absolute',
            left: -figW / 2 - 6,
            top: -(figH * FEET_Y) / VB_H - 6,
            width: figW + 12,
            height: figH + 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Hiker pose={spot.pose} height={figH} flip={spot.flip} />
        </Pressable>

        {isOpen && (
          <View pointerEvents="none" style={[styles.bubbleWrap, { left: -BUBBLE_W / 2, bottom: headRise + 8 }]}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <View style={styles.bubbleTail} />
          </View>
        )}
      </View>
    );
  });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={{ flex: 1, opacity: starFade }}>
          <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
            {STARS.filter(s => !s.twinkle).map((st, i) => (
              <Circle key={i} cx={st.x * screenW} cy={st.y * screenH} r={st.r} fill="#FFFFFF" fillOpacity={0.4} />
            ))}
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle }]}>
            <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
              {STARS.filter(s => s.twinkle).map((st, i) => (
                <Circle key={i} cx={st.x * screenW} cy={st.y * screenH} r={st.r + 0.3} fill={GOLD} fillOpacity={0.8} />
              ))}
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: foot }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ height: insets.top + 20 }} />

        <View style={styles.brand} onLayout={(e) => setBrandH(e.nativeEvent.layout.height)}>
          
          {/* SAKA LOGO IS NOW A PRESSABLE BUTTON */}
          <Pressable
            onPress={handleStart}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Start the hike"
            style={({ pressed }) => [
              pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
            ]}
          >
            <Animated.View
              style={[
                styles.logoWrap,
                { width: logoSize, height: logoSize, opacity: logoFade, transform: [{ scale: logoScale }] },
              ]}
            >
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
                      <Stop offset="0%" stopColor={GOLD} stopOpacity={0.10} />
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
          </Pressable>

          <Animated.View
            style={[
              styles.nameWrap,
              { marginTop: -logoSize * LOGO_TRIM, opacity: textFade, transform: [{ translateY: textSlide }] },
            ]}
          >
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDiamond} />
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.appSub}>{SUBTITLE}</Text>
          </Animated.View>

          <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
            <Text style={styles.quoteText}>
              {'\u201C'}Don{'\u2019'}t look up at the mountain in awe.{'\n'}
              Climb it until the mountain looks up at you.{'\u201D'}
            </Text>
          </Animated.View>
        </View>

        <View style={[styles.scene, { height: sceneH }]}>
          <Animated.View style={{ flex: 1, opacity: ridgeFade }}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Path d={ridgePath(SUMMIT)} fill={SUMMIT_FILL} />
              <Path d={shadeFacets(SUMMIT)} fill={SUMMIT_SHADE} />
              <Path d={sunlitEdges(SUMMIT)} stroke={GOLD} strokeOpacity={0.5} strokeWidth={0.18} strokeLinecap="round" fill="none" />

              <Path d={ridgePath(FAR)} fill={FAR_FILL} />
              <Path d={shadeFacets(FAR)} fill={FAR_SHADE} />
              <Path d={sunlitEdges(FAR)} stroke={GOLD} strokeOpacity={0.22} strokeWidth={0.8} strokeLinecap="round" fill="none" />

              <Path d={ridgePath(MID)} fill={MID_FILL} />
              <Path d={shadeFacets(MID)} fill={MID_SHADE} />
              <Path d={sunlitEdges(MID)} stroke={GOLD} strokeOpacity={0.12} strokeWidth={0.8} strokeLinecap="round" fill="none" />

              <Path d={ridgePath(NEAR)} fill={NEAR_FILL} />
            </Svg>

            {hikers}
          </Animated.View>
        </View>
      </ScrollView>

    </View>
  );
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40, 
    paddingBottom: 40,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: {
    alignItems: 'center',
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
    backgroundColor: GOLD,
    transform: [{ rotate: '45deg' }],
  },
  appSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  quoteWrap: {
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
  scene: {
    width: '100%',
  },
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  bubbleWrap: {
    position: 'absolute',
    width: BUBBLE_W,
    alignItems: 'center',
  },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 13, 20, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.6)',
  },
  bubbleText: {
    color: '#F2E8D5',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(201, 169, 110, 0.6)',
  },
});