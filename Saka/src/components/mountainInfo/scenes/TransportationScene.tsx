import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, Peak, useLoop, withAlpha } from './Primitives';

function Wheel({ left, spin }: { left: number; spin: Animated.AnimatedInterpolation<string> }) {
  return (
    <Animated.View style={[styles.wheel, { left, transform: [{ rotate: spin }] }]}>
      <View style={styles.spoke} />
    </Animated.View>
  );
}

/** A van rattles up the road toward the mountains, wheels turning and dashes streaming past. */
export default function TransportationScene() {
  const road = useLoop(800);
  const bob = useLoop(350, 'pingpong');
  const spinValue = useLoop(600);
  const streak = useLoop(700);

  const dashX = road.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const vanY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const streakX = streak.interpolate({ inputRange: [0, 1], outputRange: [6, -8] });
  const streakOpacity = streak.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] });

  return (
    <>
      <Peak left={26} bottom={18} width={56} height={32} color={withAlpha(PALETTE.blue, 0.22)} />
      <Peak left={68} bottom={18} width={70} height={46} color={withAlpha(PALETTE.blue, 0.35)} />

      <View style={styles.road} />
      <View style={styles.dashClip}>
        <Animated.View style={[styles.dashRow, { transform: [{ translateX: dashX }] }]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.streak, { top: 52, opacity: streakOpacity, transform: [{ translateX: streakX }] }]} />
      <Animated.View style={[styles.streak, { top: 60, opacity: streakOpacity, transform: [{ translateX: streakX }] }]} />

      <Animated.View style={[styles.van, { transform: [{ translateY: vanY }] }]}>
        <View style={styles.roof} />
        <View style={styles.body} />
        <View style={[styles.window, { left: 12 }]} />
        <View style={[styles.window, { left: 24 }]} />
        <View style={styles.cabWindow} />
        <View style={styles.headlight} />
        <Wheel left={6} spin={spin} />
        <Wheel left={34} spin={spin} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  road: {
    position: 'absolute', left: 0, top: 72, width: 140, height: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dashClip: { position: 'absolute', left: 0, top: 77, width: 140, height: 2, overflow: 'hidden' },
  dashRow: { flexDirection: 'row', width: 260 },
  dash: { width: 14, height: 2, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.35)' },
  streak: { position: 'absolute', left: 24, width: 12, height: 2, borderRadius: 1, backgroundColor: PALETTE.paper },
  van: { position: 'absolute', left: 44, top: 41, width: 54, height: 31 },
  roof: {
    position: 'absolute', left: 8, top: 0, width: 34, height: 12, borderRadius: 5,
    backgroundColor: PALETTE.blue,
  },
  body: {
    position: 'absolute', left: 0, top: 8, width: 52, height: 18, borderRadius: 5,
    backgroundColor: PALETTE.blue,
  },
  window: {
    position: 'absolute', top: 3, width: 9, height: 6, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.ink, 0.75),
  },
  cabWindow: {
    position: 'absolute', left: 40, top: 11, width: 8, height: 7, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.ink, 0.75),
  },
  headlight: {
    position: 'absolute', left: 49, top: 19, width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#F5D77A',
  },
  wheel: {
    position: 'absolute', top: 20, width: 11, height: 11, borderRadius: 6,
    backgroundColor: PALETTE.ink, borderWidth: 2, borderColor: PALETTE.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  spoke: { width: 7, height: 2, backgroundColor: PALETTE.paper },
});