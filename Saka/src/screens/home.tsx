// screens/Home.tsx
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
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import { useWildTrackStore } from '../store/wildtrackStore';
import ProfileCard from '../components/ProfileCard';
import GlobalChatNotifier from '../components/chat/GlobalChatNotifier'; // <-- NEW
import { mountainService, Mountain } from '../services/mountainService';
import { uploadProfileAvatar } from '../services/profileAvatarService';
import {
  getHomeVideoPosters,
  subscribeHomeVideoPosters,
  preloadHomeVideoPosters,
  MOUNTAIN_VIDEOS,
} from '../services/homeVideoAssets';
import { ACCENT_GOLD, BG_SUBTLE, BORDER_SUBTLE, SPACING } from '../theme/designTokens';
import { useTutorial, TutorialHelpButton } from '../components/TutorialModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF81',
  Moderate: '#F0A500',
  Hard: '#E05C3A',
  Expert: '#C0392B',
};

const VIDEO_WINDOW = 1;

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
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
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
          setFirstFrameRendered(false);
          void player.replaceAsync(source).catch(() => setVideoErrored(true));
          return;
        }
        setVideoErrored(true);
        setFirstFrameRendered(false);
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
          onFirstFrameRender={() => setFirstFrameRendered(true)}
        />
      </View>
      {!firstFrameRendered ? <VideoPoster poster={poster} /> : null}
    </View>
  );
}

