import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

// Change this one line to whatever you want under the logo.
const SUBTITLE = 'Hiking Trails of Aklan';

export default function IntroScreen() {
  const router = useRouter();
  const isMounted = useRef(true);
  const { width: screenW } = useWindowDimensions();

  const glowFade   = useRef(new Animated.Value(0)).current;
  const logoFade   = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(12)).current;
  const quoteFade  = useRef(new Animated.Value(0)).current;
  const ridgeFade  = useRef(new Animated.Value(0)).current;
  const barWidth   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    isMounted.current = true;

    // Background: ridges fade in slowly, glow fades in then keeps gently breathing
    Animated.timing(ridgeFade, { toValue: 1, duration: 2800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();

    Animated.sequence([
      Animated.timing(glowFade, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowFade, { toValue: 0.55, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowFade, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Foreground: logo, then subtitle, then quote, paced across about 4.5s
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(logoFade,  { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(textFade,  { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(quoteFade, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    Animated.timing(barWidth, {
      toValue: 1,
      duration: 6000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      router.replace('/Login');
    }, 6000);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      glowFade.stopAnimation();
    };
  }, [router]);

  const ridgeHeight = Math.round(screenW * 0.6);

  return (
    <View style={styles.root}>

      {/* Mountain ridgelines along the bottom: three layers, far to near */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ridgeWrap, { height: ridgeHeight, opacity: ridgeFade }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice">
          {/* far range */}
          <Path
            d="M0 150 L40 118 L70 138 L115 82 L150 120 L190 96 L235 140 L280 100 L320 132 L360 108 L400 134 L400 240 L0 240 Z"
            fill="#0D1522"
          />
          {/* mid range */}
          <Path
            d="M0 180 L50 146 L90 168 L140 118 L185 160 L230 132 L275 170 L325 138 L370 164 L400 150 L400 240 L0 240 Z"
            fill="#0B111B"
          />
          {/* near range */}
          <Path
            d="M0 212 L60 186 L110 204 L170 172 L225 202 L285 180 L340 204 L400 188 L400 240 L0 240 Z"
            fill="#090E16"
          />
          {/* gold edge on the far range, one quiet highlight */}
          <Path
            d="M115 82 L150 120 M190 96 L235 140 M280 100 L320 132"
            stroke="#C9A96E"
            strokeOpacity={0.18}
            strokeWidth={0.8}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Logo with soft gold glow behind it */}
      <Animated.View style={[styles.logoWrap, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
        <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowFade }]}>
          <Svg width={460} height={460}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#C9A96E" stopOpacity={0.10} />
                <Stop offset="55%" stopColor="#C9A96E" stopOpacity={0.03} />
                <Stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={230} cy={230} r={230} fill="url(#glow)" />
          </Svg>
        </Animated.View>
        <Image
          source={require('../../assets/images/SakaLogo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={[styles.nameWrap, { opacity: textFade, transform: [{ translateY: textSlide }] }]}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </View>
        <Text style={styles.appSub}>{SUBTITLE}</Text>
      </Animated.View>

      {/* Quote */}
      <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
        <Text style={styles.quoteText}>
          {'\u201C'}Don{'\u2019'}t look up at the mountain in awe.{'\n'}
          Climb it until the mountain looks up at you.{'\u201D'}
        </Text>
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

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Mountains
  ridgeWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  glow: {
    position: 'absolute',
    width: 460,
    height: 460,
    left: (290 - 460) / 2,
    top: (290 - 460) / 2,
  },
  logoImage: {
    width: 290,
    height: 290,
  },

  // Subtitle
  nameWrap: {
    alignItems: 'center',
    marginTop: -70,
    marginBottom: 28,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(201, 169, 110, 0.55)',
  },
  dividerDiamond: {
    width: 5,
    height: 5,
    marginHorizontal: 8,
    backgroundColor: '#C9A96E',
    transform: [{ rotate: '45deg' }],
  },
  appSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  // Quote
  quoteWrap: {
    marginBottom: 90, // leaves room for the ridgelines below
    paddingHorizontal: 8,
  },
  quoteText: {
    color: 'rgba(255,255,255,0.38)',
    fontFamily: SERIF,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Progress bar
  barTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#C9A96E',
  },
});