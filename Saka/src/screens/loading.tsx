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
import { SafeAreaView } from 'react-native-safe-area-context';
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
const FINAL_LINE = 'Summit reached. Enjoy the view.';

// Slow, gentle transitions
const LINE_ROTATE_MS = 7000;
const LINE_FADE_OUT_MS = 1800;
const LINE_FADE_IN_MS = 2200;

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
}

export default function LoadingScreen({
  onComplete,
  loadingDuration = 6000,
}: LoadingScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile } = useAuthStore();
  const nextRoute = params.next as string | undefined;

  const { width, height } = useWindowDimensions();
  const isLandscape = width >= height;
  const textSize = width < 340 ? 10 : isLandscape ? 13 : 12;
  const sidePadding = isLandscape ? 64 : Math.max(24, Math.round(width * 0.1));

  const [lines] = useState(() => shuffled(HIKING_LINES));
  const [lineIndex, setLineIndex] = useState(0);
  const [showFinal, setShowFinal] = useState(false);
  const mountedRef = useRef(true);

  // Always-latest values so the loading effect runs ONCE and is never restarted
  // when the profile / route params update halfway through loading.
  const latest = useRef({ profile, nextRoute, onComplete, router });
  latest.current = { profile, nextRoute, onComplete, router };

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

  // Rotate lines
  useEffect(() => {
    if (showFinal) return;
    const interval = setInterval(() => {
      swapLine(() => setLineIndex((i) => (i + 1) % lines.length));
    }, LINE_ROTATE_MS);
    return () => clearInterval(interval);
  }, [showFinal, swapLine, lines.length]);

  // Main loading effect (runs once)
  useEffect(() => {
    mountedRef.current = true;
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let didNavigate = false;

    const { profile: p0, nextRoute: n0, onComplete: oc0 } = latest.current;
    const initialRole = p0?.role ?? 'hiker';
    const initialTarget: Href = n0
      ? (n0 as Href)
      : p0?.is_admin
        ? '/admin/Admin'
        : initialRole === 'organization'
          ? '/organizations/Dashboard'
          : '/Home';
    const shouldPreloadHomeVideos = !oc0 && initialTarget === '/Home';

    const goNext = () => {
      if (didNavigate || !mountedRef.current) return;
      didNavigate = true;

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

    // Progress plan (follows the real work):
    //  - mountains fetch:  creeps to 30% / 60% while waiting, 40% / 85% once done
    //  - video posters:    up to 95%, driven by completed/total
    //  - finish:           100%, then navigate
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
      try {
        animateTo(fetchCeiling, 5000);
        const mountains = await fetchMountainsWithRetry();
        mountainService.setCachedMountains(mountains);
        animateTo(afterFetch, 500);

        if (shouldPreloadHomeVideos) {
          await preloadHomeVideoPosters((completed, total) => {
            const ratio = total > 0 ? completed / total : 1;
            animateTo(afterFetch + (0.95 - afterFetch) * ratio, 400);
          });
        }
      } catch (error) {
        console.warn('[Loading] preloading failed:', error);
      } finally {
        if (mountedRef.current) {
          // Honor the minimum display time and finish the bar right as we leave
          const remaining = Math.max(loadingDuration - (Date.now() - startedAt), 0);
          const fillDuration = Math.max(700, remaining);
          animateTo(1, fillDuration, Easing.inOut(Easing.quad));
          timers.push(
            setTimeout(() => {
              if (mountedRef.current) swapLine(() => setShowFinal(true));
            }, fillDuration * 0.75)
          );
          timers.push(setTimeout(goNext, fillDuration + 3000));
        }
      }
    };

    preloadData();

    // Safety net so a hung request can never trap the user here
    timers.push(setTimeout(goNext, MAX_WAIT_MS));

    return () => {
      mountedRef.current = false;
      didNavigate = true;
      timers.forEach(clearTimeout);
      pulseAnimation.stop();
      progressAnim.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDuration]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Big GIF fills all the space above the progress area */}
        <View style={styles.gifArea}>
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

        {/* Progress + sentence sit just above the bottom edge */}
        <View style={[styles.bottom, { paddingHorizontal: sidePadding }]}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={[styles.textBox, { minHeight: textSize * 1.6 * 2 }]}>
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
              {showFinal ? FINAL_LINE : lines[lineIndex]}
            </Animated.Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
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
    paddingBottom: 1,
  },

  progressTrack: {
    width: '100%',
    maxWidth: 820,
    height: 1,
    backgroundColor: BG_CARD,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 2,
  },

  progressFill: {
    height: '100%',
    backgroundColor: ACCENT_GOLD,
    borderRadius: 2,
  },

  textBox: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: TEXT_MUTED,
    fontFamily: SERIF,
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});