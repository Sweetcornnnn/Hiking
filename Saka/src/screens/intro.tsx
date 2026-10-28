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
import Svg, { Path, Defs, RadialGradient, LinearGradient, Stop, Circle, Ellipse, Line, Rect, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

// ─────────────────────────────────────────────────────────────────────────
//  Editable content
// ─────────────────────────────────────────────────────────────────────────
const SUBTITLE = 'Peaks Around Aklan: First Steps';
const MEMBERS = ['Angel Lanorias', 'Joy Dagohoy', 'Renz Ibañez', 'Carlos Conanan', 'Jered Asuncion'];
// One quote per member, same order as MEMBERS (keep them short so the bubble stays compact)
const QUOTES = [
  'Every summit starts with one small step.',
  'Good trails, good friends, good vibes.',
  'Slow and steady still reaches the top.',
  'The mountains are calling, so I packed snacks.',
  'The view is worth every single blister.',
];

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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// A soft curve that passes THROUGH an elbow/knee (instead of a hard angled stick)
const via = (s: Pt, j: Pt, e: Pt) =>
  `M${s[0]} ${s[1]} Q${2 * j[0] - (s[0] + e[0]) / 2} ${2 * j[1] - (s[1] + e[1]) / 2} ${e[0]} ${e[1]}`;

// A gentle bow instead of a ruler-straight line
const bow = (s: Pt, e: Pt, b = 0.1) => {
  const dx = e[0] - s[0];
  const dy = e[1] - s[1];
  return `M${s[0]} ${s[1]} Q${s[0] + dx / 2 - dy * b} ${s[1] + dy / 2 + dx * b} ${e[0]} ${e[1]}`;
};

const Hand = ({ at }: { at: Pt }) => <Circle cx={at[0]} cy={at[1]} r={1.35} fill={GOLD} />;

const Boot = ({ at }: { at: Pt }) => (
  <Line x1={at[0] - 0.5} y1={at[1] - 0.2} x2={at[0] + 2} y2={at[1] - 0.2} stroke={GOLD} strokeWidth={2.9} strokeLinecap="round" />
);

// Arm whose elbow leads and whose hand lags a beat behind (follow-through)
function swingArm(s: Pt, rest: Pt, act: Pt, k: number, k2: number, bend: number) {
  const lead: Pt = [lerp(rest[0], act[0], k), lerp(rest[1], act[1], k)];
  const tip: Pt = [lerp(rest[0], act[0], k2), lerp(rest[1], act[1], k2)];
  const dx = lead[0] - s[0];
  const dy = lead[1] - s[1];
  const cx = s[0] + dx / 2 - dy * bend;
  const cy = s[1] + dy / 2 + dx * bend;
  return (
    <>
      <Path {...limb} d={`M${s[0]} ${s[1]} Q${cx} ${cy} ${tip[0]} ${tip[1]}`} />
      <Hand at={tip} />
    </>
  );
}

const POSE_TOP: Record<Pose, number> = { cheer: 7.2, flag: 3.2, hike: 6.2, point: 7.2, wave: 7.2 };

// k  = main motion, 0..1 (arm swing, stride, flag flutter)
// k2 = same motion a few ms late, so hands/flag trail the body
// air = how far off the ground (tucks the legs while jumping)
// lean = tiny spine bend in degrees
type HikerProps = {
  pose: Pose;
  height: number;
  flip?: boolean;
  k?: number;
  k2?: number;
  air?: number;
  lean?: number;
};

function Hiker({ pose, height, flip, k = 0, k2 = 0, air = 0, lean = 0 }: HikerProps) {
  const width = (height * VB_W) / VB_H;
  const S: Pt = [18, 24.5]; // shoulder
  const H: Pt = [18, 30.5]; // hip

  const pack = (
    <>
      <Rect x={10.8} y={22.8} width={6.4} height={9.4} rx={2.4} fill={GOLD} />
      <Rect x={11.2} y={20.5} width={5.6} height={2.7} rx={1.3} fill={GOLD} stroke={INK} strokeWidth={0.6} />
    </>
  );

  const torso = <Line {...limb} x1={18} y1={21.5} x2={18} y2={30.5} />;

  const head = (
    <>
      <Circle cx={18} cy={14.6} r={6.9} fill={GOLD} />
      <Line x1={11.3} y1={12.9} x2={24.7} y2={12.9} stroke={INK} strokeWidth={1} strokeLinecap="round" />
      <Line x1={9.3} y1={11.5} x2={26.7} y2={11.5} stroke={GOLD} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );

  // everything above the hip bends together, so the whole body flows
  const upper = (inner: React.ReactNode) => (
    <G rotation={lean} origin="18, 30.5">{inner}</G>
  );

  let body: React.ReactNode;
  switch (pose) {
    case 'cheer': {
      const f1: Pt = [12.8, 41.5 - 2.4 * air];
      const f2: Pt = [26.6, 40.6 - 2.4 * air];
      body = (
        <>
          <Path {...limb} d={bow(H, f1)} />
          <Boot at={f1} />
          <Path {...limb} d={via(H, [24.8, 35.2 - 1.8 * air], f2)} />
          <Boot at={f2} />
          {upper(
            <>
              {swingArm(S, [9.4, 17.8], [7.6, 12.2], k, k2, -0.14)}
              {swingArm(S, [26.6, 17.8], [28.4, 12.2], k, k2, 0.14)}
              {torso}
              {head}
            </>
          )}
        </>
      );
      break;
    }
    case 'flag': {
      const tip: Pt = [lerp(33.6, 34.6, k2), lerp(4.4, 7.4, k2)];
      const mid: Pt = [lerp(30.2, 31.2, k), lerp(3.4, 4.8, k)];
      const f1: Pt = [13.6, 41.6];
      const f2: Pt = [22.2, 41.6];
      body = (
        <>
          <Line {...thin} x1={26.2} y1={3.2} x2={26.2} y2={41.8} />
          <Path d={`M26.2 3.2 Q${mid[0]} ${mid[1]} ${tip[0]} ${tip[1]} L26.2 9.6 Z`} fill={GOLD} />
          <Path {...limb} d={bow(H, f1)} />
          <Boot at={f1} />
          <Path {...limb} d={bow(H, f2)} />
          <Boot at={f2} />
          {upper(
            <>
              <Path {...limb} d={via(S, [12.8, 27.6], [15.8, 30.6])} />
              <Hand at={[15.8, 30.6]} />
              <Path {...limb} d={bow(S, [26, 21.2], 0.08)} />
              {torso}
              {head}
            </>
          )}
        </>
      );
      break;
    }
    case 'hike': {
      const back: Pt = [lerp(11.4, 16, k), 41.5 - 1.8 * Math.sin(Math.PI * k)];
      const knee: Pt = [lerp(23.6, 21.5, k), lerp(35.6, 36, k)];
      const front: Pt = [lerp(25.2, 22, k), 41.4];
      body = (
        <G rotation={8} origin="18, 42">
          <Path {...limb} d={bow(H, back)} />
          <Boot at={back} />
          <Path {...limb} d={via(H, knee, front)} />
          <Boot at={front} />
          {upper(
            <>
              {pack}
              <Line {...thin} x1={24.4} y1={28.6} x2={29.4} y2={40.6} />
              {torso}
              <Path {...limb} d={bow(S, [24.4, 28.6], 0.1)} />
              <Hand at={[24.4, 28.6]} />
              {head}
            </>
          )}
        </G>
      );
      break;
    }
    case 'point': {
      const f1: Pt = [13.2, 41.5];
      const f2: Pt = [26.4, 35.9];
      body = (
        <>
          <Path d="M20.4 42 L22.2 37 L29.6 36.4 L33.2 42 Z" fill={ROCK} />
          <Path {...limb} d={bow(H, f1)} />
          <Boot at={f1} />
          <Path {...limb} d={via(H, [23.8, 34.4], f2)} />
          <Boot at={f2} />
          {upper(
            <>
              {pack}
              {torso}
              {swingArm(S, [29.2, 18.2], [27.6, 12.6], k, k2, 0.12)}
              {head}
            </>
          )}
        </>
      );
      break;
    }
    case 'wave': {
      const f1: Pt = [15.2, 41.5];
      const f2: Pt = [21.2, 41.5];
      body = (
        <>
          <Path {...limb} d={bow(H, f1)} />
          <Boot at={f1} />
          <Path {...limb} d={bow(H, f2)} />
          <Boot at={f2} />
          {upper(
            <>
              {pack}
              <Path {...limb} d={bow(S, [22.2, 31.2], 0.1)} />
              <Hand at={[22.2, 31.2]} />
              {torso}
              {swingArm(S, [27.4, 16.8], [22, 12.6], k, k2, 0.16)}
              {head}
            </>
          )}
        </>
      );
      break;
    }
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
const BUBBLE_W = 164;
const SPLASH_RIGHT = 0.02;  // fraction of logo size from the right edge
const SPLASH_BOTTOM = 0.04; // fraction of logo size above the logo's visible bottom

const STARS = Array.from({ length: 40 }, (_, i) => {
  const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const r2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 12345.6789) % 1;
  const r3 = Math.abs(Math.sin(i * 39.346 + 4.1) * 98765.4321) % 1;
  return { x: r1, y: Math.pow(r2, 1.6), r: 0.5 + r3 * 0.9, group: i % 3 };
});

// ─────────────────────────────────────────────────────────────────────────
//  Tappable hiker + cute quote bubble (pop in / pop out)
// ─────────────────────────────────────────────────────────────────────────
const SPARKS = [
  { side: -1, rise: 20, delay: 0, size: 9 },
  { side: 1, rise: 26, delay: 70, size: 11 },
  { side: -1, rise: 32, delay: 140, size: 7 },
];

type HikerSpotProps = {
  pose: Pose;
  flip?: boolean;
  name: string;
  quote: string;
  px: number;
  py: number;
  figH: number;
  figW: number;
  headRise: number;
  screenW: number;
  isOpen: boolean;
  onPress: () => void;
  label: string;
};

// ─────────────────────────────────────────────────────────────────────────
//  Motion rig: ONE clock drives the body, limbs, squash and lean together,
//  so everything moves as a single smooth, connected motion.
// ─────────────────────────────────────────────────────────────────────────
type Rig = { k: number; k2: number; hop: number; tilt: number; sx: number; lean: number; sy: number };
const REST: Rig = { k: 0, k2: 0, hop: 0, tilt: 0, sx: 0, lean: 0, sy: 1 };
const ACTION_MS: Record<Pose, number> = { cheer: 1100, wave: 1200, flag: 1000, point: 1100, hike: 1200 };

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const osc = (ms: number, period: number) => 0.5 - 0.5 * Math.cos((TAU * ms) / period); // 0 → 1 → 0, no hard edges
const wob = (ms: number, period: number) => Math.sin((TAU * ms) / period);
const arc = (ms: number, period: number) => {
  const u = (((ms % period) + period) % period) / period;
  return 4 * u * (1 - u); // parabola: what a real jump looks like
};

function rigAt(pose: Pose, ms: number, dir: number): Rig {
  const D = ACTION_MS[pose];
  const u = clamp01(ms / D);
  const env = ease(clamp01(Math.min(u / 0.15, (1 - u) / 0.15))); // ease in / ease out of the whole move
  const lag = Math.max(0, ms - 90); // hands & flag trail the body by ~90ms
  const tail = ease(clamp01((D - ms) / 150));

  switch (pose) {
    case 'cheer': {
      const hop = arc(ms, 550); // two jumps
      const squash = ease(clamp01(ms / 80)) * ease(clamp01((D - ms) / 80));
      return {
        k: hop,
        k2: arc(lag, 550) * tail,
        hop,
        tilt: 0,
        sx: 0,
        lean: 0,
        sy: 1 - 0.07 * Math.pow(1 - hop, 6) * squash, // squash on landing
      };
    }
    case 'wave':
      return {
        k: env * osc(ms, 300),
        k2: env * osc(lag, 300) * tail,
        hop: 0.25 * arc(ms, 600),
        tilt: 0.8 * wob(ms, 600) * env,
        sx: 0,
        lean: 3 * wob(ms - 60, 600) * env,
        sy: 1,
      };
    case 'flag':
      return {
        k: env * osc(ms, 260),
        k2: env * osc(lag, 260) * tail,
        hop: 0.3 * arc(ms, 500),
        tilt: 0.6 * wob(ms, 1000),
        sx: 0,
        lean: 2 * wob(ms - 80, 1000) * env,
        sy: 1,
      };
    case 'point':
      return {
        k: env * (0.6 + 0.4 * osc(ms, 550)),
        k2: env * (0.6 + 0.4 * osc(lag, 550)) * tail,
        hop: 0.4 * arc(ms, 550),
        tilt: dir * 0.9 * env,
        sx: 0,
        lean: 0,
        sy: 1,
      };
    case 'hike':
      return {
        k: osc(ms, 300), // stride
        k2: osc(lag, 300) * tail,
        hop: 0.35 * arc(ms, 150), // little bob each step
        tilt: 0,
        sx: osc(ms, D), // glide forward and back
        lean: 0,
        sy: 1,
      };
    default:
      return REST;
  }
}

function HikerSpot({
  pose, flip, name, quote, px, py, figH, figW, headRise, screenW, isOpen, onPress, label,
}: HikerSpotProps) {
  const [shown, setShown] = useState(false);
  const [rig, setRig] = useState<Rig>(REST);
  const [bubbleH, setBubbleH] = useState(44);
  const pop = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const firstRun = useRef(true);
  const acting = useRef(false);
  const raf = useRef<number | null>(null);
  const dir = flip ? -1 : 1;

  const cancelFrame = () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const stopAction = () => {
    acting.current = false;
    cancelFrame();
    setRig(REST);
  };

  const runAction = (onDone: () => void) => {
    const start = Date.now();
    const tick = () => {
      const ms = Date.now() - start;
      if (ms >= ACTION_MS[pose]) {
        raf.current = null;
        setRig(REST);
        onDone();
        return;
      }
      setRig(rigAt(pose, ms, dir));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const showBubble = () => {
    setShown(true);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 170, useNativeDriver: true }).start();
    spark.setValue(0);
    Animated.timing(spark, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  // idle: a slow "breathing" so nobody is ever frozen (each hiker on its own rhythm)
  useEffect(() => {
    const dur = 2400 + (Math.round(px) % 9) * 140;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => loop.start(), (Math.round(px) % 11) * 160);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // 1) do the action  2) then pop the message
      stopAction();
      acting.current = true;
      runAction(() => {
        acting.current = false;
        showBubble();
      });
    } else if (!firstRun.current) {
      if (acting.current) {
        stopAction(); // closed mid-action: cancel, no bubble
      } else {
        // bubble shrinks back into the hiker
        Animated.timing(pop, { toValue: 0, duration: 200, easing: Easing.in(Easing.back(1.8)), useNativeDriver: true }).start(
          ({ finished }) => { if (finished) setShown(false); }
        );
      }
    }
    firstRun.current = false;
  }, [isOpen]);

  useEffect(() => () => cancelFrame(), []);

  // keep the bubble inside the screen, with the tail still pointing at the hiker
  const EDGE = 8;
  const bx = Math.min(Math.max(-BUBBLE_W / 2, EDGE - px), screenW - EDGE - BUBBLE_W - px);
  const tailCenter = Math.min(Math.max(-bx, 14), BUBBLE_W - 14);
  const tailDx = tailCenter - BUBBLE_W / 2;

  // scale pops from the tail (bottom) instead of from the middle
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const bubbleStyle = {
    opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' as const }),
    transform: [
      { translateX: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8 * tailDx, 0] }) },
      { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4 * bubbleH, 0] }) },
      { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '0deg'] }) },
      { scale },
    ],
  };

  // pivot the lean / squash around the FEET (not the middle) so shoes stay planted
  const d = figH * (FEET_Y / VB_H - 0.5);
  const tiltDeg = rig.tilt * 7;
  const th = (tiltDeg * Math.PI) / 180;

  return (
    <View style={[styles.anchor, { left: px, top: py, zIndex: isOpen || shown ? 999 : Math.round(py) }]}>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label}
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
        <Animated.View
          style={{
            transform: [
              { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -0.025 * d] }) },
              { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
            ],
          }}
        >
          <View
            style={{
              transform: [
                { translateX: rig.sx * 6 * dir + d * Math.sin(th) },
                { translateY: -11 * rig.hop + (1 - rig.sy) * d + d * (1 - Math.cos(th)) },
                { rotate: `${tiltDeg}deg` },
                { scaleY: rig.sy },
              ],
            }}
          >
            <Hiker pose={pose} height={figH} flip={flip} k={rig.k} k2={rig.k2} air={rig.hop} lean={rig.lean} />
          </View>
        </Animated.View>
      </Pressable>

      {shown &&
        SPARKS.map((sp, k) => (
          <Animated.Text
            key={k}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: sp.side * (figW / 2 + 5) - sp.size / 2,
              top: -headRise * 0.75,
              fontSize: sp.size,
              color: GOLD,
              opacity: spark.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0], extrapolate: 'clamp' }),
              transform: [
                { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [0, -sp.rise] }) },
                { scale: spark.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 0.6], extrapolate: 'clamp' }) },
              ],
            }}
          >
            ✦
          </Animated.Text>
        ))}

      {shown && (
        <Animated.View
          pointerEvents="none"
          onLayout={(e) => setBubbleH(e.nativeEvent.layout.height)}
          style={[styles.bubbleWrap, { left: bx, bottom: headRise + 8 }, bubbleStyle]}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleQuote}>
              {'\u201C'}{quote}{'\u201D'}
            </Text>
            <Text style={styles.bubbleAuthor} numberOfLines={1}>
              {'\u2014'} {name}
            </Text>
          </View>
          <View style={[styles.bubbleTail, { marginLeft: tailCenter - 5 }]} />
        </Animated.View>
      )}
    </View>
  );
}

