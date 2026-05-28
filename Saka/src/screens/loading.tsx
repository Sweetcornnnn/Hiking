import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import {
  BG_PANEL,
  BG_CARD,
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../theme/designTokens';

const { width, height } = Dimensions.get('window');
const isLandscape = width >= height;

interface LoadingScreenProps {
  onComplete?: () => void;
  loadingDuration?: number;
}

export default function LoadingScreen({
  onComplete,
  loadingDuration = 5000,
}: LoadingScreenProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: loadingDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Pulsing animation for GIF container
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

    // Navigate after loading completes
    const navigationTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        // Navigate based on user role
        if (user?.is_admin) {
          router.replace('/drawer/admin/[...admin]');
        } else {
          router.replace('/drawer/home');
        }
      }
    }, loadingDuration + 300);

    // Cleanup
    return () => {
      clearTimeout(navigationTimer);
      pulseAnimation.stop();
      fadeAnim.setValue(0);
      progressAnim.setValue(0);
      pulseAnim.setValue(1);
    };
  }, [fadeAnim, progressAnim, pulseAnim, loadingDuration, onComplete, router, user]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* GIF Container */}
        <Animated.View
          style={[
            styles.gifContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/hikingloader.gif')}
            style={styles.gif}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth,
                },
              ]}
            />
          </View>
        </View>

        {/* Loading Text */}
        <Text style={styles.loadingText}>Loading your adventure...</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isLandscape ? 48 : 32,
  },

  gifContainer: {
    width: isLandscape ? 320 : 260,
    height: isLandscape ? 320 : 260,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isLandscape ? 36 : 28,
  },

  gif: {
    width: '100%',
    height: '100%',
  },

  progressContainer: {
    width: '100%',
    paddingHorizontal: isLandscape ? 48 : 32,
    marginBottom: isLandscape ? 18 : 14,
  },

  progressTrack: {
    width: '100%',
    height: isLandscape ? 6 : 5,
    backgroundColor: BG_CARD,
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: ACCENT_GOLD,
    borderRadius: 3,
  },

  loadingText: {
    color: TEXT_MUTED,
    fontSize: isLandscape ? 13 : 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
