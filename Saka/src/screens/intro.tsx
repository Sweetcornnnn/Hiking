import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

export default function IntroScreen() {
  const router = useRouter();

  const logoFade   = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(12)).current;
  const quoteFade  = useRef(new Animated.Value(0)).current;
  const barWidth   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo fades in first
      Animated.parallel([
        Animated.timing(logoFade,  { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      // Name + tagline slide up
      Animated.parallel([
        Animated.timing(textFade,  { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // Quote fades in
      Animated.timing(quoteFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    // Progress bar runs independently over the full 3s
    Animated.timing(barWidth, {
      toValue: 1,
      duration: 6000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => router.push('/login'), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>

      {/* Logo placeholder */}
      <Animated.View style={[styles.logoWrap, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🏔️</Text>
        </View>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>LOGO</Text>
        </View>
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={[styles.nameWrap, { opacity: textFade, transform: [{ translateY: textSlide }] }]}>
        <Text style={styles.appName}>SAKA</Text>
        <View style={styles.nameDivider} />
        <Text style={styles.appSub}>Philippine Hiking Trails</Text>
      </Animated.View>

      {/* Quote */}
      <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
        <Text style={styles.quoteText}>"The mountain does not care if you make it.{'\n'}You do."</Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, {
          width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }]} />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 36,
    position: 'relative',
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 38,
  },
  logoBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#0B1119',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
    borderRadius: 4,
  },
  logoBadgeText: {
    color: 'rgba(201,169,110,0.5)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // App name
  nameWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 14,
  },
  nameDivider: {
    width: 32,
    height: 1,
    backgroundColor: '#C9A96E',
    marginVertical: 10,
  },
  appSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Quote
  quoteWrap: {
    marginBottom: 64,
    paddingHorizontal: 16,
  },
  quoteText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Progress bar
  barTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#C9A96E',
  },
});