const MountainSlide = memo(function MountainSlide({
  mountain,
  shouldMountVideo,
  isActive,
  poster,
  width,
  height,
  isPortrait,
  onOpenTips,
  onEventsPress,
}: {
  mountain: Mountain;
  shouldMountVideo: boolean;
  isActive: boolean;
  poster: VideoThumbnail | undefined;
  width: number;
  height: number;
  isPortrait: boolean;
  onOpenTips: (mountain: Mountain) => void;
  onEventsPress: (mountainId: string) => void;
}) {
  const diffColor = DIFFICULTY_COLORS[mountain.difficulty] ?? '#FFF';
  const localVideo = MOUNTAIN_VIDEOS[mountain.id];

  return (
    <View style={[styles.fullScreenContainer, { width, height }]}>
      <View style={styles.videoWrapper}>
        {localVideo ? (
          shouldMountVideo ? (
            <MountainVideo source={localVideo} poster={poster} isActive={isActive} />
          ) : (
            <VideoPoster poster={poster} />
          )
        ) : (
          <VideoPoster poster={poster} />
        )}
      </View>
      <View style={styles.fullScreenGradient} />
      <View style={[styles.floatingInfoContainer, isPortrait && styles.floatingInfoContainerPortrait]}>
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
  const { returnToProfile } = useLocalSearchParams<{ returnToProfile?: string }>();
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { setSelectedMountainId } = useWildTrackStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));
  const [profileCardVisible, setProfileCardVisible] = useState(returnToProfile === 'true');
  const profileImage = profile?.avatar_url ?? null;
  const [mountains] = useState<Mountain[]>(() => mountainService.getCachedMountains());

  // ── NOTIFICATION BANNER STATE ──
  const [bannerData, setBannerData] = useState<{ type: string; id: string; senderName: string; content: string } | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProfileImageSelect = async (uri: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save a profile photo.');
      return;
    }
    try {
      const avatarUrl = await uploadProfileAvatar(user.id, uri);
      const result = await updateProfile({ avatar_url: avatarUrl });
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

  const [error, setError] = useState<string | null>(null);
  // Above the early returns. Skipped when arriving straight into the profile card.
  const tutorial = useTutorial('home', { ready: mountains.length > 0 && returnToProfile !== 'true' });
  const scrollViewRef = useRef<any>(null);

  const isPortrait = dimensions.height > dimensions.width;

  useEffect(() => {
    if (mountains.length === 0) {
      setError('Mountain feed was not loaded yet.');
      return;
    }
    setError(null);
  }, [mountains]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      setDimensions(screen);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (scrollViewRef.current && mountains.length > 0) {
      scrollViewRef.current.scrollTo({
        x: activeIndex * dimensions.width,
        animated: false,
      });
    }
  }, [dimensions, activeIndex, mountains]);

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

  // ── NOTIFICATION BANNER LOGIC ──
  const showBanner = useCallback((payload: any) => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    setBannerData(payload);
    
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();

    // Auto hide after 4 seconds
    bannerTimeoutRef.current = setTimeout(() => {
      Animated.timing(bannerAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setBannerData(null));
    }, 4000);
  }, [bannerAnim]);

  const handleBannerPress = () => {
    if (!bannerData) return;
    Animated.timing(bannerAnim, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => {
      setBannerData(null);
      router.push({
        pathname: bannerData.type === 'private' ? '/chat/Conversation' : '/chat/GroupChat',
        params: bannerData.type === 'private' ? { userId: bannerData.id } : { groupId: bannerData.id },
      } as any);
    });
  };

  useEffect(() => {
    const onBack = () => {
      if (profileCardVisible) { closeProfileCard(); return true; }
      if (showLogoutConfirm) { dismissLogoutConfirm(); return true; }
      openLogoutConfirm();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [profileCardVisible, showLogoutConfirm, openLogoutConfirm, dismissLogoutConfirm]);

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
        <Text style={{ color: 'white', textAlign: 'center', margin: 20 }}>
          Preparing your mountain feed...
        </Text>
      </View>
    );
  }

  const handleCTAPress = (mountainId: string) => {
    router.push({ pathname: '/MountainTop', params: { mountainId } });
  };

  return (
    <View style={styles.immersiveContainer}>
      {/* NOTIFICATION BANNER */}
      {bannerData && (
        <Animated.View
          style={[
            styles.bannerContainer,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.bannerContent}
            onPress={handleBannerPress}
            activeOpacity={0.9}
          >
            <View style={styles.bannerAvatar}>
              <Ionicons name="chatbubble" size={16} color="#FFF" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerSender}>{bannerData.senderName}</Text>
              <Text style={styles.bannerMessage} numberOfLines={1}>
                {bannerData.content}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Global Listener */}
      <GlobalChatNotifier onNotify={showBanner} />

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / dimensions.width);
          setActiveIndex(newIndex);
          if (mountains[newIndex]) setSelectedMountainId(mountains[newIndex].id);
        }}
        decelerationRate="fast"
      >
        {mountains.map((mountain, index) => {
          const distance = Math.abs(index - activeIndex);
          const shouldMountVideo = distance < VIDEO_WINDOW;
          const isActive = index === activeIndex;
          return (
            <MountainSlide
              key={mountain.id}
              mountain={mountain}
              shouldMountVideo={shouldMountVideo}
              isActive={isActive}
              poster={videoPosters[mountain.id]}
              width={dimensions.width}
              height={dimensions.height}
              isPortrait={isPortrait}
              onOpenTips={handleOpenTips}
              onEventsPress={handleEventsPress}
            />
          );
        })}
      </Animated.ScrollView>

      <View style={[styles.transparentHeader, !isPortrait && styles.transparentHeaderLandscape]}>
        <TouchableOpacity onPress={openProfileCard} style={styles.profileButton} activeOpacity={0.8}>
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
          <TutorialHelpButton onPress={tutorial.open} style={styles.helpButton} />
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

      {tutorial.element}

      <ProfileCard
        visible={profileCardVisible}
        onClose={closeProfileCard}
        onRequestLogout={() => { closeProfileCard(); openLogoutConfirm(); }}
        profileImage={profileImage}
        onProfileImageSelect={handleProfileImageSelect}
      />

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

const styles = StyleSheet.create({
  immersiveContainer: { flex: 1, backgroundColor: '#000' },
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
  fullScreenGradient: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: { width: 168, height: 168 },
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
  difficultyDot: { width: 6, height: 6, borderRadius: 3 },
  difficultyText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  guideButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
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
  headerRightButtons: { flexDirection: 'row', alignItems: 'center' },
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
  // Backdrop so the 18px help circle stays readable over video
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

  // ── BANNER STYLES ──
  bannerContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 30,
    backgroundColor: 'rgba(10, 16, 26, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bannerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(201, 169, 110, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerSender: {
    color: '#C9A96E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
});