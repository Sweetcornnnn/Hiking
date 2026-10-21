import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { mountainService } from '../services/mountainService';
import { preloadHomeVideoPosters } from '../services/homeVideoAssets';
import {
  BG_PANEL,
  BG_CARD,
  ACCENT_GOLD,
  TEXT_MUTED,
} from '../theme/designTokens';

// Funny hiking lines that rotate while loading
const HIKING_LINES = [
  'Lacing up our boots...',
  'Packing way too many snacks...',
  'Arguing about who forgot the map...',
  'Pretending we know where the trail is...',
  'Taking a totally necessary photo break...',
  'Waving at a suspiciously friendly squirrel...',
  'Asking the mountain to be a little less steep...',
  'Dodging one very dramatic mud puddle...',
  'Filling water bottles with good vibes...',
  'Are we there yet? Almost!',
  'Counting steps we definitely did not skip...',
  'Stretching so we look like we train...',
  'Debating whether this counts as a shortcut...',
  'Hiding the trail mix from the rest of the group...',
  'Politely ignoring the "just five more minutes" hill...',
  'Tightening laces, loosening expectations...',
  'Consulting a very confident compass...',
  'Naming every rock we pass...',
  'Wondering if that was a bear or just a bush...',
  'Practicing our summit victory pose...',
  'Convincing ourselves the backpack is lighter now...',
  'Chasing golden hour, one step at a time...',
  'Listening to the trees gossip about us...',
  'Letting the slowest hiker set the pace...',
  'Rehearsing excuses to nap at the summit...',
  'Pretending the uphill part is the scenic part...',
  'Following the trail because the map is clearly having a mood...',
  'Trying to look serious while the boots disagree with us...',
  'Charging our phone with pure determination and zero cables...',
  'Convincing the snack bag it is an important summit member...',
  'Searching for the perfect rock to sit on and judge the view...',
  'Calling the hill “a little steep” while holding on for dear life...',
  'Attempting to hike without saying “I told you so”...',
  'Making friends with a cloud that looks suspiciously like a mountain...',
  'Practicing the summit pose before the summit is even visible...',
  'Checking whether the trail is actually a trail or a very long joke...',
  'Wearing matching socks because commitment deserves applause...',
  'Negotiating with gravity like it is a difficult group project...',
  'Wondering where all the water went and trying not to panic...',
  'Saying “short cut” while discovering the shortcut was a cliff...',
];

// The final line shown for FINAL_HOLD_MS once progress hits 100%.
const FINAL_LINE = 'The trail is ready. Lace up and let’s go.';

// Slow, gentle transitions
const LINE_ROTATE_MS = 7000;
const LINE_FADE_OUT_MS = 1800;
const LINE_FADE_IN_MS = 2200;

// How long the "ready" line stays visible before we navigate / complete.
const FINAL_HOLD_MS = 3000;

// Hard safety net only (long on purpose so loading can really finish)
const MAX_WAIT_MS = 45000;

const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface LoadingScreenProps {
  onComplete?: () => void;
  /** Minimum time (ms) the loading screen stays visible. The bar still follows real progress. */
  loadingDuration?: number;
  /** In embedded loading mode, reveal the screen only after its content is ready. */
  ready?: boolean;
}

