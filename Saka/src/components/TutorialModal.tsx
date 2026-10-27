/**
 * TutorialModal — first-time-user walkthrough shared by every screen.
 *
 *   const tutorial = useTutorial('calendar');
 *   ...
 *   <TouchableOpacity onPress={tutorial.open} />   // reopen from an "i" button
 *   {tutorial.element}                              // render once, anywhere in the screen
 *
 * Each step plays a looping mini replica of the real UI (the Events pill, the
 * info badge, a calendar date, a hike card, the photo stack) with a finger
 * showing exactly what to do. People can also swipe the card to move between
 * steps, tap a demo to replay it, and actually try the hold-to-delete gesture
 * on a safe dummy card.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  DEVELOPER SWITCH  →  change TUTORIAL_MODE below
 *
 *    'normal'  Ships like this. Auto-opens once per device, then never again.
 *    'always'  Auto-opens every time the screen mounts. Use to test the tutorial.
 *    'off'     Never auto-opens. Use while building so it stays out of the way.
 *
 *  The "i" buttons still open it by hand in every mode.
 *  To make 'normal' show again after you've already seen it, call
 *  resetAllTutorials() once (e.g. from a dev menu), or clear the app data.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  Vibration,
  Platform,
  StyleSheet,
  useWindowDimensions,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HikeCardFace, getCardShell, CARD_VARIANT } from './HikeCardFace';
import AsyncStorage from '@react-native-async-storage/async-storage'; // ⚠️ install if missing: npx expo install @react-native-async-storage/async-storage

export type TutorialMode = 'normal' | 'always' | 'off';

// 👇 THE DEV HANDLE
export const TUTORIAL_MODE: TutorialMode = 'normal';

// Wait this long after the screen mounts before auto-opening, so the screen
// settles first and the tutorial doesn't fight the navigation transition.
const AUTO_OPEN_DELAY_MS = 600;

const STORAGE_PREFIX = 'saka:tutorial-seen:';

// ── Content ──────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'gold' | 'danger' | 'blue';

/** Which mini scene a step plays. Each one is a small replica of real UI. */
export type SceneKind =
  | 'feed' // swipe sideways through mountain cards
  | 'logo' // tap the "Tara, Saka" logo
  | 'pill' // tap the Events pill
  | 'info' // tap the info icon (with alert badge)
  | 'calTap' // tap a calendar date
  | 'calHold' // hold a calendar date
  | 'legend' // explain icons (uses `legend`)
  | 'cardTap' // tap a hike card to edit
  | 'cardHold' // hold a hike card to delete (tryable)
  | 'cardShared' // blue read-only card
  | 'photos' // swipe the photo stack
  | 'photoZoom' // tap the front photo
  | 'button'; // tap Schedule Hike

export interface TutorialStep {
  scene: SceneKind;
  title: string;
  body: string;
  /** Accent color of the demo. Default 'gold'. */
  tone?: Tone;
  /** Rows for the 'legend' scene. */
  legend?: { icon: IconName; label: string; tone?: Tone }[];
}

export type TutorialId = 'home' | 'calendar' | 'hikes' | 'viewpoint';

export const TUTORIAL_STEPS: Record<TutorialId, TutorialStep[]> = {
  home: [
    {
      scene: 'feed',
      title: 'Flick through the mountains',
      body: 'Swipe sideways to browse the feed. Every mountain plays its own preview.',
    },
    {
      scene: 'logo',
      title: 'Tara, Saka: tap to climb in',
      body: 'Tap the logo to open the mountain on screen and explore its trail and viewpoints.',
    },
    {
      scene: 'pill',
      title: 'See what’s planned',
      body: 'Tap Events to find the hikes and gatherings scheduled on this mountain.',
    },
    {
      scene: 'info',
      title: 'Read up before you go',
      body: 'The info icon opens the trail guide and tips. A number on it means alerts are waiting.',
    },
  ],
  calendar: [
    {
      scene: 'calTap',
      title: 'Pick a day, plan a hike',
      body: 'Tap any date to start scheduling a hike on it.',
    },
    {
      scene: 'calHold',
      title: 'Hold a day to see its hikes',
      body: 'Press and hold a date for a moment to jump to every hike planned for that day.',
    },
    {
      scene: 'legend',
      title: 'Read each day at a glance',
      body: 'Every date tells you two things before you tap it.',
      legend: [
        { icon: 'partly-sunny-outline', label: 'Weather forecast for the day' },
        { icon: 'people-outline', label: 'A hike is scheduled that day' },
      ],
    },
  ],
  hikes: [
    {
      scene: 'cardTap',
      title: 'Tap a card to tweak it',
      body: 'Change the time, dates or group on any hike you created.',
    },
    {
      scene: 'cardHold',
      tone: 'danger',
      title: 'Hold to delete',
      body: 'Keep pressing while the card shakes and the red wipe crosses it. Reaching the far edge deletes it right away, so let go early to cancel.',
    },
    {
      scene: 'cardShared',
      tone: 'blue',
      title: 'Blue cards are someone else’s',
      body: 'Hikes marked Shared are view only. You can look, but not edit or delete.',
    },
  ],
  viewpoint: [
    {
      scene: 'photos',
      title: 'Flip through the photos',
      body: 'Swipe the photo stack up or down to browse this stop.',
    },
    {
      scene: 'photoZoom',
      title: 'Tap for the full picture',
      body: 'Tap the photo in front to see it full size.',
    },
    {
      scene: 'button',
      title: 'Like it? Schedule it',
      body: 'Tap Schedule Hike to pick a date for this mountain.',
    },
  ],
};

