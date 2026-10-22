/**
 * TutorialModal — first-time-user walkthrough shared by every screen.
 *
 *   const tutorial = useTutorial('calendar');
 *   ...
 *   <TouchableOpacity onPress={tutorial.open} />   // reopen from an "i" button
 *   {tutorial.element}                              // render once, anywhere in the screen
 *
 * Each step shows a tiny looping demo of the gesture (tap, hold, swipe) so
 * people see what to do instead of reading about it.
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
type Gesture = 'tap' | 'hold' | 'swipe' | 'swipeH' | 'look';
type Tone = 'gold' | 'danger' | 'blue';

export interface TutorialStep {
  icon: IconName;
  title: string;
  body: string;
  /** What the little demo animates. Default 'look'. */
  gesture?: Gesture;
  /** Accent color of the demo. Default 'gold'. */
  tone?: Tone;
}

export type TutorialId = 'home' | 'calendar' | 'hikes' | 'viewpoint';

export const TUTORIAL_STEPS: Record<TutorialId, TutorialStep[]> = {
  home: [
    {
      icon: 'swap-horizontal-outline',
      gesture: 'swipeH',
      title: 'Swipe to switch mountains',
      body: 'Slide left or right to browse every mountain in the feed.',
    },
    {
      icon: 'compass-outline',
      gesture: 'tap',
      title: 'Tap Tara, Saka to explore',
      body: 'Tap the Saka logo to open the mountain you’re viewing.',
    },
    {
      icon: 'calendar-outline',
      gesture: 'tap',
      title: 'Tap Events to see what’s planned',
      body: 'Find the hikes and events scheduled on this mountain.',
    },
    {
      icon: 'information-circle-outline',
      gesture: 'tap',
      title: 'Tap the info icon for tips',
      body: 'Read the trail guide before you head out.',
    },
  ],
  calendar: [
    {
      icon: 'calendar-outline',
      gesture: 'tap',
      title: 'Tap a date to plan a hike',
      body: 'Pick any day to schedule a new hike on it.',
    },
    {
      icon: 'list-outline',
      gesture: 'hold',
      title: 'Hold a date to see its hikes',
      body: 'Press and hold a day to open every hike planned for it.',
    },
    {
      icon: 'partly-sunny-outline',
      gesture: 'look',
      title: 'Read each day at a glance',
      body: 'The weather icon is the forecast. A small group icon means a hike is already scheduled.',
    },
  ],
  hikes: [
    {
      icon: 'trail-sign-outline',
      gesture: 'tap',
      title: 'Tap a card to edit',
      body: 'Change the time, dates or group for any hike you created.',
    },
    {
      icon: 'trash-outline',
      gesture: 'hold',
      tone: 'danger',
      title: 'Hold a card to delete',
      body: 'Keep holding until the red fill reaches the far edge. Let go early to cancel.',
    },
    {
      icon: 'eye-outline',
      gesture: 'look',
      tone: 'blue',
      title: 'Blue cards belong to others',
      body: 'Hikes marked Shared are view only. You can’t edit or delete them.',
    },
  ],
  viewpoint: [
    {
      icon: 'images-outline',
      gesture: 'swipe',
      title: 'Flip through the photos',
      body: 'Swipe the photo stack up or down to browse this stop.',
    },
    {
      icon: 'expand-outline',
      gesture: 'tap',
      title: 'Tap a photo to enlarge it',
      body: 'Tap the photo in front to see it full size.',
    },
    {
      icon: 'calendar-outline',
      gesture: 'tap',
      title: 'Schedule a hike from here',
      body: 'Tap Schedule Hike to pick a date for this mountain.',
    },
  ],
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
    <TutorialModal visible={visible} steps={TUTORIAL_STEPS[id]} onClose={close} />
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
const WHITE_EDGE = 'rgba(255,255,255,0.12)';

const SCENE_W = 148;
const SCENE_H = 116;
const TILE = 64;
const TILE_LEFT = (SCENE_W - TILE) / 2;
const TILE_TOP = 20;

const LOOP_MS: Record<Gesture, number> = { tap: 1900, hold: 2800, swipe: 2300, swipeH: 2300, look: 2200 };

// ── Demo stage: a tiny looping scene of the gesture ──────────────────────

function Stage({ step, reduceMotion }: { step: TutorialStep; reduceMotion: boolean }) {
  const kind: Gesture = step.gesture ?? 'look';
  const tone: Tone = step.tone ?? 'gold';
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      // Static frame that still shows the idea (pressed / filled)
      t.setValue(kind === 'hold' || kind === 'swipe' || kind === 'swipeH' ? 0.8 : 0.45);
      return;
    }
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: LOOP_MS[kind],
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [kind, reduceMotion, t]);

  const map = (input: number[], output: (number | string)[]) =>
    t.interpolate({ inputRange: input, outputRange: output });

  // Finger: rises in, presses, leaves. Same envelope for every gesture.
  const fingerOpacity = map([0, 0.1, 0.88, 1], [0, 1, 1, 0]);
  let fingerY: any = 0;
  let fingerX: any = 0;
  let fingerScale: any = 1;
  const isSwipe = kind === 'swipe' || kind === 'swipeH';

  // Tile state
  let tileBorder: Animated.AnimatedInterpolation<number | string> | string = rgba(tone, 0.4);
  let tileScale: Animated.AnimatedInterpolation<number | string> | number = 1;
  let rippleScale: Animated.AnimatedInterpolation<number | string> | number = 1;
  let rippleOpacity: Animated.AnimatedInterpolation<number | string> | number = 0;
  let fillWidth: Animated.AnimatedInterpolation<number | string> | number = 0;

  if (kind === 'tap') {
    fingerY = map([0, 0.28, 0.42, 0.56, 1], [34, 0, 0, 0, 34]);
    fingerScale = map([0, 0.28, 0.38, 0.5, 1], [1, 1, 0.8, 1, 1]);
    tileBorder = map([0, 0.3, 0.4, 0.75, 1], [rgba(tone, 0.4), rgba(tone, 0.4), rgba(tone, 1), rgba(tone, 0.4), rgba(tone, 0.4)]);
    tileScale = map([0, 0.3, 0.4, 0.55, 1], [1, 1, 0.94, 1, 1]);
    rippleScale = map([0.38, 1], [0.95, 1.9]);
    rippleOpacity = map([0, 0.38, 0.42, 1], [0, 0, 0.55, 0]);
  } else if (kind === 'hold') {
    fingerY = map([0, 0.1, 0.9, 1], [34, 0, 0, 34]);
    fingerScale = map([0, 0.1, 0.16, 0.9, 1], [1, 1, 0.8, 0.8, 1]);
    tileBorder = map([0, 0.12, 0.85, 1], [rgba(tone, 0.4), rgba(tone, 1), rgba(tone, 1), rgba(tone, 0.4)]);
    fillWidth = map([0, 0.14, 0.84, 1], [0, 0, TILE, TILE]);
  } else if (isSwipe) {
    if (kind === 'swipeH') {
      fingerX = map([0, 0.18, 0.72, 1], [30, 30, -30, -30]);
    } else {
      fingerY = map([0, 0.18, 0.72, 0.88, 1], [16, 0, -30, -30, -30]);
    }
    fingerScale = map([0, 0.18, 0.26, 0.72, 1], [1, 1, 0.82, 0.82, 1]);
  } else {
    fingerY = map([0, 1], [34, 34]);
    tileScale = map([0, 0.5, 1], [1, 1.08, 1]);
    rippleScale = map([0, 1], [0.95, 1.7]);
    rippleOpacity = map([0, 0.25, 1], [0, 0.45, 0]);
    tileBorder = rgba(tone, 0.7);
  }

  // Swipe: a short column of photo cards that slides up under the finger.
  const columnY = map([0, 0.18, 0.72, 1], [0, 0, -44, -44]);
  const columnOpacity = map([0, 0.06, 0.88, 1], [0, 1, 1, 0]);
  // Home: the same idea sideways
  const rowX = map([0, 0.18, 0.72, 1], [0, 0, -(TILE + 8), -(TILE + 8)]);

  return (
    <View style={styles.scene}>
      <View style={[styles.glow, { backgroundColor: rgba(tone, 0.07) }]} />

      {kind === 'swipeH' ? (
        <View style={styles.rowTrack} pointerEvents="none">
          <Animated.View
            style={{ flexDirection: 'row', paddingLeft: TILE_LEFT, opacity: columnOpacity, transform: [{ translateX: rowX as any }] }}
          >
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.rowCard, { borderColor: rgba(tone, i === 0 ? 0.9 : 0.35) }]}>
                <Ionicons name="image-outline" size={24} color={rgba(tone, i === 0 ? 1 : 0.55)} />
              </View>
            ))}
          </Animated.View>
        </View>
      ) : kind === 'swipe' ? (
        <View style={styles.column} pointerEvents="none">
          <Animated.View style={{ paddingTop: 40, opacity: columnOpacity, transform: [{ translateY: columnY as any }] }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.photoCard, { borderColor: rgba(tone, i === 0 ? 0.9 : 0.35) }]}>
                <Ionicons name="image-outline" size={16} color={rgba(tone, i === 0 ? 1 : 0.55)} />
              </View>
            ))}
          </Animated.View>
        </View>
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tile,
              styles.ripple,
              { borderColor: rgba(tone, 0.8), opacity: rippleOpacity as any, transform: [{ scale: rippleScale as any }] },
            ]}
          />
          <Animated.View
            style={[
              styles.tile,
              { borderColor: tileBorder as any, transform: [{ scale: tileScale as any }] },
            ]}
          >
            {kind === 'hold' ? (
              <Animated.View style={[styles.fill, { width: fillWidth as any, backgroundColor: rgba(tone, 0.32) }]} />
            ) : null}
            <Ionicons name={step.icon} size={26} color={rgba(tone, 1)} />
          </Animated.View>
        </>
      )}

      {kind !== 'look' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.finger,
            { opacity: fingerOpacity, transform: [{ translateX: fingerX }, { translateY: fingerY }, { scale: fingerScale }] },
          ]}
        />
      ) : null}
    </View>
  );
}

