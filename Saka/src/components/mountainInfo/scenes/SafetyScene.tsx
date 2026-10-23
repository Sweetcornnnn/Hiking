import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, useLoop, withAlpha } from './Primitives';

/** A helmeted hiker stands steady while a first-aid badge pulses beside them. */
export default function SafetyScene() {
  const breathe = useLoop(1400, 'pingpong');
  const pulse = useLoop(1100, 'pingpong');
  const ripple = useLoop(2000);

  const bob = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  const crossScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <>
      <View style={styles.ground} />

      <Animated.View style={[styles.hiker, { transform: [{ translateY: bob }] }]}>
        <View style={styles.backpack} />
        <View style={[styles.leg, { left: 12 }]} />
        <View style={[styles.leg, { left: 20 }]} />
        <View style={styles.body} />
        <View style={styles.head} />
        <View style={styles.helmet} />
      </Animated.View>

      <Animated.View
        style={[styles.badge, styles.ripple, { opacity: rippleOpacity, transform: [{ scale: rippleScale }] }]}
      />
      <Animated.View style={[styles.badge, { transform: [{ scale: crossScale }] }]}>
        <View style={styles.crossH} />
        <View style={styles.crossV} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  ground: {
    position: 'absolute',
    left: 8,
    top: 72,
    width: 124,
    height: 3,
    borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.coral, 0.4),
  },
  hiker: { position: 'absolute', left: 24, top: 26, width: 34, height: 46 },
  backpack: {
    position: 'absolute', left: 2, top: 19, width: 10, height: 18, borderRadius: 4,
    backgroundColor: PALETTE.gold,
  },
  leg: {
    position: 'absolute', top: 34, width: 5, height: 12, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.paper, 0.8),
  },
  body: {
    position: 'absolute', left: 10, top: 18, width: 16, height: 18, borderRadius: 6,
    backgroundColor: PALETTE.blue,
  },
  head: {
    position: 'absolute', left: 11, top: 5, width: 12, height: 12, borderRadius: 6,
    backgroundColor: PALETTE.paper,
  },
  helmet: {
    position: 'absolute', left: 10, top: 1, width: 14, height: 7,
    borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: PALETTE.coral,
  },
  badge: {
    position: 'absolute', left: 84, top: 28, width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: withAlpha(PALETTE.coral, 0.18),
    borderWidth: 1, borderColor: withAlpha(PALETTE.coral, 0.6),
  },
  ripple: { backgroundColor: 'transparent', borderWidth: 2, borderColor: PALETTE.coral },
  crossH: { position: 'absolute', width: 18, height: 6, borderRadius: 2, backgroundColor: PALETTE.coral },
  crossV: { position: 'absolute', width: 6, height: 18, borderRadius: 2, backgroundColor: PALETTE.coral },
});