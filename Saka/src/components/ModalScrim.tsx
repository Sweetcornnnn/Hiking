import React from 'react';
import { Animated, Platform, StyleSheet, View, type ModalProps, type ViewStyle } from 'react-native';

/**
 * Full-bleed dim backdrop for transparent <Modal>s.
 *
 * Must be rendered as the FIRST child of a <Modal transparent
 * statusBarTranslucent navigationBarTranslucent>. Because the Modal window
 * itself extends under the status bar / camera cutout, absoluteFill here
 * covers those regions too — no top strip leaks through.
 *
 * `opacity` is optional: pass an Animated.Value to fade it with the card,
 * or a number for a static scrim.
 */
export function ModalScrim({
  opacity = 1,
  color = 'rgba(4,8,13,0.66)',
  style,
}: {
  opacity?: number | Animated.Value;
  color?: string;
  style?: ViewStyle;
}) {
  const isAnimated = typeof opacity !== 'number';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color },
        isAnimated ? { opacity } : { opacity },
        style,
      ]}
    />
  );
}

/**
 * Shared props that make a transparent Modal's window cover the notch area.
 * Spread these onto every <Modal transparent>.
 */
export const FULLSCREEN_MODAL_PROPS: Pick<
  ModalProps,
  | 'transparent'
  | 'statusBarTranslucent'
  | 'navigationBarTranslucent'
  | 'presentationStyle'
  | 'supportedOrientations'
> = {
  transparent: true,
  statusBarTranslucent: true,
  navigationBarTranslucent: true,
  presentationStyle: 'overFullScreen',
  supportedOrientations: [
    'portrait',
    'landscape',
    'landscape-left',
    'landscape-right',
  ],
};