// An occasional streak across the upper sky
type ShootingStarProps = {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  delay: number;
  gap: number;
};
function ShootingStar({ startX, startY, dx, dy, delay, gap }: ShootingStarProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(gap),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const angle = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: 90,
        height: 2,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.7, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { rotate: angle },
        ],
      }}
    >
      <Svg width={90} height={2}>
        <Defs>
          <LinearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFF4DC" stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={90} height={2} rx={1} fill="url(#streak)" />
      </Svg>
    </Animated.View>
  );
}

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);
  const [brandH, setBrandH] = useState<number | null>(null);
  const navigating = useRef(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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
  const hintFade   = useRef(new Animated.Value(0)).current;
  const hintPulse  = useRef(new Animated.Value(0)).current;
  const bloom      = useRef(new Animated.Value(0)).current;
  const lineGrow   = useRef(new Animated.Value(0)).current;
  const quoteSlide = useRef(new Animated.Value(10)).current;

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

    // light blooms outward from behind the logo as it appears
    Animated.timing(bloom, { toValue: 1, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

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
        Animated.timing(lineGrow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(quoteFade, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(quoteSlide, { toValue: 0, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      if (isMounted) setReady(true);
    });

    return () => {
      isMounted = false;
      [glowFade, logoFade, logoScale, textFade, textSlide, quoteFade, ridgeFade, starFade, twinkle, bloom, lineGrow, quoteSlide].forEach(v => v.stopAnimation());
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void useAuthStore.getState().loadSession().finally(() => {
      if (isMounted) setAuthRestored(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // "splash text" nudge: only appears once the logo is actually tappable
  const canStart = ready && authRestored;
  useEffect(() => {
    if (!canStart) return;
    Animated.timing(hintFade, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(hintPulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [canStart]);

  const handleStart = () => {
    if (!ready || !authRestored || navigating.current) return;
    navigating.current = true;
    router.replace(isAuthenticated ? '/Loading' : '/Login');
  };

  const scale = screenW / SCENE_W;
  const sceneH = Math.round(SCENE_H * scale);
  const foot = insets.bottom;
  
  const roomH = (brandH ?? screenH - (sceneH + foot)) - insets.top;
  const maxLogo = Math.min(340, screenW * 0.85);
  const logoSize = Math.round(
    Math.min(maxLogo, Math.max(140, (roomH - BRAND_EXTRA - 16) / (1 - LOGO_TRIM)))
  );
  const glowSize = Math.round(logoSize * 1.7);
  const figureScale = Math.min(1.25, Math.max(0.9, screenW / 390));

  const hikers = SPOTS.map((spot, i) => {
    const name = MEMBERS[i];
    if (!name) return null;
    const figH = FIG_BASE * spot.s * figureScale;
    const isOpen = selected === i;

    return (
      <HikerSpot
        key={name + i}
        pose={spot.pose}
        flip={spot.flip}
        name={name}
        quote={QUOTES[i] ?? ''}
        px={spot.x * scale}
        py={ridgeY(RIDGES[spot.layer], spot.x) * scale}
        figH={figH}
        figW={(figH * VB_W) / VB_H}
        headRise={(figH * (FEET_Y - POSE_TOP[spot.pose])) / VB_H}
        screenW={screenW}
        isOpen={isOpen}
        onPress={() => setSelected(isOpen ? null : i)}
        label={isOpen ? 'Hide name' : `Show name of member ${i + 1}`}
      />
    );
  });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* deep night sky, with a faint warm haze low on the horizon */}
        <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#03060B" />
              <Stop offset="0.5" stopColor="#09111F" />
              <Stop offset="1" stopColor="#14223A" />
            </LinearGradient>
            <RadialGradient id="haze" cx="50%" cy="100%" r="70%">
              <Stop offset="0" stopColor={GOLD} stopOpacity={0.1} />
              <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={screenW} height={screenH} fill="url(#sky)" />
          <Rect x={0} y={0} width={screenW} height={screenH} fill="url(#haze)" />
        </Svg>

        <Animated.View style={{ flex: 1, opacity: starFade }}>
          <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
            {STARS.filter(s => s.group === 2).map((st, i) => (
              <Circle key={i} cx={st.x * screenW} cy={st.y * screenH} r={st.r} fill="#FFFFFF" fillOpacity={0.4} />
            ))}
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle }]}>
            <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
              {STARS.filter(s => s.group === 0).map((st, i) => (
                <Circle key={i} cx={st.x * screenW} cy={st.y * screenH} r={st.r + 0.3} fill={GOLD} fillOpacity={0.8} />
              ))}
            </Svg>
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) },
            ]}
          >
            <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
              {STARS.filter(s => s.group === 1).map((st, i) => (
                <Circle key={i} cx={st.x * screenW} cy={st.y * screenH} r={st.r} fill="#EAF1FF" fillOpacity={0.6} />
              ))}
            </Svg>
          </Animated.View>

          <ShootingStar startX={screenW * 0.12} startY={screenH * 0.08} dx={screenW * 0.5} dy={screenH * 0.11} delay={6000} gap={22000} />
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
            disabled={!ready || !authRestored}
            accessibilityRole="button"
            accessibilityLabel="Start the hike"
            style={({ pressed }) => [
              pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
            ]}
          >
            <Animated.View
              style={[
                styles.logoWrap,
                {
                  width: logoSize,
                  height: logoSize,
                  opacity: logoFade,
                  transform: [{ scale: logoScale }],
                },
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
                  transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
                }}
              >
                <Svg width={glowSize} height={glowSize}>
                  <Defs>
                    <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor="#E9CD94" stopOpacity={0.2} />
                      <Stop offset="50%" stopColor={GOLD} stopOpacity={0.06} />
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
              {/* Minecraft-style splash text. Nudge SPLASH_RIGHT / SPLASH_BOTTOM to sit it where you like on the logo */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.splashWrap,
                  { right: logoSize * SPLASH_RIGHT, bottom: logoSize * (LOGO_TRIM + SPLASH_BOTTOM), opacity: hintFade },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.splashText,
                    {
                      transform: [
                        { rotate: '-14deg' },
                        { scale: hintPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
                      ],
                    },
                  ]}
                >
                  Tap Me or Scroll?!
                </Animated.Text>
              </Animated.View>
            </Animated.View>
          </Pressable>

          <Animated.View
            style={[
              styles.nameWrap,
              { marginTop: -logoSize * LOGO_TRIM, opacity: textFade, transform: [{ translateY: textSlide }] },
            ]}
          >
            <View style={styles.dividerRow}>
              <Animated.View
                style={[
                  styles.dividerLine,
                  {
                    opacity: lineGrow,
                    transform: [
                      { translateX: lineGrow.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                      { scaleX: lineGrow },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.dividerDiamond,
                  { opacity: lineGrow, transform: [{ rotate: '45deg' }, { scale: lineGrow }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.dividerLine,
                  {
                    opacity: lineGrow,
                    transform: [
                      { translateX: lineGrow.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
                      { scaleX: lineGrow },
                    ],
                  },
                ]}
              />
            </View>
            <Text style={styles.appSub}>{SUBTITLE}</Text>
          </Animated.View>

          <Animated.View style={[styles.quoteWrap, { opacity: quoteFade, transform: [{ translateY: quoteSlide }] }]}>
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
  splashWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashText: {
    color: '#E9CD94',
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(8, 13, 20, 0.95)',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
  },
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  bubbleWrap: {
    position: 'absolute',
    width: BUBBLE_W,
    alignItems: 'flex-start',
  },
  bubble: {
    width: BUBBLE_W,
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 13, 20, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.6)',
    alignItems: 'center',
  },
  bubbleQuote: {
    color: '#F2E8D5',
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 10.5,
    lineHeight: 13,
    textAlign: 'center',
  },
  bubbleAuthor: {
    marginTop: 3,
    color: GOLD,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(201, 169, 110, 0.6)',
  },
});