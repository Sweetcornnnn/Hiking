import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, useLoop, withAlpha } from './Primitives';

const PATH: [number, number][] = [
  [56, 72], [68, 64], [82, 68], [94, 58], [106, 60], [118, 48], [130, 42],
];
const STEPS = PATH.map((_, i) => i / (PATH.length - 1));

/** A signpost swings in the breeze while a marker walks the trail it points to. */
export default function TrailTipsScene() {
  const walk = useLoop(3200);
  const sway = useLoop(1500, 'pingpong');

  const x = walk.interpolate({ inputRange: STEPS, outputRange: PATH.map((p) => p[0] - 5) });
  const y = walk.interpolate({ inputRange: STEPS, outputRange: PATH.map((p) => p[1] - 5) });
  const walkerOpacity = walk.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] });
  const swingA = sway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  const swingB = sway.interpolate({ inputRange: [0, 1], outputRange: ['3deg', '-3deg'] });

  return (
    <>
      {PATH.map(([px, py]) => (
        <View key={`${px}-${py}`} style={[styles.dot, { left: px - 2.5, top: py - 2.5 }]} />
      ))}
      <Animated.View
        style={[styles.walker, { opacity: walkerOpacity, transform: [{ translateX: x }, { translateY: y }] }]}
      />

      <View style={styles.pole} />
      <Animated.View style={[styles.board, styles.boardTop, { transform: [{ rotate: swingA }] }]}>
        <View style={styles.boardLine} />
      </Animated.View>
      <Animated.View style={[styles.board, styles.boardBottom, { transform: [{ rotate: swingB }] }]}>
        <View style={styles.boardLine} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute', width: 5, height: 5, borderRadius: 3,
    backgroundColor: withAlpha(PALETTE.teal, 0.45),
  },
  walker: {
    position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: 5,
    backgroundColor: PALETTE.teal, borderWidth: 2, borderColor: PALETTE.paper,
  },
  pole: {
    position: 'absolute', left: 20, top: 26, width: 4, height: 46, borderRadius: 2,
    backgroundColor: PALETTE.bark,
  },
  board: { position: 'absolute', height: 11, borderRadius: 2, justifyContent: 'center', paddingLeft: 5 },
  boardTop: { left: 8, top: 28, width: 32, backgroundColor: PALETTE.teal },
  boardBottom: { left: 18, top: 43, width: 28, height: 10, backgroundColor: withAlpha(PALETTE.paper, 0.85) },
  boardLine: { width: 14, height: 2, borderRadius: 1, backgroundColor: withAlpha(PALETTE.ink, 0.35) },
});