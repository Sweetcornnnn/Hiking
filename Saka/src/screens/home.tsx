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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import * as ScreenOrientation from 'expo-screen-orientation';
import ProfileCard from '../components/ProfileCard';
import { mountainService, Mountain } from '../services/mountainService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF81',
  Moderate: '#F0A500',
  Hard: '#E05C3A',
  Expert: '#C0392B',
};

// Video player component (unchanged, but now accepts a URI source)
function VideoViewPlayer({ source, isActive }: { source: { uri: string }; isActive: boolean }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.staysActiveInBackground = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      player.replay();
    });
    return () => sub.remove();
  }, [player]);

  return (
    <VideoView
      style={[styles.fullScreenVideo, !isActive && styles.hiddenVideo]}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

// Memoized slide component – now dynamic and no lock logic
const MountainSlide = memo(function MountainSlide({
  mountain,
  index,
  isActive,
  width,
  height,
  isPortrait,
}: {
  mountain: Mountain;
  index: number;
  isActive: boolean;
  width: number;
  height: number;
  isPortrait: boolean;
}) {
  const diffColor = DIFFICULTY_COLORS[mountain.difficulty] ?? '#FFF';

  return (
    <View style={[styles.fullScreenContainer, { width, height }]}>
      <View style={styles.videoWrapper}>
        {mountain.video_url ? (
          <VideoViewPlayer source={{ uri: mountain.video_url }} isActive={isActive} />
        ) : mountain.image_url ? (
          <Image source={{ uri: mountain.image_url }} style={styles.fullScreenImage} resizeMode="cover" />
        ) : (
          <View style={styles.fullScreenImagePlaceholder}>
            <Ionicons name="image-outline" size={80} color="#8B7355" />
          </View>
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
        </View>
        <Text style={[styles.floatingMountainName, isPortrait && styles.floatingMountainNamePortrait]} numberOfLines={1}>
          {mountain.name}
        </Text>
        <Text style={styles.mountainDescription} numberOfLines={2}>
          {mountain.description}
        </Text>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));
  const [profileCardVisible, setProfileCardVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [mountains] = useState<Mountain[]>(() => mountainService.getCachedMountains());
  const [error, setError] = useState<string | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);

  const isPortrait = dimensions.height > dimensions.width;

  useEffect(() => {
    if (mountains.length === 0) {
      setError('Mountain feed was not loaded yet.');
      return;
    }

    setError(null);
  }, [mountains]);

  // Force landscape orientation
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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
          setActiveIndex(newIndex);
        }}
        decelerationRate="fast"
      >
        {mountains.map((mountain, index) => (
          <MountainSlide
            key={mountain.id}
            mountain={mountain}
            index={index}
            isActive={index === activeIndex}
            width={dimensions.width}
            height={dimensions.height}
            isPortrait={isPortrait}
          />
        ))}
      </Animated.ScrollView>

      {/* Floating Header (only show if user is logged in) */}
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
        {/* Chat button on the right side of the header */}
        <View style={styles.headerRightButtons}>
          <TouchableOpacity
            onPress={() => router.push('/Chat' as any)}
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

      {/* CTA button – shown on every slide */}
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

      {/* Pagination – simple dots, no locks */}
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

      {/* Logout Toast (unchanged) */}
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

// Styles (unchanged, keep exactly as before – no edits needed)
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
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenVideo: {
    opacity: 0,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  fullScreenImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2C3E50',
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
  mountainDescription: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: '65%',
  },
  floatingMountainName: {
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
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#C9A96E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C9A96E',
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
  bottom: 8,               // <-- "At the edge, but not touching" (adjust between 8–16)
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 100,
},
paginationStack: {
  flexDirection: 'row',     // Horizontal layout
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,                  // Spacing between dots
},
paginationDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
},
paginationDotActive: {
  backgroundColor: '#C9A96E',
  width: 26,               // Wider active indicator for horizontal scroll
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