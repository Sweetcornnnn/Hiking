import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
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
      Animated.parallel([
        Animated.timing(logoFade,  { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textFade,  { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(quoteFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

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

      {/* Logo — swap the require() path to your actual logo file */}
      <Animated.View style={[styles.logoWrap, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
          <Image
            source={require('../../assets/images/SakaLogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={[styles.nameWrap, { opacity: textFade, transform: [{ translateY: textSlide }] }]}>
        <View style={styles.nameDivider} />
        <Text style={styles.appSub}>Philippine Hiking Trails</Text>
      </Animated.View>

      {/* Quote */}
      <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
        <Text style={styles.quoteText}>"The mountain doesn't care if you'll make it.{'\n'}you do."</Text>
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
    marginBottom: 0,
    position: 'relative',
  },
  logoImage: {
    width: 290,
    height: 290,
  },

  // App name
  nameWrap: {
    alignItems: 'center',
    marginTop: -70,
    marginBottom: 16, // was 28
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
    marginVertical: 4,
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
    marginBottom: 40,   // was 64
    paddingHorizontal: 16,
  },
  quoteText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 12,       // was 13
    lineHeight: 18,     // was 20
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