/** Label on the final button, so each tour ends with a nudge into the screen. */
const FINISH_LABEL: Record<TutorialId, string> = {
  home: 'Start exploring',
  calendar: 'Plan a hike',
  hikes: 'Got it',
  viewpoint: 'Enjoy the view',
};

// ── The universal help button ────────────────────────────────────────────
// One size everywhere (matches the original Calendar "i" circle: 18px).
// Pass `style` only to position it or give it a backdrop over photos/video.

export function TutorialHelpButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="How to use this screen"
      style={({ pressed }) => [styles.helpBtn, style, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.helpBtnText}>?</Text>
    </Pressable>
  );
}

// ── Persistence + the hook screens actually use ──────────────────────────

export async function resetTutorial(id: TutorialId) {
  try {
    await AsyncStorage.removeItem(STORAGE_PREFIX + id);
  } catch {}
}

export async function resetAllTutorials() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(STORAGE_PREFIX)));
  } catch {}
}

interface UseTutorialOptions {
  /** Hold off auto-opening until this is true (e.g. after a loading screen). */
  ready?: boolean;
}

export function useTutorial(id: TutorialId, { ready = true }: UseTutorialOptions = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || TUTORIAL_MODE === 'off') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const openSoon = () => {
      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, AUTO_OPEN_DELAY_MS);
    };

    if (TUTORIAL_MODE === 'always') {
      openSoon();
    } else {
      AsyncStorage.getItem(STORAGE_PREFIX + id)
        .then((seen) => {
          if (!seen && !cancelled) openSoon();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, ready]);

  const open = useCallback(() => setVisible(true), []);

  const close = useCallback(() => {
    setVisible(false);
    // Mark as seen on any close (finish or skip) so it never nags.
    AsyncStorage.setItem(STORAGE_PREFIX + id, '1').catch(() => {});
  }, [id]);

  const element = (
    <TutorialModal
      visible={visible}
      steps={TUTORIAL_STEPS[id]}
      finishLabel={FINISH_LABEL[id]}
      onClose={close}
    />
  );

  return { visible, open, close, element };
}

// ── Look ─────────────────────────────────────────────────────────────────

const C = {
  card: '#0E1520',
  stage: '#0A111A',
  tile: '#101A29',
  gold: '#C9A96E',
  ink: '#0E1520',
  text: '#FFFFFF',
  body: 'rgba(255,255,255,0.66)',
  hairline: 'rgba(255,255,255,0.08)',
  faint: 'rgba(255,255,255,0.1)',
};

const TONE_RGB: Record<Tone, [number, number, number]> = {
  gold: [201, 169, 110],
  danger: [224, 112, 112],
  blue: [124, 168, 255],
};
const rgba = (tone: Tone, a: number) => {
  const [r, g, b] = TONE_RGB[tone];
  return `rgba(${r},${g},${b},${a})`;
};

const SCENE_W = 232;
const SCENE_H = 128;

// Hike card geometry (cardTap / cardHold / cardShared). The card is the real
// HikeCardFace, so these match the proportions of a card on the Hikes screen.
const CARD_W = 140;
const CARD_H = 98;
const CARD_X = (SCENE_W - CARD_W) / 2;
const CARD_Y = 2;
const DEMO_WEATHER = { name: 'partly-sunny-outline', code: '02d', color: '#F4D48F' };

// Modal shell geometry
const STAGE_H = SCENE_H + 52;
const STAGE_W_LAND = SCENE_W + 48;
const COPY_PAD = 22;
const COPY_TOP = 22;
const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

// Calendar geometry (calTap / calHold)
const COLS = 7;
const CELL_W = 26;
const CELL_H = 24;
const CELL_GAP = 4;
const GRID_X = (SCENE_W - (COLS * CELL_W + (COLS - 1) * CELL_GAP)) / 2;
const GRID_Y = 10;
const TARGET_CELL = 10; // row 1, col 3 → the 19th
const SCHEDULED_CELLS = [4, 15];
const WEATHER: IconName[] = ['partly-sunny-outline', 'sunny-outline', 'rainy-outline', 'cloud-outline'];

const LOOP_MS: Record<SceneKind, number> = {
  feed: 2600,
  logo: 2000,
  pill: 2000,
  info: 2000,
  calTap: 2400,
  calHold: 3000,
  legend: 3600,
  cardTap: 2400,
  cardHold: 3000,
  cardShared: 2400,
  photos: 2600,
  photoZoom: 2800,
  button: 2400,
};

// The frame shown when the person has Reduce Motion on.
const STATIC_T: Partial<Record<SceneKind, number>> = {
  feed: 0.8,
  photos: 0.8,
  calHold: 0.93,
  cardHold: 0.8,
  legend: 0.95,
  cardTap: 0.62,
  cardShared: 0.62,
  calTap: 0.62,
  photoZoom: 0.7,
  button: 0.7,
};

// ── Tiny drawing helpers ─────────────────────────────────────────────────

function Tri({ w, h, color, style }: { w: number; h: number; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: 0,
          height: 0,
          borderLeftWidth: w / 2,
          borderRightWidth: w / 2,
          borderBottomWidth: h,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        },
        style,
      ]}
    />
  );
}

