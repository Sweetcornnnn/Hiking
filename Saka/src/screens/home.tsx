// screens/Home.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  BackHandler,
  Alert,
  AppState,
  AccessibilityInfo,
  ActivityIndicator,
  ToastAndroid,
  useWindowDimensions,
  type AppStateStatus,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import { useWildTrackStore } from '../store/wildtrackStore';
import ProfileCard from '../components/ProfileCard';
import OfflineStatusIndicator from '../components/OfflineStatusIndicator';
import GlobalChatNotifier from '../components/chat/GlobalChatNotifier';
import {
  AnimatedMessageIcon,
  type AnimatedMessageIconHandle,
  type ChatNotificationPayload,
} from '../components/chat/AnimatedMessageIcon';
import {
  ChatNotificationProvider,
  useChatNotifications,
} from '../components/chat/ChatNotificationContext';
import { mountainService, Mountain } from '../services/mountainService';
import { persistProfileAvatarLocally } from '../services/profileAvatarService';
import {
  getHomeVideoPosters,
  subscribeHomeVideoPosters,
  preloadHomeVideoPosters,
  MOUNTAIN_VIDEOS,
} from '../services/homeVideoAssets';
import { MOUNTAIN_TIPS } from '../data/mountainTips';
import { getUnreadMountainAlertCounts } from '../services/mountainAlertReadService';
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_SUBTLE,
  BORDER_SUBTLE,
  SPACING,
  TEXT_DANGER,
} from '../theme/designTokens';
import { useTutorial, TutorialHelpButton } from '../components/TutorialModal';

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF81',
  Moderate: '#F0A500',
  Hard: '#E05C3A',
  Expert: '#C0392B',
};

// 2 = the current slide AND its neighbours keep a (paused) player ready,
// so a swipe reveals a loaded video instead of a bare poster.
const VIDEO_WINDOW = 2;

// Optional haptics: works if expo-haptics is installed, silently does nothing if not.
let Haptics: { selectionAsync?: () => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}
const hapticTick = () => {
  try { void Haptics?.selectionAsync?.(); } catch {}
};

// TODO: connect this to your events service and return { [mountainId]: upcomingEventCount }.
// The Events pill shows the number as soon as it returns a count above 0.
async function fetchUpcomingEventCounts(): Promise<Record<string, number>> {
  return {};
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (mounted) setReduce(value); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function VideoPoster({ poster }: { poster?: VideoThumbnail }) {
  const [failed, setFailed] = useState(false);
  if (poster && !failed) {
    return (
      <ExpoImage
        source={poster}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={styles.fullScreenVideoPlaceholder}>
      <Ionicons name="videocam-outline" size={80} color="#8B7355" />
    </View>
  );
}

function MountainVideo({
  source,
  poster,
  isActive,
}: {
  source: number;
  poster?: VideoThumbnail;
  isActive: boolean;
}) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const [videoErrored, setVideoErrored] = useState(false);
  const hasRetriedRef = useRef(false);

  useEffect(() => {
    if (videoErrored) return;
    if (isActive) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
    }
  }, [isActive, player, videoErrored]);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        if (!hasRetriedRef.current) {
          hasRetriedRef.current = true;
          posterOpacity.setValue(1);
          void player.replaceAsync(source).catch(() => setVideoErrored(true));
          return;
        }
        setVideoErrored(true);
        posterOpacity.setValue(1);
        return;
      }
      if (status === 'readyToPlay') {
        setVideoErrored(false);
        hasRetriedRef.current = false;
      }
      try {
        player.loop = true;
        player.muted = true;
      } catch {}
      if (status === 'readyToPlay' && isActive) {
        try { player.play(); } catch {}
      }
    });
    return () => sub.remove();
  }, [isActive, player, source]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && isActive && !videoErrored) {
        try { player.loop = true; player.muted = true; } catch {}
        try { player.play(); } catch {}
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isActive, player, videoErrored]);

  if (videoErrored) return <VideoPoster poster={poster} />;

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoPoster poster={poster} />
      <View style={styles.videoOverlay} pointerEvents="none">
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
          onFirstFrameRender={() =>
            Animated.timing(posterOpacity, {
              toValue: 0,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start()
          }
        />
      </View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: posterOpacity }]}
        pointerEvents="none"
      >
        <VideoPoster poster={poster} />
      </Animated.View>
    </View>
  );
}

