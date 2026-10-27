import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, useLoop, withAlpha } from './Primitives';

const ITEMS = [
  { left: 52, start: 0, style: { width: 8, height: 20, borderRadius: 3, backgroundColor: PALETTE.blue } },
  {
    left: 66, start: 0.28,
    style: { width: 16, height: 12, borderRadius: 2, backgroundColor: PALETTE.paper, transform: [{ rotate: '-8deg' }] },
  },
  { left: 84, start: 0.56, style: { width: 11, height: 11, borderRadius: 6, backgroundColor: PALETTE.coral } },
];

/** Gear drops into a backpack one piece at a time, and the pack bounces as each lands. */
export default function PreparationScene() {
  const t = useLoop(3600, 'restart', 0.99);

  const packScale = t.interpolate({
    inputRange: [0, 0.2, 0.24, 0.48, 0.52, 0.76, 0.8, 1],
    outputRange: [1, 1, 1.06, 1, 1.06, 1, 1.06, 1],
  });

  return (
    <>
      <View style={styles.shadow} />

      {ITEMS.map((item) => {
        const s = item.start;
        return (
          <Animated.View
            key={item.left}
            style={[
              styles.item,
              item.style,
              {
                left: item.left,
                opacity: t.interpolate({
                  inputRange: [0, s, s + 0.03, s + 0.2, s + 0.21, 1],
                  outputRange: [0, 0, 1, 1, 0, 0],
                }),
                transform: [
                  ...(item.style.transform ?? []),
                  {
                    translateY: t.interpolate({
                      inputRange: [0, s, s + 0.2, 1],
                      outputRange: [-14, -14, 30, 30],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}

      <Animated.View style={[styles.pack, { transform: [{ scale: packScale }] }]}>
        <View style={styles.handle} />
        <View style={styles.body} />
        <View style={styles.flap} />
        <View style={styles.buckle} />
        <View style={styles.pocket} />
      </Animated.View>
    </>
  );
}

const DARK_GOLD = '#B8955A';

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute', left: 40, top: 72, width: 62, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  item: { position: 'absolute', top: 14 },
  pack: { position: 'absolute', left: 0, top: 0, width: 140, height: 90 },
  handle: {
    position: 'absolute', left: 62, top: 27, width: 18, height: 10,
    borderWidth: 3, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderColor: PALETTE.gold,
  },
  body: {
    position: 'absolute', left: 46, top: 34, width: 50, height: 40,
    borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    backgroundColor: PALETTE.gold,
  },
  flap: {
    position: 'absolute', left: 46, top: 34, width: 50, height: 15,
    borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    backgroundColor: DARK_GOLD,
  },
  buckle: {
    position: 'absolute', left: 67, top: 45, width: 8, height: 6, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.ink, 0.5),
  },
  pocket: {
    position: 'absolute', left: 56, top: 54, width: 30, height: 16, borderRadius: 6,
    backgroundColor: DARK_GOLD,
  },
});