/** A little two-peak ridge, drawn with borders so it needs no assets. */
function Ridge({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size * 1.5, height: size * 0.78 }}>
      <Tri w={size * 0.7} h={size * 0.5} color={color} style={{ position: 'absolute', left: size * 0.8, bottom: 0, opacity: 0.7 }} />
      <Tri w={size} h={size * 0.78} color={color} style={{ position: 'absolute', left: 0, bottom: 0 }} />
    </View>
  );
}

function CalCell({ n, icon, group }: { n: number; icon: IconName; group?: boolean }) {
  return (
    <View style={styles.calCellInner}>
      <Text style={styles.calNum}>{n}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <Ionicons name={icon} size={9} color="rgba(255,255,255,0.55)" />
        {group ? <Ionicons name="people-outline" size={7} color={C.gold} /> : null}
      </View>
    </View>
  );
}

// ── Demo stage: a tiny looping scene of the gesture ──────────────────────

function Stage({ step, reduceMotion }: { step: TutorialStep; reduceMotion: boolean }) {
  const scene = step.scene;
  const tone: Tone = step.tone ?? 'gold';
  const t = useRef(new Animated.Value(0)).current;
  const [replay, setReplay] = useState(0);

  // "Try it" state for the hold-to-delete demo
  const hold = useRef(new Animated.Value(0)).current;
  const [trying, setTrying] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      t.setValue(STATIC_T[scene] ?? 0.45);
      return;
    }
    if (trying) return; // the demo loop pauses while the person is playing
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: LOOP_MS[scene],
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [scene, reduceMotion, trying, replay, t]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      hold.stopAnimation();
    },
    [hold]
  );

  const onHoldIn = () => {
    if (deleted) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setTrying(true);
    Animated.timing(hold, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      Vibration.vibrate(20);
      setDeleted(true);
      resetTimer.current = setTimeout(() => {
        hold.setValue(0);
        setDeleted(false);
        setTrying(false);
      }, 1700);
    });
  };

  const onHoldOut = () => {
    if (deleted) return;
    hold.stopAnimation();
    Animated.timing(hold, { toValue: 0, duration: 220, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      resetTimer.current = setTimeout(() => setTrying(false), 900);
    });
  };

  const map = (input: number[], output: (number | string)[]): any =>
    t.interpolate({ inputRange: input, outputRange: output as any });

  // Shared "tap" timing: finger rises, presses at ~0.4, lifts.
  const fOpacity = map([0, 0.1, 0.88, 1], [0, 1, 1, 0]);
  const tapY = map([0, 0.28, 0.42, 0.56, 1], [30, 0, 0, 0, 30]);
  const tapScale = map([0, 0.28, 0.38, 0.5, 1], [1, 1, 0.8, 1, 1]);
  const pressScale = map([0, 0.3, 0.4, 0.55, 1], [1, 1, 0.94, 1, 1]);
  const pressBorder = map(
    [0, 0.3, 0.4, 0.75, 1],
    [rgba(tone, 0.4), rgba(tone, 0.4), rgba(tone, 1), rgba(tone, 0.4), rgba(tone, 0.4)]
  );
  const ringScale = map([0, 0.38, 1], [0.9, 0.9, 1.8]);
  const ringOpacity = map([0, 0.38, 0.42, 1], [0, 0, 0.55, 0]);
  const chipOpacity = map([0, 0.5, 0.62, 0.9, 1], [0, 0, 1, 1, 0]);
  const chipY = map([0, 0.5, 0.62, 1], [8, 8, 0, 0]);

  const finger = (cx: number, cy: number, ty: any, tx: any, sc: any, op: any = fOpacity) => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.finger,
        {
          left: cx - 10,
          top: cy - 10,
          opacity: op,
          transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
        },
      ]}
    />
  );
  const tapFinger = (cx: number, cy: number) => finger(cx, cy, tapY, 0, tapScale);

  const ring = (x: number, y: number, w: number, h: number, radius: number) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        borderWidth: 1.5,
        borderColor: rgba(tone, 0.8),
        opacity: ringOpacity,
        transform: [{ scale: ringScale }],
      }}
    />
  );

  const chip = (icon: IconName, label: string, opacity: any, ty: any, top = 98) => (
    <Animated.View
      pointerEvents="none"
      style={[styles.chip, { top, opacity, transform: [{ translateY: ty }] }]}
    >
      <Ionicons name={icon} size={11} color={rgba(tone, 1)} />
      <Text style={[styles.chipText, { color: rgba(tone, 1) }]}>{label}</Text>
    </Animated.View>
  );

  let hint: string | null = null;
  let body: React.ReactNode = null;

  switch (scene) {
    // ── Home: swipe the feed ───────────────────────────────────────────
    case 'feed': {
      const CW = 84;
      const CH = 78;
      const GAP = 10;
      const rowX = map([0, 0.18, 0.72, 1], [0, 0, -(CW + GAP), -(CW + GAP)]);
      const rowOpacity = map([0, 0.06, 0.88, 1], [0, 1, 1, 0]);
      const names = ['Madja-as', 'Balinsayaw', 'Pandan Hills', 'Madja-as'];
      body = (
        <>
          <View style={{ position: 'absolute', left: 0, top: (SCENE_H - CH) / 2 - 4, width: SCENE_W, height: CH, overflow: 'hidden' }} pointerEvents="none">
            <Animated.View
              style={{ flexDirection: 'row', paddingLeft: (SCENE_W - CW) / 2, opacity: rowOpacity, transform: [{ translateX: rowX }] }}
            >
              {names.map((n, i) => {
                const borderColor =
                  i === 0
                    ? map([0, 0.18, 0.72, 1], [rgba(tone, 0.95), rgba(tone, 0.95), rgba(tone, 0.3), rgba(tone, 0.3)])
                    : i === 1
                    ? map([0, 0.18, 0.72, 1], [rgba(tone, 0.3), rgba(tone, 0.3), rgba(tone, 0.95), rgba(tone, 0.95)])
                    : rgba(tone, 0.3);
                return (
                  <Animated.View key={i} style={[styles.mCard, { width: CW, height: CH, marginRight: GAP, borderColor }]}>
                    <Ridge size={32} color={rgba(tone, 0.6)} />
                    <Text style={styles.mCardText} numberOfLines={1}>{n}</Text>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
          {finger(
            SCENE_W / 2,
            SCENE_H / 2 + 18,
            0,
            map([0, 0.18, 0.72, 1], [26, 26, -26, -26]),
            map([0, 0.18, 0.26, 0.72, 1], [1, 1, 0.82, 0.82, 1])
          )}
        </>
      );
      break;
    }

    // ── Home: the logo ─────────────────────────────────────────────────
    case 'logo': {
      const D = 66;
      const x = (SCENE_W - D) / 2;
      const y = 16;
      body = (
        <>
          {ring(x, y, D, D, D / 2)}
          <Animated.View
            style={[styles.logoCircle, { left: x, top: y, width: D, height: D, borderRadius: D / 2, borderColor: pressBorder, transform: [{ scale: pressScale }] }]}
          >
            <Ridge size={34} color={rgba(tone, 1)} />
          </Animated.View>
          <Text style={styles.logoLabel}>Tara, Saka</Text>
          {tapFinger(SCENE_W / 2, y + D / 2 + 6)}
        </>
      );
      break;
    }

    // ── Home: the Events pill ──────────────────────────────────────────
    case 'pill': {
      const top = 36;
      const H = 24;
      const evX = 156;
      const evW = 58;
      body = (
        <>
          <View style={[styles.metaPill, { left: 18, top, width: 66, height: H, borderColor: '#F0A500' }]}>
            <View style={styles.metaDot} />
            <Text style={[styles.metaText, { color: '#F0A500' }]}>Moderate</Text>
          </View>
          <View style={[styles.metaPill, { left: 90, top, width: 60, height: H, borderColor: C.faint }]}>
            <Ionicons name="trending-up-outline" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.metaText, { color: 'rgba(255,255,255,0.7)' }]}>812 m</Text>
          </View>
          {ring(evX, top, evW, H, H / 2)}
          <Animated.View
            style={[styles.metaPill, { left: evX, top, width: evW, height: H, borderColor: pressBorder, transform: [{ scale: pressScale }] }]}
          >
            <Ionicons name="calendar-outline" size={10} color={rgba(tone, 1)} />
            <Text style={[styles.metaText, { color: rgba(tone, 1) }]}>Events</Text>
          </Animated.View>
          <Text style={styles.sceneName}>Mt. Madja-as</Text>
          <View style={[styles.descBar, { top: 94, width: 168 }]} />
          <View style={[styles.descBar, { top: 104, width: 120 }]} />
          {tapFinger(evX + evW / 2, top + H / 2 + 4)}
        </>
      );
      break;
    }

    // ── Home: the info icon + alert badge ──────────────────────────────
    case 'info': {
      const ix = 142;
      const iy = 44;
      body = (
        <>
          <View style={[styles.metaPill, { left: 18, top: 18, width: 66, height: 20, borderColor: '#F0A500', opacity: 0.6 }]}>
            <View style={styles.metaDot} />
            <Text style={[styles.metaText, { color: '#F0A500' }]}>Moderate</Text>
          </View>
          <Text style={[styles.sceneName, { top: 46 }]}>Mt. Madja-as</Text>
          {ring(ix, iy, 26, 26, 13)}
          <Animated.View style={{ position: 'absolute', left: ix, top: iy, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressScale }] }}>
            <Ionicons name="information-circle-outline" size={24} color={rgba(tone, 1)} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </Animated.View>
          <View style={[styles.descBar, { top: 88, width: 168 }]} />
          <View style={[styles.descBar, { top: 98, width: 120 }]} />
          {tapFinger(ix + 13, iy + 17)}
        </>
      );
      break;
    }

    // ── Calendar: tap / hold a date ────────────────────────────────────
    case 'calTap':
    case 'calHold': {
      const isHold = scene === 'calHold';
      const tr = Math.floor(TARGET_CELL / COLS);
      const tc = TARGET_CELL % COLS;
      const tx = GRID_X + tc * (CELL_W + CELL_GAP);
      const ty = GRID_Y + tr * (CELL_H + CELL_GAP);
      const cx = tx + CELL_W / 2;
      const cy = ty + CELL_H / 2;
      const fillW = map([0, 0.12, 0.3, 0.6, 0.62, 1], [0, 0, CELL_W, CELL_W, 0, 0]);
      const holdBorder = map([0, 0.1, 0.3, 0.6, 1], [rgba(tone, 0.4), rgba(tone, 1), rgba(tone, 1), rgba(tone, 0.4), rgba(tone, 0.4)]);
      body = (
        <>
          {Array.from({ length: COLS * 3 }, (_, i) => {
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            return (
              <View
                key={i}
                style={[styles.calCell, { left: GRID_X + c * (CELL_W + CELL_GAP), top: GRID_Y + r * (CELL_H + CELL_GAP) }]}
              >
                <CalCell n={9 + i} icon={WEATHER[i % WEATHER.length]} group={SCHEDULED_CELLS.includes(i)} />
              </View>
            );
          })}
          {isHold ? null : ring(tx, ty, CELL_W, CELL_H, 7)}
          <Animated.View
            style={[
              styles.calCell,
              styles.calCellTarget,
              { left: tx, top: ty, borderColor: isHold ? holdBorder : pressBorder, transform: [{ scale: isHold ? 1 : pressScale }] },
            ]}
          >
            {isHold ? <Animated.View style={[styles.fillLeft, { width: fillW, backgroundColor: rgba(tone, 0.32) }]} /> : null}
            <CalCell n={9 + TARGET_CELL} icon={WEATHER[TARGET_CELL % WEATHER.length]} />
          </Animated.View>
          {isHold
            ? chip('list-outline', 'Opens that day’s hikes', map([0, 0.32, 0.4, 0.85, 0.95, 1], [0, 0, 1, 1, 0, 0]), map([0, 0.32, 0.4, 1], [8, 8, 0, 0]))
            : chip('add-circle-outline', 'New hike on the 19th', chipOpacity, chipY)}
          {isHold
            ? finger(
                cx,
                cy + 4,
                map([0, 0.1, 0.6, 0.7, 1], [30, 0, 0, 30, 30]),
                0,
                map([0, 0.1, 0.16, 0.6, 1], [1, 1, 0.8, 0.8, 1]),
                map([0, 0.1, 0.62, 0.7, 1], [0, 1, 1, 0, 0])
              )
            : tapFinger(cx, cy + 4)}
        </>
      );
      break;
    }

    // ── Calendar: icon legend ──────────────────────────────────────────
    case 'legend': {
      const rows = step.legend ?? [];
      const rowH = 40;
      const top0 = (SCENE_H - rows.length * rowH) / 2;
      body = (
        <>
          {rows.map((r, i) => {
            const a = 0.05 + 0.22 * i;
            const rt: Tone = r.tone ?? tone;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.legendRow,
                  {
                    top: top0 + i * rowH,
                    opacity: map([0, a, a + 0.12, 0.9, 1], [0, 0, 1, 1, 0]),
                    transform: [{ translateX: map([0, a, a + 0.12, 1], [10, 10, 0, 0]) }],
                  },
                ]}
              >
                <View style={[styles.legendIcon, { borderColor: rgba(rt, 0.5) }]}>
                  <Ionicons name={r.icon} size={17} color={rgba(rt, 1)} />
                </View>
                <Text style={styles.legendText}>{r.label}</Text>
              </Animated.View>
            );
          })}
        </>
      );
      break;
    }

    // ── Hikes: tap / hold / shared ─────────────────────────────────────
    // The card is the real HikeCardFace inside the real card shell, so what
    // people practise on is exactly what they will see on the Hikes screen.
    case 'cardTap':
    case 'cardHold':
    case 'cardShared': {
      const isHold = scene === 'cardHold';
      const isShared = scene === 'cardShared';
      const canEdit = !isShared;
      const shell = getCardShell(CARD_VARIANT, canEdit);
      const restBorder = shell.borderColor as string;
      const HOT = 'rgba(235,87,87,0.95)';
      const cx = SCENE_W / 2;
      const cy = CARD_Y + CARD_H / 2;
      const belowCard = CARD_Y + CARD_H + 4;

      const fillWidth = trying
        ? hold.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_W] })
        : map([0, 0.14, 0.28, 0.45, 0.65, 0.84, 1], [0, 0, 0.55, 0.78, 0.9, 1, 1].map((v) => v * CARD_W));
      const WIPE = ['rgba(242,153,74,0.5)', 'rgba(235,87,87,0.55)', 'rgba(165,34,43,0.7)', 'rgba(74,14,14,0.92)'];
      const fillColor = trying
        ? hold.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: WIPE })
        : map([0, 0.14, 0.35, 0.6, 0.84, 1], [WIPE[0], WIPE[0], WIPE[1], WIPE[2], WIPE[3], WIPE[3]]);
      const SH_IN = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
      const SH_OUT = [0, -2, 2, -2.5, 2.5, -3, 3, -3, 3, -3, 0];
      const cardShake = trying
        ? hold.interpolate({ inputRange: SH_IN, outputRange: SH_OUT })
        : map([0, ...SH_IN.map((v) => 0.14 + v * 0.7), 1], [0, ...SH_OUT, 0]);
      const trashOpacity = trying
        ? hold.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] })
        : map([0, 0.4, 0.88, 1], [0, 0, 1, 1]);
      const holdBorder = trying
        ? hold.interpolate({ inputRange: [0, 0.35, 1], outputRange: [restBorder, HOT, HOT] })
        : map([0, 0.14, 0.45, 0.85, 1], [restBorder, restBorder, HOT, HOT, restBorder]);
      const shake = map([0, 0.4, 0.44, 0.48, 0.52, 0.56, 1], [0, 0, -3, 3, -2, 0, 0]);

      const face = (
        <>
          <HikeCardFace
            variant={CARD_VARIANT}
            canEdit={canEdit}
            hikeId="demo-4f2a"
            timePrimary={isShared ? '6:00A' : '4:30A'}
            timeSecondary={isShared ? 'until 2:00P' : 'until 9:00A'}
            dateText="Nov 21"
            group={isShared ? 8 : 6}
            weather={DEMO_WEATHER}
          />
          {isHold ? (
            <>
              <Animated.View pointerEvents="none" style={[styles.fillLeft, { width: fillWidth, backgroundColor: fillColor }]} />
              <Animated.View pointerEvents="none" style={[styles.trash, { opacity: trashOpacity }]}>
                <Ionicons name="trash-outline" size={13} color="#FFF" />
              </Animated.View>
            </>
          ) : null}
          {deleted ? (
            <View style={styles.deletedOverlay}>
              <Ionicons name="checkmark-circle" size={18} color={rgba(tone, 1)} />
              <Text style={[styles.deletedText, { color: rgba(tone, 1) }]}>Deleted</Text>
            </View>
          ) : null}
        </>
      );

      if (isHold) {
        hint = deleted
          ? 'Gone, no confirmation. (Demo only.)'
          : trying
          ? 'Keep holding…'
          : 'Your turn: press and hold the card';
      }

      body = (
        <>
          {isHold ? (
            <Pressable
              onPressIn={onHoldIn}
              onPressOut={onHoldOut}
              style={{ position: 'absolute', left: CARD_X, top: CARD_Y, width: CARD_W, height: CARD_H }}
            >
              <Animated.View
                style={[styles.hikeCard, shell, { width: CARD_W, height: CARD_H, borderColor: holdBorder, transform: [{ translateX: cardShake }] }]}
              >
                {face}
              </Animated.View>
            </Pressable>
          ) : (
            <>
              {ring(CARD_X, CARD_Y, CARD_W, CARD_H, (shell.borderRadius as number) ?? 4)}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.hikeCard,
                  shell,
                  {
                    position: 'absolute',
                    left: CARD_X,
                    top: CARD_Y,
                    width: CARD_W,
                    height: CARD_H,
                    transform: [{ scale: isShared ? 1 : pressScale }, { translateX: isShared ? shake : 0 }],
                  },
                ]}
              >
                {face}
              </Animated.View>
            </>
          )}

          {!isHold && !isShared ? chip('create-outline', 'Edit hike', chipOpacity, chipY, belowCard) : null}
          {isShared ? chip('eye-outline', 'View only', chipOpacity, chipY, belowCard) : null}
          {isHold && hint ? <Text style={[styles.hint, { top: belowCard + 3, color: rgba(tone, 0.9) }]}>{hint}</Text> : null}

          {isHold
            ? trying
              ? null
              : finger(
                  cx - 14,
                  cy + 12,
                  map([0, 0.1, 0.9, 1], [34, 0, 0, 34]),
                  0,
                  map([0, 0.1, 0.16, 0.9, 1], [1, 1, 0.8, 0.8, 1])
                )
            : tapFinger(cx - 14, cy + 12)}
        </>
      );
      break;
    }

    // ── Viewpoint: photo stack ─────────────────────────────────────────
    case 'photos':
    case 'photoZoom': {
      const isZoom = scene === 'photoZoom';
      const PW = 124;
      const PH = 74;
      const left = (SCENE_W - PW) / 2;
      const top = 24;

      const stackOpacity = isZoom ? 1 : map([0, 0.06, 0.9, 1], [0, 1, 1, 0]);
      const frontY = isZoom ? 0 : map([0, 0.18, 0.72, 1], [0, 0, -46, -46]);
      const frontOpacity = isZoom ? 1 : map([0, 0.18, 0.62, 0.72, 1], [1, 1, 1, 0, 0]);
      const midScale = isZoom ? 0.92 : map([0, 0.18, 0.72, 1], [0.92, 0.92, 1, 1]);
      const midY = isZoom ? 10 : map([0, 0.18, 0.72, 1], [10, 10, 0, 0]);
      const backScale = isZoom ? 0.84 : map([0, 0.18, 0.72, 1], [0.84, 0.84, 0.92, 0.92]);
      const backY = isZoom ? 20 : map([0, 0.18, 0.72, 1], [20, 20, 10, 10]);
      const zoomScale = map([0, 0.4, 0.55, 0.85, 1], [1, 1, 1.32, 1.32, 1]);
      const zoomBorder = map([0, 0.4, 0.55, 0.85, 1], [rgba(tone, 0.55), rgba(tone, 0.55), rgba(tone, 1), rgba(tone, 1), rgba(tone, 0.55)]);

      const photo = (key: string, scale: any, ty: any, opacity: any, borderColor: any, withSun: boolean, extra?: React.ReactNode) => (
        <Animated.View
          key={key}
          style={[
            styles.photo,
            { left, top, width: PW, height: PH, borderColor, opacity, transform: [{ translateY: ty }, { scale }] },
          ]}
        >
          {withSun ? <View style={[styles.sun, { backgroundColor: rgba(tone, 0.85) }]} /> : null}
          <Ridge size={50} color={rgba(tone, 0.5)} />
          {extra}
        </Animated.View>
      );

      body = (
        <>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: SCENE_W, height: SCENE_H, opacity: stackOpacity }} pointerEvents="none">
            {photo('c', backScale, backY, 1, rgba(tone, 0.3), false)}
            {photo('b', midScale, midY, 1, rgba(tone, 0.4), false)}
            {photo(
              'a',
              isZoom ? zoomScale : 1,
              frontY,
              frontOpacity,
              isZoom ? zoomBorder : rgba(tone, 0.8),
              true,
              isZoom ? (
                <Animated.View
                  style={{ position: 'absolute', right: 6, top: 6, opacity: map([0, 0.5, 0.6, 0.85, 1], [0, 0, 1, 1, 0]) }}
                >
                  <Ionicons name="expand-outline" size={13} color={rgba(tone, 1)} />
                </Animated.View>
              ) : null
            )}
          </Animated.View>
          {isZoom
            ? tapFinger(SCENE_W / 2, top + PH / 2 + 8)
            : finger(
                SCENE_W / 2,
                top + PH / 2 + 12,
                map([0, 0.18, 0.72, 0.88, 1], [14, 0, -36, -36, -36]),
                0,
                map([0, 0.18, 0.26, 0.72, 1], [1, 1, 0.82, 0.82, 1])
              )}
        </>
      );
      break;
    }

    // ── Viewpoint: Schedule Hike button ────────────────────────────────
    case 'button': {
      const BW = 156;
      const BH = 36;
      const bx = (SCENE_W - BW) / 2;
      const by = 30;
      body = (
        <>
          {ring(bx, by, BW, BH, 12)}
          <Animated.View
            style={[styles.bigButton, { left: bx, top: by, width: BW, height: BH, backgroundColor: rgba(tone, 1), transform: [{ scale: pressScale }] }]}
          >
            <Ionicons name="calendar-outline" size={14} color={C.ink} />
            <Text style={styles.bigButtonText}>Schedule Hike</Text>
          </Animated.View>
          {chip('calendar-number-outline', 'Pick your date', chipOpacity, chipY, 84)}
          {tapFinger(SCENE_W / 2 + 20, by + BH / 2 + 4)}
        </>
      );
      break;
    }
  }

  return (
    <Pressable
      style={styles.scene}
      onPress={() => setReplay((r) => r + 1)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.glow, { backgroundColor: rgba(tone, 0.07) }]} pointerEvents="none" />
      {body}
    </Pressable>
  );
}

