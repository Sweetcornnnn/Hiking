import React, { useState, useCallback } from 'react';
import {
  View,
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  ImageSourcePropType,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

/** A point on the image. x and y run 0..1 across the image (0,0 = top-left). */
export type MapPoint = { id: string; x: number; y: number };

type Props = {
  source: ImageSourcePropType;
  /** 'cover' fills the screen and crops edges. 'contain' shows the whole image with navy bars. */
  fit?: 'cover' | 'contain';
  /** Optional override if resolveAssetSource reports wrong dimensions. */
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  points?: MapPoint[];
  trail?: { x: number; y: number }[];
  onPointPress?: (p: MapPoint) => void;
  /** Fires with the tapped spot as 0..1 image coordinates. Handy for placing points. */
  onImagePress?: (x: number, y: number) => void;
  onLoad?: () => void;
  onError?: () => void;
};

const MARKER = 22;

export default function ResponsiveMapImage({
  source,
  fit = 'cover',
  intrinsicWidth,
  intrinsicHeight,
  points = [],
  trail = [],
  onPointPress,
  onImagePress,
  onLoad,
  onError,
}: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Prefer explicit dimensions if provided; otherwise fall back to the asset's own size.
  const resolvedSource = Image.resolveAssetSource(source);
  const sourceWidth = intrinsicWidth ?? resolvedSource?.width ?? 0;
  const sourceHeight = intrinsicHeight ?? resolvedSource?.height ?? 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  }, []);

  // One shared transform: the image and everything drawn on it use the same numbers,
  // so points stay glued to the image at any screen size or rotation.
  const scale =
    fit === 'cover'
      ? Math.max(box.w / sourceWidth, box.h / sourceHeight)
      : Math.min(box.w / sourceWidth, box.h / sourceHeight);
  const rw = sourceWidth * scale;
  const rh = sourceHeight * scale;
  const ox = (box.w - rw) / 2;
  const oy = (box.h - rh) / 2;

  const toScreen = (nx: number, ny: number) => ({
    x: ox + nx * rw,
    y: oy + ny * rh,
  });

  const handlePress = (e: GestureResponderEvent) => {
    if (!onImagePress || rw === 0) return;
    const nx = (e.nativeEvent.locationX - ox) / rw;
    const ny = (e.nativeEvent.locationY - oy) / rh;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    onImagePress(nx, ny);
  };

  const ready = box.w > 0 && box.h > 0 && sourceWidth > 0 && sourceHeight > 0;
  const trailStr = trail
    .map(p => {
      const s = toScreen(p.x, p.y);
      return `${s.x},${s.y}`;
    })
    .join(' ');

  return (
    <Pressable style={styles.container} onLayout={onLayout} onPress={handlePress}>
      {ready && (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={source}
              style={{
                position: 'absolute',
                left: ox,
                top: oy,
                width: rw,
                height: rh,
              }}
              resizeMode="stretch"
              onLoad={onLoad}
              onError={onError}
            />
          </View>

          {trail.length >= 2 && (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Polyline
                points={trailStr}
                fill="none"
                stroke="#C9A96E"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          )}

          {points.map(p => {
            const s = toScreen(p.x, p.y);
            return (
              <TouchableOpacity
                key={p.id}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[
                  styles.markerDot,
                  { left: s.x - MARKER / 2, top: s.y - MARKER / 2 },
                ]}
                onPress={() => onPointPress?.(p)}
              >
                <View style={styles.markerInner} />
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1520', overflow: 'hidden' },
  markerDot: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: 'rgba(201, 169, 110, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C9A96E',
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C9A96E',
  },
});