import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated,
  Easing,
  StyleSheet,
  Image,
  TouchableOpacity,
  BackHandler,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayer, type VideoThumbnail } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import { useWildTrackStore } from '../store/wildtrackStore';
import ProfileCard from '../components/ProfileCard';
import { mountainService, Mountain } from '../services/mountainService';
import { getHomeVideoPosters, MOUNTAIN_VIDEOS } from '../services/homeVideoAssets';
import { MOUNTAIN_TIPS, MountainTips } from '../data/mountainTips';
import TipsAndTricks from '../components/mountainInfo/TipsAndTricks';
import { ACCENT_GOLD, BG_SUBTLE, BORDER_SUBTLE, SPACING } from '../theme/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF81',
  Moderate: '#F0A500',
  Hard: '#E05C3A',
  Expert: '#C0392B',
};

/** Renders Home's single native player over the slide's frozen poster frame. */
function VideoViewPlayer({ player }: { player: VideoPlayer }) {
  return (
    <View style={styles.videoOverlay} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
      />
    </View>
  );
}

// Memoized slide component.
//
// Note: no `isActive` prop. Because the slide doesn't care about the active
// index anymore, `memo` can short-circuit every carousel swipe — no slide
// re-renders when `activeIndex` changes.
const MountainSlide = memo(function MountainSlide({
  mountain,
  isActive,
  poster,
  videoPlayer,
  videoReady,
  width,
  height,
  isPortrait,
  onOpenTips,
  onEventsPress,
}: {
  mountain: Mountain;
  isActive: boolean;
  poster: VideoThumbnail | undefined;
  videoPlayer: VideoPlayer;
  videoReady: boolean;
  width: number;
  height: number;
  isPortrait: boolean;
  onOpenTips: (mountain: Mountain) => void;
  onEventsPress: (mountainId: string) => void;
}) {
  const diffColor = DIFFICULTY_COLORS[mountain.difficulty] ?? '#FFF';

  // Bundled local video for this mountain (if one is registered for its ID).
  // Home is video-only: no `image_url` is ever read or fetched here.
  const localVideo = MOUNTAIN_VIDEOS[mountain.id];

  return (
    <View style={[styles.fullScreenContainer, { width, height }]}>
      <View style={styles.videoWrapper}>
        {localVideo ? (
          <>
            {poster ? (
              <ExpoImage source={poster} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={styles.fullScreenVideoPlaceholder}>
                <Ionicons name="videocam-outline" size={80} color="#8B7355" />
              </View>
            )}
            {isActive && videoReady && <VideoViewPlayer player={videoPlayer} />}
          </>
        ) : (
          <View style={styles.fullScreenVideoPlaceholder}>
            <Ionicons name="videocam-outline" size={80} color="#8B7355" />
          </View>
        )}
      </View>

      <View style={styles.fullScreenGradient} />

      <View style={[styles.floatingInfoContainer, isPortrait && styles.floatingInfoContainerPortrait]}>
        {mountain.funny_warning && (
          <Text style={styles.funnyWarningText}>{mountain.funny_warning}</Text>
        )}

        {/* Meta row: difficulty + elevation + events button */}
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
          >
            <Ionicons name="calendar-outline" size={11} color="#C9A96E" />
            <Text style={styles.eventsPillText}>Events</Text>
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
            accessibilityLabel={`Open ${mountain.name} tips and guide`}
          >
            <Ionicons name="information-circle-outline" size={22} color={ACCENT_GOLD} />
          </TouchableOpacity>
        </View>

        <Text style={styles.mountainDescription} numberOfLines={2}>
          {mountain.description}
        </Text>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuthStore();
  const { setSelectedMountainId } = useWildTrackStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));
  const [profileCardVisible, setProfileCardVisible] = useState(false);
  const [tipsMountain, setTipsMountain] = useState<MountainTips | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [mountains] = useState<Mountain[]>(() => mountainService.getCachedMountains());
  const initialVideoMountainId = mountains[0] && MOUNTAIN_VIDEOS[mountains[0].id]
    ? mountains[0].id
    : null;
  const initialVideoSource = initialVideoMountainId
    ? MOUNTAIN_VIDEOS[initialVideoMountainId]
    : Object.values(MOUNTAIN_VIDEOS)[0];
  const videoPlayer = useVideoPlayer(initialVideoSource, (player) => {
    player.loop = true;
    player.muted = true;
  });
  const [videoPosters, setVideoPosters] = useState<Record<string, VideoThumbnail>>(
    () => getHomeVideoPosters()
  );
  const [videoReady, setVideoReady] = useState(false);
  const activeMountainId = useRef<string | null>(mountains[0]?.id ?? null);
  const loadedMountainId = useRef<string | null>(initialVideoMountainId);
  const videoPositions = useRef<Record<string, number>>({});
  const switchRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);

  const isPortrait = dimensions.height > dimensions.width;

  const capturePoster = useCallback(async (mountainId: string, time: number) => {
    try {
      const [poster] = await videoPlayer.generateThumbnailsAsync(time, {
        maxWidth: 640,
        maxHeight: 360,
      });
      if (poster) {
        setVideoPosters((current) => ({ ...current, [mountainId]: poster }));
      }
    } catch (posterError) {
      console.warn(`[Home] Could not create video poster for ${mountainId}:`, posterError);
    }
  }, [videoPlayer]);

  useEffect(() => {
    const mountain = mountains[activeIndex];
    const mountainId = mountain?.id ?? null;
    const source = mountainId ? MOUNTAIN_VIDEOS[mountainId] : undefined;
    const currentLoadedId = loadedMountainId.current;
    const requestId = ++switchRequest.current;
    activeMountainId.current = mountainId;

    if (!mountainId || !source) {
      videoPlayer.pause();
      setVideoReady(false);
      return;
    }

    if (currentLoadedId === mountainId) {
      setVideoReady(videoPlayer.status === 'readyToPlay');
      videoPlayer.play();
      if (!videoPosters[mountainId]) {
        void capturePoster(mountainId, 0);
      }
      return;
    }

    if (currentLoadedId) {
      videoPositions.current[currentLoadedId] = videoPlayer.currentTime;
    }

    videoPlayer.pause();
    setVideoReady(false);
    let cancelled = false;

    videoPlayer.replaceAsync(source).then(() => {
      if (cancelled || requestId !== switchRequest.current) return;

      const savedPosition = videoPositions.current[mountainId] ?? 0;
      if (savedPosition > 0 && savedPosition < videoPlayer.duration) {
        videoPlayer.currentTime = savedPosition;
      }

      loadedMountainId.current = mountainId;
      setVideoReady(videoPlayer.status === 'readyToPlay');
      videoPlayer.play();
      if (!videoPosters[mountainId]) {
        void capturePoster(mountainId, 0);
      }
    }).catch((loadError) => {
      if (!cancelled && requestId === switchRequest.current) {
        console.warn('[Home] Failed to load mountain video:', loadError);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeIndex, capturePoster, mountains, videoPlayer, videoPosters]);

  useEffect(() => {
    const subscription = videoPlayer.addListener('statusChange', ({ status }) => {
      setVideoReady(
        status === 'readyToPlay' && loadedMountainId.current === activeMountainId.current
      );
    });
    return () => subscription.remove();
  }, [videoPlayer]);

  useEffect(() => {
    if (mountains.length === 0) {
      setError('Mountain feed was not loaded yet.');
      return;
    }
    setError(null);
  }, [mountains]);

  // Force landscape orientation
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      setDimensions(screen);
    });
    return () => {
      subscription?.remove();
    };
  }, []);

  // Scroll to active index when dimensions change
  useEffect(() => {
    if (scrollViewRef.current && mountains.length > 0) {
      scrollViewRef.current.scrollTo({ x: activeIndex * dimensions.width, animated: false });
    }
  }, [dimensions, activeIndex, mountains]);

  const openProfileCard = () => setProfileCardVisible(true);
  const closeProfileCard = () => setProfileCardVisible(false);

  const handleOpenTips = useCallback((mountain: Mountain) => {
    const normalizedName = mountain.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mountainTips = MOUNTAIN_TIPS.find((tips) =>
      tips.id === mountain.id ||
      tips.mountainName.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName
    );

    if (!mountainTips) {
      Alert.alert('Guide not available', `Tips for ${mountain.name} are not available yet.`);
      return;
    }

    setTipsMountain(mountainTips);
  }, []);
  // Stable handler for the per-slide Events button (keeps MountainSlide memoized)
  const handleEventsPress = useCallback(
    (mountainId: string) => {
      router.push({
        pathname: '/events/Events',
        params: { mountainId },
      } as any);
    },
    [router]
  );

  // Logout toast state
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

  // Back handler
  useEffect(() => {
    const onBack = () => {
      if (profileCardVisible) {
        closeProfileCard();
        return true;
      }
      if (showLogoutConfirm) {
        dismissLogoutConfirm();
        return true;
      }
      openLogoutConfirm();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [profileCardVisible, showLogoutConfirm, openLogoutConfirm, dismissLogoutConfirm]);

  // Loading / error states
  if (error) {
    return (
      <View style={styles.immersiveContainer}>
        <Text style={{ color: 'white', textAlign: 'center', margin: 20 }}>Error: {error}</Text>
      </View>
    );
  }
  if (mountains.length === 0) {
    return (
      <View style={styles.immersiveContainer}>
        <Text style={{ color: 'white', textAlign: 'center', margin: 20 }}>Preparing your mountain feed...</Text>
      </View>
    );
  }

  const handleCTAPress = (mountainId: string) => {
    router.push({
      pathname: '/MountainTop',
      params: { mountainId },
    });
  };

  return (
    <View style={styles.immersiveContainer}>
      {/* Full Screen Horizontal Scroll */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / dimensions.width);
          const outgoingMountain = mountains[activeIndex];
          if (outgoingMountain && loadedMountainId.current === outgoingMountain.id) {
            const time = videoPlayer.currentTime;
            videoPositions.current[outgoingMountain.id] = time;
            void capturePoster(outgoingMountain.id, time);
          }

          activeMountainId.current = mountains[newIndex]?.id ?? null;
          setActiveIndex(newIndex);

          if (mountains[newIndex]) {
            setSelectedMountainId(mountains[newIndex].id);
          }
        }}
        decelerationRate="fast"
      >
        {mountains.map((mountain, index) => (
          <MountainSlide
            key={mountain.id}
            mountain={mountain}
            isActive={index === activeIndex}
            poster={videoPosters[mountain.id]}
            videoPlayer={videoPlayer}
            videoReady={videoReady}
            width={dimensions.width}
            height={dimensions.height}
            isPortrait={isPortrait}
            onOpenTips={handleOpenTips}
            onEventsPress={handleEventsPress}
          />
        ))}
      </Animated.ScrollView>

      {/* Floating Header */}
      <View style={[styles.transparentHeader, !isPortrait && styles.transparentHeaderLandscape]}>
        <TouchableOpacity
          onPress={openProfileCard}
          style={styles.profileButton}
          activeOpacity={0.8}
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

        {/* Header actions on the right */}
        <View style={styles.headerRightButtons}>
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
          <TouchableOpacity
            onPress={() => router.push('/chat/Chat' as any)}
            style={styles.chatButton}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#C9A96E" />
          </TouchableOpacity>
        </View>
      </View>

      <ProfileCard
        visible={profileCardVisible}
        onClose={closeProfileCard}
        onRequestLogout={() => {
          closeProfileCard();
          openLogoutConfirm();
        }}
        profileImage={profileImage}
        onProfileImageSelect={setProfileImage}
      />

      <Modal
        visible={tipsMountain !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setTipsMountain(null)}
      >
        {tipsMountain ? (
          <TipsAndTricks
            mountainTips={tipsMountain}
            onBack={() => setTipsMountain(null)}
          />
        ) : null}
      </Modal>

      {/* CTA button – shown on every slide */}
      {/* CTA button */}
      {mountains[activeIndex] && (
        <TouchableOpacity
          style={[styles.ctaAbsolute, isPortrait && styles.ctaAbsolutePortrait]}
          onPress={() => handleCTAPress(mountains[activeIndex].id)}
          activeOpacity={0.75}
        >
          <View style={styles.ctaLogoWrap}>
            <View style={styles.ctaGlowRing} />
            <Image
              source={require('../../assets/images/SakaLogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logoLabel}>Tara, Saka</Text>
        </TouchableOpacity>
      )}

      {/* Pagination */}
      <View style={styles.paginationFixed}>
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

      {/* Logout Toast */}
      {showLogoutConfirm && (
        <Animated.View style={[styles.logoutToast, { opacity: logoutToastOpacity, transform: [{ translateY: logoutToastY }] }]}>
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

const styles = StyleSheet.create({
  immersiveContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRightWidth: 2,
    borderRightColor: 'rgba(201,169,110,0.3)',
  },
  videoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Solid "poster" surface. Deliberately not pure black so a slide that is
    // waiting on its video (or has no bundled video) still reads as a themed
    // surface rather than a void.
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenVideoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
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
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 24,
    paddingBottom: 22,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  floatingInfoContainerPortrait: {
    paddingBottom: 36,
  },
  ctaAbsolute: {
    position: 'absolute',
    bottom: 22,
    right: 24,
    zIndex: 250,
    elevation: 0,
    alignItems: 'center',
    gap: 0,
  },
  ctaAbsolutePortrait: {
    bottom: 36,
  },
  ctaLogoWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaGlowRing: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(201,169,110,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 168,
    height: 168,
  },
  logoLabel: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: -40,
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
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  guideButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
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
  elevationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
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
  eventsPillText: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mountainDescription: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: '65%',
  },
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
  mountainNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gap,
    maxWidth: '68%',
    marginBottom: 6,
  },
  floatingMountainNamePortrait: {
    fontSize: 52,
    lineHeight: 56,
  },
  transparentHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 100,
  },
  transparentHeaderPortrait: {
    paddingTop: 60,
  },
  transparentHeaderLandscape: {
    paddingTop: 18,
  },
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
  },
  profileAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    backgroundColor: BG_SUBTLE,
    alignItems: 'center',
    borderColor: BORDER_SUBTLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  profilePresenceDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#6FAF8A',
    borderWidth: 1.5,
    borderColor: '#0A101A',
  },
  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(201,169,110,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(201,169,110,0.2)',
    marginHorizontal: 10,
  },
  profileTextContainer: {
    justifyContent: 'center',
    marginRight: 8,
  },
  profileGreeting: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  profileChevronWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationFixed: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  paginationStack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    backgroundColor: '#C9A96E',
    width: 26,
    height: 6,
    borderRadius: 3,
  },
  paginationDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  logoutToast: {
    position: 'absolute',
    bottom: 32,
    left: '10%',
    right: '10%',
    flexDirection: 'row',
    backgroundColor: '#141E2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
    overflow: 'hidden',
    zIndex: 999,
    elevation: 20,
  },
  logoutToastBar: {
    width: 3,
    backgroundColor: '#BF6A6A',
    alignSelf: 'stretch',
  },
  logoutToastInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logoutToastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  logoutToastMsg: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  logoutToastActions: {
    flexDirection: 'row',
    gap: 8,
  },
  logoutToastCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoutToastCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutToastConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#BF6A6A',
  },
  logoutToastConfirmText: {
    color: '#0E1520',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(10,16,26,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.18)',
  },
});