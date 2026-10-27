import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ACCENT_GOLD } from '../../theme/designTokens';

interface ContourMarkProps {
  size?: number;
  summit?: boolean;
  fade?: number;
  style?: StyleProp<ViewStyle>;
}

const rings = [
  { scale: 1, offsetX: 6, offsetY: 4, opacity: 0.18 },
  { scale: 0.76, offsetX: 3, offsetY: 2, opacity: 0.3 },
  { scale: 0.54, offsetX: 0, offsetY: 0, opacity: 0.5 },
  { scale: 0.32, offsetX: -2, offsetY: -1, opacity: 0.75 },
];

export default function ContourMark({
  size = 180,
  summit = false,
  fade = 1,
  style,
}: ContourMarkProps) {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size * 0.78, opacity: fade },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {rings.map((ring) => {
        const ringSize = size * ring.scale;
        return (
          <View
            key={ring.scale}
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize * 0.78,
                borderRadius: ringSize / 2,
                opacity: ring.opacity,
                transform: [
                  { translateX: ring.offsetX },
                  { translateY: ring.offsetY },
                  { rotate: '-8deg' },
                ],
              },
            ]}
          />
        );
      })}
      {summit ? <View style={styles.summit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: ACCENT_GOLD,
  },
  summit: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_GOLD,
  },
});