// ── Shell pieces ─────────────────────────────────────────────────────────

/** Faint topographic rings behind the demo, so the stage reads as a map, not a box. */
const CONTOURS = [
  { w: 120, rot: -8, a: 0.1 },
  { w: 176, rot: 6, a: 0.08 },
  { w: 236, rot: -4, a: 0.06 },
  { w: 300, rot: 8, a: 0.045 },
  { w: 370, rot: -6, a: 0.03 },
];

function Contours() {
  return (
    <View pointerEvents="none" style={styles.contourAnchor}>
      {CONTOURS.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: -r.w / 2,
            top: -(r.w * 0.62) / 2,
            width: r.w,
            height: r.w * 0.62,
            borderRadius: r.w / 2,
            borderWidth: 1,
            borderColor: rgba('gold', r.a),
            transform: [{ rotate: `${r.rot}deg` }],
          }}
        />
      ))}
    </View>
  );
}

/** One segment per step: past steps dim gold, the current one bright. */
function Progress({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.progress} accessible accessibilityLabel={`Step ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.seg, i < index && styles.segDone, i === index && styles.segActive]} />
      ))}
    </View>
  );
}

// ── The modal ────────────────────────────────────────────────────────────

interface TutorialModalProps {
  visible: boolean;
  steps: TutorialStep[];
  onClose: () => void;
  /** Label for the last step's button. Default 'Got it'. */
  finishLabel?: string;
}

export default function TutorialModal({ visible, steps, onClose, finishLabel = 'Got it' }: TutorialModalProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const cardWidth = landscape ? Math.min(width - 48, 560) : Math.min(width - 32, 360);

  // Reserve room for the longest step's text so the card (and the Next
  // button) stay put as people move between steps instead of jumping.
  const textWidth = (landscape ? cardWidth - STAGE_W_LAND : cardWidth) - COPY_PAD * 2;
  const copyMinH = useMemo(() => {
    const lines = (chars: number, px: number) => Math.max(1, Math.ceil((chars * px) / textWidth));
    let h = 0;
    for (const s of steps) {
      h = Math.max(h, lines(s.title.length, 10.6) * 26 + 8 + lines(s.body.length, 7.4) * 21);
    }
    return h + COPY_TOP;
  }, [steps, textWidth]);

  const [mounted, setMounted] = useState(visible);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const closing = useRef(false);

  // Swipe the card sideways to move between steps (always current via ref).
  const nav = useRef({ next: () => {}, back: () => {} });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) nav.current.next();
        else if (g.dx > 40) nav.current.back();
      },
    })
  ).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      setMounted(true);
      setIndex(0);
      enter.setValue(0);
      swap.setValue(1);
      Animated.parallel([
        reduceMotion
          ? Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true })
          : Animated.spring(enter, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
      ]).start();
    } else if (mounted && !closing.current) {
      setMounted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    enter.stopAnimation();
    Animated.parallel([
      Animated.timing(enter, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  }, [enter, onClose]);

  const playSwap = () => {
    swap.setValue(0);
    Animated.timing(swap, {
      toValue: 1,
      duration: reduceMotion ? 120 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const next = () => {
    if (index >= steps.length - 1) {
      dismiss();
      return;
    }
    dir.current = 1;
    setIndex((i) => i + 1);
    playSwap();
  };

  const back = () => {
    if (index === 0) return;
    dir.current = -1;
    setIndex((i) => i - 1);
    playSwap();
  };

  // Swiping never finishes the tour by accident; only the button does that.
  nav.current = {
    next: () => {
      if (index < steps.length - 1) next();
    },
    back,
  };

  if (!mounted || steps.length === 0) return null;

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index === steps.length - 1;

  const cardTranslateY = enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 32, 0] });
  const cardScale = enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.94, 1] });
  const cardOpacity = enter.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' });
  const textShift = swap.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 14 * dir.current, 0] });

  const stage = (
    <View style={[styles.stagePanel, landscape && styles.stagePanelLandscape]}>
      <Contours />
      <Animated.View style={{ opacity: swap }}>
        <Stage key={index} step={step} reduceMotion={reduceMotion} />
      </Animated.View>
      <Progress count={steps.length} index={index} />
      <Pressable
        onPress={dismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isLast ? 'Close tutorial' : 'Skip tutorial'}
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.75)" />
      </Pressable>
    </View>
  );

  const copy = (
    <View style={[styles.copy, { minHeight: copyMinH }]}>
      <Animated.View style={{ opacity: swap, transform: [{ translateX: textShift }] }}>
        <Text style={styles.title} accessibilityRole="header">{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
      </Animated.View>
    </View>
  );

  const footer = (
    <View>
      <View style={styles.perf} />
      <View style={styles.footer}>
        {index > 0 ? (
          <Pressable
            onPress={back}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Previous tip"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish tutorial' : 'Next tip'}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.primaryText}>{isLast ? finishLabel : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    // A real Modal = its own window, so it always sits above everything
    // (including native video). A soft scrim dims the screen behind the card;
    // tapping it does nothing, so the tour can't be dismissed by accident.
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]} />
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.cardOuter,
            { width: cardWidth, opacity: cardOpacity, transform: [{ translateY: cardTranslateY }, { scale: cardScale }] },
          ]}
        >
          <View style={styles.card}>
            {landscape ? (
              <View style={styles.landscapeRow}>
                {stage}
                <View style={styles.landscapeText}>
                  {copy}
                  {footer}
                </View>
              </View>
            ) : (
              <>
                {stage}
                {copy}
                {footer}
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(4,8,13,0.66)' },
  cardOuter: {
    borderRadius: 24,
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Help button
  helpBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Stage: full-bleed, no inner box
  stagePanel: {
    backgroundColor: C.stage,
    alignItems: 'center',
    justifyContent: 'center',
    height: STAGE_H,
    overflow: 'hidden',
  },
  stagePanelLandscape: { width: STAGE_W_LAND, height: undefined, alignSelf: 'stretch', minHeight: STAGE_H },
  contourAnchor: { position: 'absolute', left: '50%', top: '56%', width: 0, height: 0 },
  progress: { position: 'absolute', top: 24, left: 20, right: 64, flexDirection: 'row', gap: 5 },
  seg: { flex: 1, maxWidth: 40, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  segDone: { backgroundColor: 'rgba(201,169,110,0.5)' },
  segActive: { backgroundColor: C.gold },
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scene: { width: SCENE_W, height: SCENE_H },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    left: (SCENE_W - 150) / 2,
    top: (SCENE_H - 150) / 2,
  },
  finger: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  fillLeft: { position: 'absolute', left: 0, top: 0, bottom: 0 },

  // Feed
  mCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mCardText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },

  // Logo
  logoCircle: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: C.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 94,
    textAlign: 'center',
    color: C.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Home meta row
  metaPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metaDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F0A500' },
  metaText: { fontSize: 9.5, fontWeight: '700' },
  sceneName: { position: 'absolute', left: 18, top: 70, color: C.text, fontSize: 17, fontWeight: '800' },
  descBar: { position: 'absolute', left: 18, height: 5, borderRadius: 3, backgroundColor: C.faint },
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(224,112,112,1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: C.ink, fontSize: 8, fontWeight: '800', includeFontPadding: false },

  // Calendar
  calCell: {
    position: 'absolute',
    width: CELL_W,
    height: CELL_H,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  calCellTarget: { borderWidth: 1.5, backgroundColor: C.tile, overflow: 'hidden' },
  calCellInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  calNum: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', includeFontPadding: false },

  // Legend
  legendRow: { position: 'absolute', left: 18, right: 18, height: 34, flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  // Hike card (the real HikeCardFace lives inside)
  hikeCard: { borderWidth: 1, overflow: 'hidden' },
  trash: { position: 'absolute', right: 8, bottom: 8 },
  deletedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,21,32,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deletedText: { fontSize: 12, fontWeight: '800' },
  hint: { position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center', fontSize: 10.5, fontWeight: '600' },

  // Result chip (appears after a tap)
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    left: 36,
    right: 36,
    height: 22,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.hairline,
  },
  chipText: { fontSize: 10, fontWeight: '700' },

  // Photos
  photo: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    overflow: 'hidden',
  },
  sun: { position: 'absolute', top: 10, left: 14, width: 12, height: 12, borderRadius: 6 },

  // Button
  bigButton: {
    position: 'absolute',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bigButtonText: { color: C.ink, fontSize: 12, fontWeight: '800' },

  // Copy
  copy: { paddingHorizontal: COPY_PAD, paddingTop: COPY_TOP },
  title: {
    color: C.text,
    fontFamily: SERIF,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: { color: 'rgba(255,255,255,0.7)', fontSize: 14.5, lineHeight: 21, marginTop: 8 },
  landscapeRow: { flexDirection: 'row' },
  landscapeText: { flex: 1, justifyContent: 'space-between' },

  // Footer
  perf: {
    marginHorizontal: 16,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: 'rgba(201,169,110,0.28)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: COPY_PAD,
    paddingTop: 16,
    paddingBottom: 22,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: C.ink, fontSize: 15, fontWeight: '700' },
});