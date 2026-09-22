import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ToastOptions {
  type?: 'success' | 'error';
  title: string;
  message?: string;
}

export interface ToastHandle {
  show: (options: ToastOptions) => void;
}

// Small top-anchored notification card, styled to match the app instead of
// relying on the OS's default Alert dialog. Usage: keep a ref, render
// <Toast ref={toastRef} /> once in the screen, call toastRef.current?.show(...).
const Toast = forwardRef<ToastHandle>((_props, ref) => {
  const [content, setContent] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show: ({ type = 'success', title, message }) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setContent({ type, title, message });

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -80,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setContent(null));
      }, 2400);
    },
  }));

  if (!content) {
    return null;
  }

  const isSuccess = content.type !== 'error';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        isSuccess ? styles.toastSuccess : styles.toastError,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={[styles.iconWrap, isSuccess ? styles.iconWrapSuccess : styles.iconWrapError]}>
        <Ionicons
          name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
          size={18}
          color={isSuccess ? '#6EAF8A' : '#E07070'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toastTitle}>{content.title}</Text>
        {content.message ? (
          <Text style={styles.toastMessage} numberOfLines={2}>{content.message}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

export default Toast;

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 14,
    zIndex: 999,
  },
  toastSuccess: {
    borderColor: 'rgba(110,175,138,0.3)',
  },
  toastError: {
    borderColor: 'rgba(224,112,112,0.3)',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSuccess: {
    backgroundColor: 'rgba(110,175,138,0.12)',
  },
  iconWrapError: {
    backgroundColor: 'rgba(224,112,112,0.12)',
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toastMessage: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});