// ── Trail progress: dots joined by a line that fills as you go ───────────

function TrailDot({ active, done }: { active: boolean; done: boolean }) {
  const w = useRef(new Animated.Value(active ? 20 : 8)).current;
  useEffect(() => {
    Animated.spring(w, { toValue: active ? 20 : 8, friction: 7, tension: 120, useNativeDriver: false }).start();
  }, [active, w]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { width: w, backgroundColor: active || done ? C.gold : 'rgba(255,255,255,0.18)' },
      ]}
    />
  );
}

function Trail({ count, index }: { count: number; index: number }) {
  return (
    <View
      style={styles.trail}
      accessible
      accessibilityLabel={`Step ${index + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>
          <TrailDot active={i === index} done={i < index} />
          {i < count - 1 ? (
            <View style={[styles.link, i < index && { backgroundColor: C.gold }]} />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── The modal ────────────────────────────────────────────────────────────

interface TutorialModalProps {
  visible: boolean;
  steps: TutorialStep[];
  onClose: () => void;
}

export default function TutorialModal({ visible, steps, onClose }: TutorialModalProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const cardWidth = landscape ? Math.min(width - 48, 500) : Math.min(width - 40, 340);

  const [mounted, setMounted] = useState(visible);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const closing = useRef(false);

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

  const next = () => {
    if (index >= steps.length - 1) {
      dismiss();
      return;
    }
    dir.current = 1;
    swap.setValue(0);
    setIndex((i) => i + 1);
    Animated.timing(swap, {
      toValue: 1,
      duration: reduceMotion ? 120 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const back = () => {
    if (index === 0) return;
    dir.current = -1;
    swap.setValue(0);
    setIndex((i) => i - 1);
    Animated.timing(swap, {
      toValue: 1,
      duration: reduceMotion ? 120 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
      <Animated.View style={{ opacity: swap }}>
        <Stage key={index} step={step} reduceMotion={reduceMotion} />
      </Animated.View>
    </View>
  );

  const copy = (
    <Animated.View style={{ opacity: swap, transform: [{ translateX: textShift }] }}>
      <Text style={styles.title} accessibilityRole="header">{step.title}</Text>
      <Text style={styles.body}>{step.body}</Text>
    </Animated.View>
  );

  const footer = (
    <View style={styles.footer}>
      <Trail count={steps.length} index={index} />
      <View style={styles.actions}>
        {index > 0 ? (
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous tip">
            <Text style={styles.ghostText}>Back</Text>
          </Pressable>
        ) : !isLast ? (
          <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip tutorial">
            <Text style={styles.ghostText}>Skip</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish tutorial' : 'Next tip'}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.primaryText}>{isLast ? 'Got it' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    // A real Modal = its own window, so it always sits above everything
    // (including native video). No backdrop is drawn, so the screen stays
    // fully visible behind the card; the Modal itself blocks touches.
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
        <Animated.View
          style={[
            styles.card,
            { width: cardWidth, opacity: cardOpacity, transform: [{ translateY: cardTranslateY }, { scale: cardScale }] },
          ]}
        >
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
              <View style={styles.portraitText}>{copy}</View>
              {footer}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.35)',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
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

  // Stage
  stagePanel: {
    backgroundColor: C.stage,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    height: SCENE_H + 8,
    overflow: 'hidden',
  },
  stagePanelLandscape: { width: SCENE_W + 20, height: undefined, alignSelf: 'stretch', minHeight: SCENE_H + 8 },
  scene: { width: SCENE_W, height: SCENE_H },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: (SCENE_W - 120) / 2,
    top: (SCENE_H - 120) / 2 - 8,
  },
  tile: {
    position: 'absolute',
    left: TILE_LEFT,
    top: TILE_TOP,
    width: TILE,
    height: TILE,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: { backgroundColor: 'transparent', overflow: 'visible' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  finger: {
    position: 'absolute',
    left: SCENE_W / 2 - 10,
    top: TILE_TOP + TILE - 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  column: {
    position: 'absolute',
    left: (SCENE_W - 76) / 2,
    top: 0,
    width: 76,
    height: SCENE_H,
    overflow: 'hidden',
  },
  rowTrack: {
    position: 'absolute',
    left: 0,
    top: TILE_TOP,
    width: SCENE_W,
    height: TILE,
    overflow: 'hidden',
  },
  rowCard: {
    width: TILE,
    height: TILE,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCard: {
    width: 76,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: C.tile,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Copy
  portraitText: { paddingTop: 14, paddingHorizontal: 4 },
  landscapeRow: { flexDirection: 'row', gap: 14 },
  landscapeText: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  title: { color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  body: { color: C.body, fontSize: 12.5, lineHeight: 18, marginTop: 5 },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  trail: { flexDirection: 'row', alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  link: { width: 12, height: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ghostText: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },
  primary: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  primaryText: { color: C.ink, fontSize: 12.5, fontWeight: '800' },
});