export default function LoadingScreen({
  onComplete,
  loadingDuration = 6000,
  ready,
}: LoadingScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile } = useAuthStore();
  const nextRoute = params.next as string | undefined;

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width >= height;
  const textSize = width < 340 ? 9 : isLandscape ? 11 : 10;

  // Symmetric padding measured from the PHYSICAL screen edges, ignoring the
  // notch/camera cutout. This is what balances the bar.
  const sidePadding = isLandscape
    ? 50
    : Math.max(16, Math.round(width * 0.08));

  const [lines] = useState(() => shuffled(HIKING_LINES));
  const [lineIndex, setLineIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const mountedRef = useRef(true);

  // Always-latest values so the loading effect runs ONCE and is never restarted
  // when the profile / route params update halfway through loading.
  const latest = useRef({ profile, nextRoute, onComplete, ready, router });
  latest.current = { profile, nextRoute, onComplete, ready, router };
  const didCompleteInline = useRef(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lineOpacity = useRef(new Animated.Value(1)).current;
  const lineShift = useRef(new Animated.Value(0)).current;

  // Smooth cross-fade between two lines
  const swapLine = useCallback(
    (change: () => void) => {
      Animated.parallel([
        Animated.timing(lineOpacity, {
          toValue: 0,
          duration: LINE_FADE_OUT_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lineShift, {
          toValue: -4,
          duration: LINE_FADE_OUT_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!mountedRef.current) return;
        change();
        lineShift.setValue(4);
        Animated.parallel([
          Animated.timing(lineOpacity, {
            toValue: 1,
            duration: LINE_FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(lineShift, {
            toValue: 0,
            duration: LINE_FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [lineOpacity, lineShift]
  );

  // Rotate lines — only while not finishing. Once finishing, we hold the
  // final line still so it reads as a definitive "ready" message.
  useEffect(() => {
    if (isFinishing) return;
    const interval = setInterval(() => {
      swapLine(() => setLineIndex((i) => (i + 1) % lines.length));
    }, LINE_ROTATE_MS);
    return () => clearInterval(interval);
  }, [swapLine, lines.length, isFinishing]);

  // Main loading effect (runs once)
  useEffect(() => {
    mountedRef.current = true;
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let didNavigate = false;

    const { profile: p0, nextRoute: n0, onComplete: oc0, ready: r0 } = latest.current;
    const isReadyDriven = r0 !== undefined && Boolean(oc0);
    const initialRole = p0?.role ?? 'hiker';
    const initialTarget: Href = n0
      ? (n0 as Href)
      : p0?.is_admin
        ? '/admin/Admin'
        : initialRole === 'organization'
          ? '/organizations/Dashboard'
          : '/Home';
    const shouldPreloadHomeVideos = !oc0 && initialTarget === '/Home';

    // Finish: hold the "ready" line for FINAL_HOLD_MS, then navigate/complete.
    const finish = () => {
      if (didNavigate || !mountedRef.current) return;
      didNavigate = true;
      setIsFinishing(true);

      timers.push(
        setTimeout(() => {
          if (!mountedRef.current) return;
          const { profile, nextRoute, onComplete, router } = latest.current;
          if (onComplete) {
            onComplete();
            return;
          }
          const role = profile?.role ?? 'hiker';
          const target: Href = nextRoute
            ? (nextRoute as Href)
            : profile?.is_admin
              ? '/admin/Admin'
              : role === 'organization'
                ? '/organizations/Dashboard'
                : '/Home';
          router.replace(target);
        }, FINAL_HOLD_MS)
      );
    };

    const animateTo = (
      value: number,
      duration: number,
      easing: (t: number) => number = Easing.out(Easing.quad)
    ) => {
      Animated.timing(progressAnim, {
        toValue: value,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    };

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Gentle pulse
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    if (isReadyDriven) {
      didCompleteInline.current = false;
      animateTo(0.85, Math.max(loadingDuration, 1000));

      // Safety net: if the parent never reports `ready` (hung fetch, map image
      // that fires neither onLoad nor onError, etc.), fill and complete anyway
      // after MAX_WAIT_MS so the user is never trapped on the loading screen.
      timers.push(
        setTimeout(() => {
          if (!mountedRef.current) return;
          if (didCompleteInline.current) return;
          didCompleteInline.current = true;
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (finished && mountedRef.current) finish();
          });
        }, MAX_WAIT_MS)
      );

      return () => {
        mountedRef.current = false;
        pulseAnimation.stop();
        progressAnim.stopAnimation();
        timers.forEach(clearTimeout);
      };
    }

    // Progress plan (follows the real work):
    //  - mountains fetch:  creeps to 30% / 60% while waiting, 40% / 85% once done
    //  - video posters:    up to 95%, driven by completed/total
    //  - finish:           100%, hold FINAL_HOLD_MS, then navigate
    const fetchCeiling = shouldPreloadHomeVideos ? 0.3 : 0.6;
    const afterFetch = shouldPreloadHomeVideos ? 0.4 : 0.85;

    const fetchMountainsWithRetry = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await mountainService.fetchMountains(true);
        } catch (e) {
          lastError = e;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          if (!mountedRef.current) break;
        }
      }
      throw lastError;
    };

    const preloadData = async () => {
      // ── Step 1: fetch mountains (independent of video preload) ──
      try {
        animateTo(fetchCeiling, 5000);
        const mountains = await fetchMountainsWithRetry();
        // Guard: some backends return null on error instead of throwing
        mountainService.setCachedMountains(
          Array.isArray(mountains) ? mountains : []
        );
        animateTo(afterFetch, 500);
      } catch (error) {
        const err = error as Error | undefined;
        console.warn(
          '[Loading] mountains step failed:',
          err?.message ?? error,
          '\nStack:',
          err?.stack ?? '(no stack)'
        );
        animateTo(afterFetch, 400);
      }

      // ── Step 2: preload home video posters (independent) ──
      if (shouldPreloadHomeVideos) {
        try {
          await preloadHomeVideoPosters((completed, total) => {
            const safeTotal =
              typeof total === 'number' && total > 0 ? total : 0;
            const safeCompleted =
              typeof completed === 'number' && Number.isFinite(completed)
                ? completed
                : 0;
            const ratio =
              safeTotal > 0 ? Math.min(safeCompleted / safeTotal, 1) : 1;
            animateTo(afterFetch + (0.95 - afterFetch) * ratio, 400);
          });
        } catch (error) {
          const err = error as Error | undefined;
          console.warn(
            '[Loading] video preload step failed:',
            err?.message ?? error,
            '\nStack:',
            err?.stack ?? '(no stack)'
          );
        }
      }

      // ── Step 3: finish (always runs, no matter what failed above) ──
      if (mountedRef.current) {
        const remaining = Math.max(
          loadingDuration - (Date.now() - startedAt),
          0
        );
        const fillDuration = Math.max(700, remaining);
        animateTo(1, fillDuration, Easing.inOut(Easing.quad));
        timers.push(setTimeout(finish, fillDuration + 300));
      }
    };

    preloadData();

    // Safety net so a hung request can never trap the user here
    timers.push(setTimeout(finish, MAX_WAIT_MS));

    return () => {
      mountedRef.current = false;
      didNavigate = true;
      timers.forEach(clearTimeout);
      pulseAnimation.stop();
      progressAnim.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDuration]);

  useEffect(() => {
    if (!latest.current.onComplete) return;

    if (ready !== true) {
      if (didCompleteInline.current) {
        didCompleteInline.current = false;
        progressAnim.stopAnimation();
      }
      return;
    }
    if (didCompleteInline.current) return;

    didCompleteInline.current = true;
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && mountedRef.current) {
        // Hold the "ready" line for FINAL_HOLD_MS before calling onComplete.
        setIsFinishing(true);
        setTimeout(() => {
          if (mountedRef.current) latest.current.onComplete?.();
        }, FINAL_HOLD_MS);
      }
    });
  }, [ready, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Big GIF fills all the space above the progress area */}
        <View style={[styles.gifArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Animated.View
            style={[styles.gifContainer, { transform: [{ scale: pulseAnim }] }]}
          >
            <Image
              source={require('../../assets/hikingloader.gif')}
              style={styles.gif}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Progress + sentence sit just above the bottom edge.
            NOT wrapped in SafeAreaView — so the bar is centered on the
            physical screen, with symmetric side padding that ignores the
            notch/camera cutout. Bottom inset is applied to the container
            so the text doesn't collide with the home indicator. */}
        <View
          style={[
            styles.bottom,
            {
              paddingHorizontal: sidePadding,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={[styles.textBox, { minHeight: textSize * 1.6 }]}>
            <Animated.Text
              style={[
                styles.loadingText,
                {
                  fontSize: textSize,
                  lineHeight: textSize * 1.6,
                  opacity: lineOpacity,
                  transform: [{ translateY: lineShift }],
                },
              ]}
            >
              {isFinishing ? FINAL_LINE : lines[lineIndex]}
            </Animated.Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PANEL,
  },

  content: {
    flex: 1,
  },

  gifArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  gifContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  gif: {
    width: '100%',
    height: '100%',
  },

  bottom: {
    width: '100%',
    alignItems: 'center',
  },

  progressTrack: {
    width: '100%',
    maxWidth: 1120,
    height: 1,
    backgroundColor: BG_CARD,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 0,
  },

  progressFill: {
    height: '100%',
    backgroundColor: ACCENT_GOLD,
    borderRadius: 2,
  },

  textBox: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  loadingText: {
    color: TEXT_MUTED,
    fontFamily: SERIF,
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'left',
  },
});