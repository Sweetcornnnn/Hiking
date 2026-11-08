// AdminModal.tsx: shared modal window for every Admin popup.
// Same backdrop as TutorialModal: a real transparent Modal (animationType none, status + nav
// bars covered) with a dark navy scrim, rgba(4,8,13,0.66), that fades in/out on its own while
// the card springs up (translateY 32 -> 0, scale .94 -> 1). Tapping the scrim closes it.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

export interface AdminModalProps {
  visible: boolean;
  onClose: () => void;
  align?: 'center' | 'bottom';
  /** true = ignore backdrop taps and the back button (e.g. while saving) */
  locked?: boolean;
  children: React.ReactNode;
}

export default function AdminModal({ visible, onClose, align = 'center', locked = false, children }: AdminModalProps) {
  const { height } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      enter.stopAnimation();
      enter.setValue(0);
      Animated.spring(enter, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }).start();
    } else {
      enter.stopAnimation();
      Animated.timing(enter, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMounted(false);
        }
      );
    }
  }, [visible, enter]);

  const bottom = align === 'bottom';
  const cardStyle = {
    opacity: enter.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [bottom ? Math.min(height * 0.5, 360) : 32, 0] }) },
      ...(bottom ? [] : [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }]),
    ],
  };

  const close = () => {
    if (!locked) onClose();
  };

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={close}
    >
      <View style={[styles.root, bottom ? styles.rootBottom : styles.rootCenter]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]} />
        </Pressable>
        <Animated.View
          pointerEvents="box-none"
          style={[{ width: '100%', alignItems: 'center', maxHeight: height * (bottom ? 0.92 : 0.85) }, cardStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  rootCenter: { justifyContent: 'center', padding: 24 },
  rootBottom: { justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(4,8,13,0.66)' },
});