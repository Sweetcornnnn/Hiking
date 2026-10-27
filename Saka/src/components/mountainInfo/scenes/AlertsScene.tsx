import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PALETTE, useLoop, withAlpha } from './Primitives';

interface AlertsSceneProps {
  /** Beacon colour, chosen from the most severe active alert. */
  accent: string;
  /** No active alerts: the beacon glows softly instead of signalling. */
  calm?: boolean;
}

function Ring({ accent, duration }: { accent: string; duration: number }) {
  const t = useLoop(duration);
  return (
    <Animated.View
      style={[
        styles.ring,
        {
          borderColor: accent,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
        },
      ]}
    />
  );
}

/** A warning beacon: rings radiate outward when something needs attention, and it rests when all is clear. */
export default function AlertsScene({ accent, calm = false }: AlertsSceneProps) {
  const flash = useLoop(calm ? 2400 : 650, 'pingpong');
  const glow = flash.interpolate({ inputRange: [0, 1], outputRange: calm ? [0.55, 0.8] : [0.6, 1] });
  const rayOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.9] });

  return (
    <>
      {!calm ? (
        <>
          <Ring accent={accent} duration={1800} />
          <Ring accent={accent} duration={2300} />
        </>
      ) : null}

      {!calm ? (
        <>
          <Animated.View style={[styles.ray, { left: 40, top: 38, backgroundColor: accent, opacity: rayOpacity, transform: [{ rotate: '-28deg' }] }]} />
          <Animated.View style={[styles.ray, { left: 36, top: 50, backgroundColor: accent, opacity: rayOpacity }]} />
          <Animated.View style={[styles.ray, { left: 94, top: 38, backgroundColor: accent, opacity: rayOpacity, transform: [{ rotate: '28deg' }] }]} />
          <Animated.View style={[styles.ray, { left: 98, top: 50, backgroundColor: accent, opacity: rayOpacity }]} />
        </>
      ) : null}

      <View style={styles.base} />
      <View style={styles.stem} />
      <Animated.View style={[styles.dome, { backgroundColor: accent, opacity: glow }]} />
      <View style={styles.shine} />
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute', left: 58, top: 38, width: 24, height: 24, borderRadius: 12, borderWidth: 2,
  },
  ray: { position: 'absolute', width: 10, height: 3, borderRadius: 2 },
  base: {
    position: 'absolute', left: 52, top: 62, width: 36, height: 8, borderRadius: 3,
    backgroundColor: withAlpha(PALETTE.paper, 0.28),
  },
  stem: {
    position: 'absolute', left: 56, top: 56, width: 28, height: 6, borderRadius: 2,
    backgroundColor: withAlpha(PALETTE.paper, 0.45),
  },
  dome: {
    position: 'absolute', left: 58, top: 36, width: 24, height: 20,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  shine: {
    position: 'absolute', left: 63, top: 41, width: 4, height: 8, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});