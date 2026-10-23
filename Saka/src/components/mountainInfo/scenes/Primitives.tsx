import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Every scene is drawn on this fixed canvas, then scaled to fit its tile. */
export const CANVAS_W = 140;
export const CANVAS_H = 90;

/** One colour per topic. Gold stays the brand colour; the others give each scene its own personality. */
export const PALETTE = {
  gold: '#C9A96E',
  coral: '#E07A5F',
  blue: '#7C9CC4',
  teal: '#5FB3A6',
  sage: '#86B36B',
  red: '#E5484D',
  bark: '#8B6B4A',
  ink: '#1A1A1E',
  paper: '#F2EFE8',
};

/** Adds an alpha channel to a 6-digit hex colour. */
export function withAlpha(hex: string, alpha: number) {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * A looping 0 to 1 animation value. Respects the system "reduce motion"
 * setting by holding still at `rest` instead of looping.
 */
export function useLoop(duration: number, mode: 'restart' | 'pingpong' = 'restart', rest = 0.5) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        value.setValue(rest);
        return;
      }
      const easing = mode === 'pingpong' ? Easing.inOut(Easing.sin) : Easing.linear;
      const forward = Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true });
      const sequence =
        mode === 'pingpong'
          ? Animated.sequence([
              forward,
              Animated.timing(value, { toValue: 0, duration, easing, useNativeDriver: true }),
            ])
          : forward;
      loop = Animated.loop(sequence);
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [duration, mode, rest, value]);

  return value;
}

/** A mountain silhouette drawn with the border-triangle trick. */
export function Peak({
  left,
  bottom,
  width,
  height,
  color,
}: {
  left: number;
  bottom: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        bottom,
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
}

/** Measures its box and scales the fixed canvas to fit, so scenes work at any tile size. */
export function SceneFrame({
  accent,
  style,
  children,
}: {
  accent: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = box.w > 0 && box.h > 0 ? Math.min(box.w / CANVAS_W, box.h / CANVAS_H, 1.8) : 0;

  return (
    <View
      style={[styles.frame, { backgroundColor: withAlpha(accent, 0.1) }, style]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {scale > 0 ? (
        <View style={[styles.canvas, { transform: [{ scale }] }]}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  canvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    overflow: 'hidden',
  },
});