const MountainSlide = memo(function MountainSlide({
  mountain,
  shouldMountVideo,
  isActive,
  poster,
  alertCount,
  width,
  height,
  isPortrait,
  index,
  scrollX,
  reduceMotion,
  eventCount,
  onOpenTips,
  onEventsPress,
}: {
  mountain: Mountain;
  shouldMountVideo: boolean;
  isActive: boolean;
  poster: VideoThumbnail | undefined;
  alertCount: number;
  width: number;
  height: number;
  isPortrait: boolean;
  index: number;
  scrollX: Animated.Value;
  reduceMotion: boolean;
  eventCount: number;
  onOpenTips: (mountain: Mountain) => void;
  onEventsPress: (mountainId: string) => void;
}) {
  const diffColor = DIFFICULTY_COLORS[mountain.difficulty] ?? '#FFF';
  const localVideo = MOUNTAIN_VIDEOS[mountain.id];

  // Parallax: the video drifts a little slower than the page, the text a little faster
  // (and fades), so each swipe has depth. Skipped when the user prefers reduced motion.
  const w = width;
  const videoParallax = reduceMotion
    ? undefined
    : {
        transform: [
          {
            translateX: scrollX.interpolate({
              inputRange: [(index - 1) * w, index * w, (index + 1) * w],
              outputRange: [-0.05 * w, 0, 0.05 * w],
              extrapolate: 'clamp',
            }),
          },
          { scale: 1.1 },
        ],
      };
  const infoParallax = reduceMotion
    ? undefined
    : {
        opacity: scrollX.interpolate({
          inputRange: [(index - 0.7) * w, index * w, (index + 0.7) * w],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateX: scrollX.interpolate({
              inputRange: [(index - 1) * w, index * w, (index + 1) * w],
              outputRange: [0.25 * w, 0, -0.25 * w],
              extrapolate: 'clamp',
            }),
          },
        ],
      };

  return (
    <View style={[styles.fullScreenContainer, { width, height }]}>
      <Animated.View style={[styles.videoWrapper, videoParallax]}>
        {localVideo ? (
          shouldMountVideo ? (
            <MountainVideo source={localVideo} poster={poster} isActive={isActive} />
          ) : (
            <VideoPoster poster={poster} />
          )
        ) : (
          <VideoPoster poster={poster} />
        )}
      </Animated.View>
      <Animated.View style={[styles.floatingInfoContainer, isPortrait && styles.floatingInfoContainerPortrait, infoParallax]}>
        {mountain.funny_warning && (
          <Text style={styles.funnyWarningText}>{mountain.funny_warning}</Text>
        )}
        <View style={styles.infoMetaRow}>
          <View style={[styles.difficultyBadge, { borderColor: diffColor }]}>
            <View style={[styles.difficultyDot, { backgroundColor: diffColor }]} />
            <Text style={[styles.difficultyText, { color: diffColor }]}>{mountain.difficulty}</Text>
          </View>
          <View style={styles.elevationPill}>
            <Ionicons name="trending-up-outline" size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.elevationText}>{mountain.elevationDisplay}</Text>
          </View>
          <TouchableOpacity
            style={styles.eventsPill}
            onPress={() => onEventsPress(mountain.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              eventCount > 0
                ? `Events for ${mountain.name}, ${eventCount} upcoming`
                : `Events for ${mountain.name}`
            }
          >
            <Ionicons name="calendar-outline" size={11} color="#C9A96E" />
            <Text style={styles.eventsPillText}>Events</Text>
            {eventCount > 0 ? (
              <View style={styles.eventsCount}>
                <Text style={styles.eventsCountText}>{eventCount > 9 ? '9+' : eventCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
        <View style={styles.mountainNameRow}>
          <Text
            style={[styles.floatingMountainName, isPortrait && styles.floatingMountainNamePortrait]}
            numberOfLines={1}
          >
            {mountain.name}
          </Text>
          <TouchableOpacity
            style={styles.guideButton}
            onPress={() => onOpenTips(mountain)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              alertCount > 0
                ? `Open ${mountain.name} tips and guide, ${alertCount} alerts`
                : `Open ${mountain.name} tips and guide`
            }
          >
            <Ionicons name="information-circle-outline" size={22} color={ACCENT_GOLD} />
            {alertCount > 0 ? (
              <View style={styles.guideAlertBadge} pointerEvents="none">
                <Text style={styles.guideAlertBadgeText}>
                  {alertCount > 9 ? '9+' : alertCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
        <Text style={styles.mountainDescription} numberOfLines={2}>
          {mountain.description}
        </Text>
      </Animated.View>
    </View>
  );
});

/**
 * Everything that needs the chat-notification context lives here.
 * Rendered as a child of <ChatNotificationProvider> so useChatNotifications()
 * resolves correctly — no changes needed to _layout.tsx.
 */
function HomeContent() {
  const router = useRouter();
  const { returnToProfile } = useLocalSearchParams<{ returnToProfile?: string }>();
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { setSelectedMountainId } = useWildTrackStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const dimensions = useWindowDimensions();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const slideWidth = viewportSize.width || dimensions.width;
  const slideHeight = viewportSize.height || dimensions.height;
  const reduceMotion = useReduceMotion();
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [profileCardVisible, setProfileCardVisible] = useState(returnToProfile === 'true');
  const profileImage = profile?.avatar_url ?? null;
  const [mountains, setMountains] = useState<Mountain[]>(() => mountainService.getCachedMountains());

  // ── CHAT NOTIFICATIONS → HEADER ICON ──
  const messageIconRef = useRef<AnimatedMessageIconHandle>(null);
  const { subscribe, unreadCount, clearUnread } = useChatNotifications();

  useEffect(() => {
    return subscribe((payload) => {
      messageIconRef.current?.notify(payload);
    });
  }, [subscribe]);

  const handleOpenNotification = useCallback(
    (payload: ChatNotificationPayload) => {
      clearUnread();
      router.push({
        pathname: payload.type === 'private' ? '/chat/Conversation' : '/chat/GroupChat',
        params: payload.type === 'private' ? { userId: payload.id } : { groupId: payload.id },
      } as any);
    },
    [router, clearUnread]
  );

  const handleOpenInbox = useCallback(() => {
    clearUnread();
    router.push('/chat/Chat' as any);
  }, [router, clearUnread]);

  const handleProfileImageSelect = async (uri: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save a profile photo.');
      return;
    }
    try {
      const localUri = await persistProfileAvatarLocally(user.id, uri);
      const result = await updateProfile({ avatar_url: localUri });
      if (!result.success) throw new Error(result.error || 'Unable to save your profile photo.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save your profile photo.';
      console.error('[Profile] Avatar update failed:', error);
      Alert.alert('Profile photo not saved', message);
    }
  };

  const [videoPosters, setVideoPosters] = useState<Record<string, VideoThumbnail>>(
    () => getHomeVideoPosters()
  );
  useEffect(() => {
    setVideoPosters(getHomeVideoPosters());
    const unsubscribe = subscribeHomeVideoPosters(setVideoPosters);
    void preloadHomeVideoPosters();
    return unsubscribe;
  }, []);

  const [loading, setLoading] = useState(() => mountains.length === 0);
  const [fetchFailed, setFetchFailed] = useState(false);
  const tutorial = useTutorial('home', { ready: mountains.length > 0 && returnToProfile !== 'true' });
  const scrollViewRef = useRef<any>(null);

  const isPortrait = slideHeight > slideWidth;

  const loadMountains = useCallback(async () => {
    setLoading(true);
    setFetchFailed(false);
    try {
      await mountainService.fetchMountains();
    } catch (fetchError) {
      console.warn('[Home] Mountain feed could not be loaded:', fetchError);
      setFetchFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = mountainService.subscribeToCache((updatedMountains) => {
      setMountains(updatedMountains);
    });
    if (mountains.length === 0) void loadMountains();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (mountains.length > 0) {
      setFetchFailed(false);
      setLoading(false);
    }
  }, [mountains]);

  useEffect(() => {
    let alive = true;
    fetchUpcomingEventCounts()
      .then((counts) => { if (alive) setEventCounts(counts); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Pause every video while another screen (Tips, Events, MountainTop…) is on top.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      let active = true;
      if (user) {
        void getUnreadMountainAlertCounts(user.id, MOUNTAIN_TIPS)
          .then((counts) => {
            if (active) setAlertCounts(counts);
          })
          .catch((error) => {
            console.warn('[Home] Failed to load unread mountain alerts:', error);
          });
      } else {
        setAlertCounts({});
      }
      return () => {
        active = false;
        setFocused(false);
      };
    }, [user])
  );

  // ── Paging: one scroll value drives the parallax; the active slide switches at the halfway point ──
  const scrollX = useRef(new Animated.Value(0)).current;
  const activeIndexRef = useRef(0);
  const mountainsRef = useRef(mountains);
  mountainsRef.current = mountains;
  const widthRef = useRef(slideWidth);
  widthRef.current = slideWidth;
  const lastWidthRef = useRef(slideWidth);
  const ignoreScrollUntil = useRef(0);
  if (lastWidthRef.current !== slideWidth) {
    // rotating: don't mistake the layout change for a swipe
    lastWidthRef.current = slideWidth;
    ignoreScrollUntil.current = Date.now() + 400;
  }

  const syncActive = useCallback((offsetX: number) => {
    if (Date.now() < ignoreScrollUntil.current) return;
    const list = mountainsRef.current;
    if (list.length === 0 || widthRef.current <= 0) return;
    const next = Math.max(0, Math.min(list.length - 1, Math.round(offsetX / widthRef.current)));
    if (next === activeIndexRef.current) return;
    activeIndexRef.current = next;
    setActiveIndex(next);
    setSelectedMountainId(list[next].id);
    hapticTick();
  }, [setSelectedMountainId]);

  const onScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      {
        useNativeDriver: true,
        listener: (event: any) => syncActive(event.nativeEvent.contentOffset.x),
      },
    ),
    [scrollX, syncActive],
  );

  // Only re-align on rotation / when the list size changes (NOT on every swipe, which would fight the finger).
  useEffect(() => {
    if (scrollViewRef.current && mountains.length > 0) {
      scrollViewRef.current.scrollTo({
        x: activeIndexRef.current * slideWidth,
        animated: false,
      });
    }
  }, [slideWidth, mountains.length]);

  // Gentle breathing glow behind the Saka logo button (the main action),
  // plus a soft ripple that radiates outward as a "tap me" cue.
  const glow = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const ctaPress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      glow.setValue(0);
      ripple.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const rippleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripple, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(ripple, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    rippleLoop.start();
    return () => { loop.stop(); rippleLoop.stop(); };
  }, [reduceMotion, glow, ripple]);

  // Press feedback: the button sinks in on touch and springs back.
  const animateCta = useCallback((to: number) => {
    Animated.spring(ctaPress, {
      toValue: to,
      speed: 40,
      bounciness: to ? 0 : 8,
      useNativeDriver: true,
    }).start();
  }, [ctaPress]);

  const openProfileCard = () => setProfileCardVisible(true);
  const closeProfileCard = () => setProfileCardVisible(false);

  const handleOpenTips = useCallback(
    (mountain: Mountain) => {
      router.push({
        pathname: '/mountainInfo/TipsAndTricks',
        params: { mountainId: mountain.id, mountainName: mountain.name },
      } as any);
    },
    [router]
  );

  const handleEventsPress = useCallback(
    (mountainId: string) => {
      router.push({
        pathname: '/events/Events',
        params: { mountainId },
      } as any);
    },
    [router]
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutToastOpacity = useRef(new Animated.Value(0)).current;
  const logoutToastY = useRef(new Animated.Value(-6)).current;

  const openLogoutConfirm = useCallback(() => {
    setShowLogoutConfirm(true);
    logoutToastOpacity.setValue(0);
    logoutToastY.setValue(-6);
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [logoutToastOpacity, logoutToastY]);

  const dismissLogoutConfirm = useCallback(() => {
    Animated.parallel([
      Animated.timing(logoutToastOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logoutToastY, { toValue: -4, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setShowLogoutConfirm(false));
  }, [logoutToastOpacity, logoutToastY]);

  const confirmLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    await signOut();
    router.replace('/Login');
  }, [signOut, router]);

  const lastBackPress = useRef(0);
  useEffect(() => {
    const onBack = () => {
      if (profileCardVisible) { closeProfileCard(); return true; }
      if (showLogoutConfirm) { dismissLogoutConfirm(); return true; }
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [profileCardVisible, showLogoutConfirm, dismissLogoutConfirm]);

  if (mountains.length === 0) {
    if (loading || !fetchFailed) {
      return (
        <View style={[styles.immersiveContainer, styles.statusWrap]}>
          <ActivityIndicator color={ACCENT_GOLD} />
          <Text style={styles.statusText}>Preparing your mountain feed...</Text>
        </View>
      );
    }
    return (
      <View style={[styles.immersiveContainer, styles.statusWrap]}>
        <Ionicons name="cloud-offline-outline" size={30} color="rgba(255,255,255,0.5)" />
        <Text style={styles.statusText}>
          Mountain feed is unavailable. Connect to the internet to load it.
        </Text>
        <TouchableOpacity
          onPress={() => void loadMountains()}
          style={styles.retryButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry loading the mountain feed"
        >
          <Ionicons name="refresh" size={14} color="#0E1520" />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCTAPress = (mountainId: string) => {
    router.push({ pathname: '/MountainTop', params: { mountainId } });
  };

  return (
    <View style={styles.immersiveContainer}>
      {/* Global Listener — feeds AnimatedMessageIcon via shared context */}
      <GlobalChatNotifier />

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.mountainPager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewportSize((current) => (
            current.width === width && current.height === height
              ? current
              : { width, height }
          ));
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => syncActive(event.nativeEvent.contentOffset.x)}
        decelerationRate="fast"
      >
        {mountains.map((mountain, index) => {
          const distance = Math.abs(index - activeIndex);
          const shouldMountVideo = distance < VIDEO_WINDOW;
          const isActive = focused && index === activeIndex;
          const normalizedMountainName = mountain.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const tips = MOUNTAIN_TIPS.find((item) =>
            item.id === mountain.id
            || item.mountainName.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedMountainName
          );
          return (
            <MountainSlide
              key={mountain.id}
              mountain={mountain}
              shouldMountVideo={shouldMountVideo}
              isActive={isActive}
              poster={videoPosters[mountain.id]}
              alertCount={tips ? alertCounts[tips.id] ?? tips.alerts.length : 0}
              width={slideWidth}
              height={slideHeight}
              isPortrait={isPortrait}
              index={index}
              scrollX={scrollX}
              reduceMotion={reduceMotion}
              eventCount={eventCounts[mountain.id] ?? 0}
              onOpenTips={handleOpenTips}
              onEventsPress={handleEventsPress}
            />
          );
        })}
      </Animated.ScrollView>

      <View style={[styles.transparentHeader, !isPortrait && styles.transparentHeaderLandscape]}>
        <TouchableOpacity
          onPress={openProfileCard}
          style={styles.profileButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <View style={styles.profileAvatarOuter}>
            <View style={styles.profileAvatarRing}>
              <View style={styles.profileAvatar}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileAvatarImage} />
                ) : (
                  <Text style={styles.profileInitials}>
                    {user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'H'}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.profilePresenceDot} />
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileGreeting}>Welcome back</Text>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name?.split(' ')[0] || 'Hiker'}
            </Text>
          </View>
          <View style={styles.profileChevronWrap}>
            <Ionicons name="chevron-down" size={11} color="#C9A96E" />
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightButtons}>
          <OfflineStatusIndicator />

          {profile?.role === 'organization' && (
            <TouchableOpacity
              onPress={() => router.push('/organizations/Dashboard')}
              style={styles.chatButton}
              activeOpacity={0.8}
              accessibilityLabel="Back to organizer dashboard"
            >
              <Ionicons name="business-outline" size={20} color="#3FD69D" />
            </TouchableOpacity>
          )}

          {/* Animated chat icon: expands left with preview, then collapses */}
          <View style={styles.chatIconWrap}>
            <AnimatedMessageIcon
              ref={messageIconRef}
              unreadCount={unreadCount}
              onPress={handleOpenInbox}
              onPressNotification={handleOpenNotification}
            />
          </View>
        </View>
      </View>

      {tutorial.element}

      <ProfileCard
        visible={profileCardVisible}
        onClose={closeProfileCard}
        onRequestLogout={() => { closeProfileCard(); openLogoutConfirm(); }}
        profileImage={profileImage}
        onProfileImageSelect={handleProfileImageSelect}
      />

      {mountains[activeIndex] && (
        <Pressable
          style={[styles.ctaAbsolute, isPortrait && styles.ctaAbsolutePortrait]}
          onPress={() => handleCTAPress(mountains[activeIndex].id)}
          onPressIn={() => animateCta(1)}
          onPressOut={() => animateCta(0)}
          accessibilityRole="button"
          accessibilityLabel={`Explore ${mountains[activeIndex].name}`}
        >
          <Animated.View
            style={{
              alignItems: 'center',
              transform: [{ scale: ctaPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }],
            }}
          >
            <View style={styles.ctaLogoWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ctaRippleRing,
                  {
                    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ctaGlowRing,
                  {
                    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.14] }) }],
                  },
                ]}
              />
              <Image
                source={require('../../assets/images/SakaLogo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.logoLabelPill}>
              <Text style={styles.logoLabel}>Tara, Saka</Text>
              <View style={styles.logoLabelChip}>
                <Animated.View
                  style={{
                    transform: [{ translateX: glow.interpolate({ inputRange: [0, 1], outputRange: [-1, 1.5] }) }],
                  }}
                >
                  <Ionicons name="arrow-forward" size={11} color="#0E1520" />
                </Animated.View>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      )}

      <View
        style={styles.paginationFixed}
        accessible
        accessibilityLabel={`Mountain ${activeIndex + 1} of ${mountains.length}: ${mountains[activeIndex]?.name ?? ''}`}
      >
        <View style={styles.paginationStack}>
          {mountains.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex ? styles.paginationDotActive : styles.paginationDotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {showLogoutConfirm && (
        <Animated.View
          style={[
            styles.logoutToast,
            { opacity: logoutToastOpacity, transform: [{ translateY: logoutToastY }] },
          ]}
        >
          <View style={styles.logoutToastBar} />
          <View style={styles.logoutToastInner}>
            <Text style={styles.logoutToastTitle}>Sign out?</Text>
            <Text style={styles.logoutToastMsg}>You'll be returned to the login screen.</Text>
            <View style={styles.logoutToastActions}>
              <TouchableOpacity style={styles.logoutToastCancel} onPress={dismissLogoutConfirm}>
                <Text style={styles.logoutToastCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutToastConfirm} onPress={confirmLogout}>
                <Text style={styles.logoutToastConfirmText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** Public screen: mounts the provider around the content. */
export default function HomeScreen() {
  return (
    <ChatNotificationProvider>
      <HomeContent />
    </ChatNotificationProvider>
  );
}

const styles = StyleSheet.create({
  immersiveContainer: { flex: 1, backgroundColor: '#000' },
  mountainPager: { flex: 1, width: '100%' },
  fullScreenContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRightWidth: 2,
    borderRightColor: 'rgba(201,169,110,0.3)',
  },
  videoWrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fullScreenVideoPlaceholder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  funnyWarningText: {
    color: 'rgba(255,255,220,0.7)',
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: 10,
    maxWidth: '65%',
    lineHeight: 14,
  },
  floatingInfoContainer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 30,
    paddingHorizontal: 24,
    paddingBottom: 22,
    paddingTop: 40,
  },
  floatingInfoContainerPortrait: { paddingBottom: 36 },
  ctaAbsolute: {
    position: 'absolute',
    bottom: 22, right: 24,
    zIndex: 250,
    elevation: 0,
    alignItems: 'center',
    gap: 0,
  },
  ctaAbsolutePortrait: { bottom: 36 },
  ctaLogoWrap: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  ctaGlowRing: {
    position: 'absolute',
    width: 118, height: 118, borderRadius: 59,
    backgroundColor: 'rgba(201,169,110,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.35)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaRippleRing: {
    position: 'absolute',
    width: 118, height: 118, borderRadius: 59,
    borderWidth: 1.5,
    borderColor: 'rgba(201,169,110,0.7)',
  },
  logoImage: { width: 168, height: 168 },
  logoLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: -40,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 22,
    backgroundColor: 'rgba(10,16,26,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.65)',
    shadowColor: '#C9A96E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoLabel: {
    color: '#F3E7CF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  logoLabelChip: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  difficultyDot: { width: 6, height: 6, borderRadius: 3 },
  difficultyText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  guideButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  guideAlertBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TEXT_DANGER,
    borderWidth: 1.5,
    borderColor: BG_CARD,
  },
  guideAlertBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  elevationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  elevationText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  eventsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(201,169,110,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.55)',
  },
  eventsPillText: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  eventsCount: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A96E',
  },
  eventsCountText: { color: '#0E1520', fontSize: 9, fontWeight: '800' },
  statusWrap: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  statusText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: ACCENT_GOLD,
  },
  retryText: { color: '#0E1520', fontSize: 12, fontWeight: '800' },
  mountainDescription: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17, maxWidth: '65%' },
  floatingMountainName: {
    flexShrink: 1,
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 46,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginBottom: 6,
  },
  mountainNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.gap, maxWidth: '68%', marginBottom: 6 },
  floatingMountainNamePortrait: { fontSize: 52, lineHeight: 56 },
  transparentHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 100,
  },
  transparentHeaderLandscape: { paddingTop: 18 },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingRight: 10,
    paddingLeft: 5,
    paddingVertical: 5,
    backgroundColor: 'rgba(10,16,26,0.72)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.28)',
    shadowColor: '#C9A96E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  profileAvatarOuter: {
    position: 'relative',
    marginRight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarRing: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: BG_SUBTLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: BORDER_SUBTLE,
  },
  profilePresenceDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: '#6FAF8A',
    borderWidth: 1.5,
    borderColor: '#0A101A',
  },
  profileAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(201,169,110,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: { width: '100%', height: '100%' },
  profileInitials: { color: '#C9A96E', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  profileDivider: { width: 1, height: 22, backgroundColor: 'rgba(201,169,110,0.2)', marginHorizontal: 10 },
  profileTextContainer: { justifyContent: 'center', marginRight: 8 },
  profileGreeting: { color: 'rgba(255,255,255,0.38)', fontSize: 9, lineHeight: 11, fontWeight: '500', letterSpacing: 0.3 },
  profileName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 16, letterSpacing: 0.1 },
  profileChevronWrap: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationFixed: {
    position: 'absolute',
    bottom: 8, left: 0, right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  paginationStack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  paginationDot: { width: 6, height: 6, borderRadius: 3 },
  paginationDotActive: { backgroundColor: '#C9A96E', width: 26, height: 6, borderRadius: 3 },
  paginationDotInactive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  logoutToast: {
    position: 'absolute',
    bottom: 32, left: '10%', right: '10%',
    flexDirection: 'row',
    backgroundColor: '#141E2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
    overflow: 'hidden',
    zIndex: 999,
    elevation: 20,
  },
  logoutToastBar: { width: 3, backgroundColor: '#BF6A6A', alignSelf: 'stretch' },
  logoutToastInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  logoutToastTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  logoutToastMsg: { color: 'rgba(255,255,255,0.42)', fontSize: 11, lineHeight: 15, marginBottom: 10 },
  logoutToastActions: { flexDirection: 'row', gap: 8 },
  logoutToastCancel: {
    flex: 1, alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoutToastCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  logoutToastConfirm: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: '#BF6A6A' },
  logoutToastConfirmText: { color: '#0E1520', fontSize: 12, fontWeight: '700' },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpButton: {
    marginRight: 4,
    backgroundColor: 'rgba(10,16,26,0.6)',
  },
  chatButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(10,16,26,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.18)',
  },
  chatIconWrap: {
    marginLeft: 8,
  },
});