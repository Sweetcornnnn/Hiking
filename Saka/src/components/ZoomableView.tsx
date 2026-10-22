/**
 * ZoomableView — wrap anything to make it zoomable.
 *
 *   <ZoomableView>
 *     <ResponsiveMapImage ... />
 *   </ZoomableView>
 *
 *  • Pinch to zoom (centered on your fingers)
 *  • Drag to pan once zoomed in (can't drag past the edges)
 *  • Double-tap to zoom in, double-tap again to reset
 *  • A small button appears while zoomed to jump back to 1×
 *
 * Needs: npx expo install react-native-gesture-handler react-native-reanimated
 * (reanimated's babel plugin must be set up — Expo's default babel config does this)
 */

import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface ZoomableViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Turn zoom off without unmounting (e.g. while calibrating tap positions). */
  enabled?: boolean;
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
}

const SETTLE_MS = 200;

export default function ZoomableView({
  children,
  style,
  enabled = true,
  minScale = 1,
  maxScale = 4,
  doubleTapScale = 2.5,
}: ZoomableViewProps) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Values captured when a gesture starts
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startFx = useSharedValue(0);
  const startFy = useSharedValue(0);

  const [zoomed, setZoomed] = useState(false);

  useAnimatedReaction(
    () => scale.value > 1.02,
    (isZoomed, prev) => {
      if (isZoomed !== prev) runOnJS(setZoomed)(isZoomed);
    }
  );

  // Keep the content from being dragged past its own edges.
  const clamp = (t: number, s: number, size: number) => {
    'worklet';
    const max = (size * s - size) / 2;
    return Math.min(max, Math.max(-max, t));
  };

  const settle = () => {
    'worklet';
    const s = Math.min(maxScale, Math.max(minScale, scale.value));
    scale.value = withTiming(s, { duration: SETTLE_MS });
    tx.value = withTiming(clamp(tx.value, s, width.value), { duration: SETTLE_MS });
    ty.value = withTiming(clamp(ty.value, s, height.value), { duration: SETTLE_MS });
  };

  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart((e) => {
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
      startFx.value = e.focalX - width.value / 2;
      startFy.value = e.focalY - height.value / 2;
    })
    .onUpdate((e) => {
      // Slight rubber-band past the limits; settle() eases it back on release.
      const s = Math.min(maxScale * 1.15, Math.max(minScale * 0.85, startScale.value * e.scale));
      const ratio = s / startScale.value;
      const fx = e.focalX - width.value / 2;
      const fy = e.focalY - height.value / 2;
      scale.value = s;
      // Keep the point under your fingers fixed while scaling (and follow them if they drift)
      tx.value = fx - ratio * (startFx.value - startTx.value);
      ty.value = fy - ratio * (startFy.value - startTy.value);
    })
    .onEnd(() => settle());

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minPointers(1)
    .maxPointers(1)
    .minDistance(6)
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1.001) return;
      tx.value = clamp(startTx.value + e.translationX, scale.value, width.value);
      ty.value = clamp(startTy.value + e.translationY, scale.value, height.value);
    });

  const doubleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.value > 1.05) {
        scale.value = withTiming(1, { duration: SETTLE_MS });
        tx.value = withTiming(0, { duration: SETTLE_MS });
        ty.value = withTiming(0, { duration: SETTLE_MS });
      } else {
        const s = doubleTapScale;
        const fx = e.x - width.value / 2;
        const fy = e.y - height.value / 2;
        scale.value = withTiming(s, { duration: SETTLE_MS });
        tx.value = withTiming(clamp(fx * (1 - s), s, width.value), { duration: SETTLE_MS });
        ty.value = withTiming(clamp(fy * (1 - s), s, height.value), { duration: SETTLE_MS });
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  };

  const reset = () => {
    scale.value = withTiming(1, { duration: SETTLE_MS });
    tx.value = withTiming(0, { duration: SETTLE_MS });
    ty.value = withTiming(0, { duration: SETTLE_MS });
  };

  return (
    <GestureHandlerRootView style={[styles.root, style]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, animatedStyle]}>{children}</Animated.View>
      </GestureDetector>

      {zoomed ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.resetWrap}>
          <Pressable
            onPress={reset}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reset zoom"
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="contract-outline" size={16} color="#C9A96E" />
          </Pressable>
        </Animated.View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  content: { flex: 1 },
  resetWrap: { position: 'absolute', right: 16, bottom: 20 },
  resetBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,21,32,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.4)',
  },
});