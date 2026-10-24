import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, useLoop, withAlpha } from './Primitives';

const TREE_H = 58;

function Leaf({ left, duration, drift }: { left: number; duration: number; drift: number }) {
  const fall = useLoop(duration);
  return (
    <Animated.View
      style={[
        styles.leaf,
        {
          left,
          opacity: fall.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: fall.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift, -drift / 2] }) },
            { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 38] }) },
            { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '200deg'] }) },
          ],
        },
      ]}
    />
  );
}

/** A tree sways and drops leaves, and a bin lid tips open: leave the mountain as you found it. */
export default function EtiquetteScene() {
  const sway = useLoop(2200, 'pingpong');
  const lid = useLoop(1800, 'pingpong');

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] });
  const lidRotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-24deg'] });

  return (
    <>
      <View style={styles.ground} />

      <Animated.View
        style={[
          styles.tree,
          { transform: [{ translateY: TREE_H / 2 }, { rotate }, { translateY: -TREE_H / 2 }] },
        ]}
      >
        <View style={styles.trunk} />
        <View style={[styles.canopy, { left: 6, top: 0, width: 32, height: 32, backgroundColor: PALETTE.sage }]} />
        <View style={[styles.canopy, { left: 0, top: 14, width: 24, height: 24, backgroundColor: '#6F9A55' }]} />
        <View style={[styles.canopy, { left: 20, top: 14, width: 24, height: 24, backgroundColor: '#6F9A55' }]} />
      </Animated.View>

      <Leaf left={58} duration={3200} drift={10} />
      <Leaf left={72} duration={4000} drift={-12} />
      <Leaf left={84} duration={3600} drift={8} />

      <View style={styles.bin} />
      <Animated.View style={[styles.lid, { transform: [{ rotate: lidRotate }] }]} />
    </>
  );
}

const styles = StyleSheet.create({
  ground: {
    position: 'absolute', left: 14, top: 72, width: 112, height: 3, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.sage, 0.4),
  },
  tree: { position: 'absolute', left: 36, top: 14, width: 44, height: TREE_H },
  trunk: {
    position: 'absolute', left: 18, top: 30, width: 8, height: 28, borderRadius: 2,
    backgroundColor: PALETTE.bark,
  },
  canopy: { position: 'absolute', borderRadius: 20 },
  leaf: {
    position: 'absolute', top: 30, width: 7, height: 4, borderRadius: 3,
    backgroundColor: PALETTE.sage,
  },
  bin: {
    position: 'absolute', left: 106, top: 54, width: 16, height: 18, borderRadius: 3,
    backgroundColor: withAlpha(PALETTE.paper, 0.25), borderWidth: 1, borderColor: withAlpha(PALETTE.paper, 0.5),
  },
  lid: {
    position: 'absolute', left: 103, top: 50, width: 22, height: 4, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.paper, 0.6),
  },
});