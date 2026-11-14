import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  /** Override the default icon for this type (any Ionicons name). */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Override how long it stays on screen in ms. Use 0 to keep it until hide() is called. */
  duration?: number;
}

interface ToastProps {
  /** Kept so existing call sites don't break. The toast is always top-center now. */
  position?: 'top' | 'top-right';
  topOffset?: number;
  /** Width as a share of the screen's width. Default 0.5 (half), made for landscape. */
  widthRatio?: number;
}

export interface ToastHandle {
  show: (options: ToastOptions) => void;
  hide: () => void;
}

// One entry per notification type: color, icon and how long it should linger.
// Errors and warnings stay longer because they usually need to be read;
// loading stays until you call hide() or show() something else.
const THEME: Record<
  ToastType,
  { color: string; icon: React.ComponentProps<typeof Ionicons>['name']; duration: number }
> = {
  success: { color: '#6EAF8A', icon: 'checkmark-circle', duration: 2400 },
  error: { color: '#E07070', icon: 'close-circle', duration: 4000 },
  warning: { color: '#E3B35C', icon: 'warning', duration: 3600 },
  info: { color: '#6FA8DC', icon: 'information-circle', duration: 3000 },
  loading: { color: '#9AA7BD', icon: 'time', duration: 0 },
};

const HIDDEN_Y = -80;

const getDisplayMessage = (message?: string): string | undefined => {
  if (!message) return undefined;
  if (/\bpermission denied\b|\brow[- ]level security\b/i.test(message)) {
    return 'Permission denied.';
  }
  return message;
};

// Small top-center notification card (half the screen's width by default), styled to match the app instead of
// relying on the OS's default Alert dialog.
// Usage: keep a ref, render <Toast ref={toastRef} /> once in the screen, then
//   toastRef.current?.show({ type: 'warning', title: 'Low stock', message: '3 items left' })
//   toastRef.current?.hide()   // e.g. to dismiss a 'loading' toast
const Toast = forwardRef<ToastHandle, ToastProps>(({ topOffset = 14, widthRatio = 0.5 }, ref) => {
  const [content, setContent] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const animateOut = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: HIDDEN_Y,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      // If a new toast interrupted this animation, don't wipe its content.
      if (finished) setContent(null);
    });
  }, [translateY, opacity]);

  useImperativeHandle(
    ref,
    () => ({
      show: (options) => {
        clearTimer();
        translateY.stopAnimation();
        opacity.stopAnimation();

        const type = options.type ?? 'success';
        setContent({ ...options, type });

        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();

        const duration = options.duration ?? THEME[type].duration;
        if (duration > 0) {
          hideTimer.current = setTimeout(animateOut, duration);
        }
      },
      hide: animateOut,
    }),
    [animateOut, translateY, opacity],
  );

  useEffect(() => clearTimer, []);

  const type = content?.type ?? 'success';
  const { color, icon } = THEME[type];
  const displayMessage = getDisplayMessage(content?.message);

  return (
    <Modal
      transparent
      visible={content !== null}
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={animateOut}
    >
      <Animated.View
        pointerEvents="none"
        accessibilityRole="alert"
        accessibilityLiveRegion={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
        style={[styles.anchor, { top: topOffset, transform: [{ translateY }], opacity }]}
      >
        {content && (
          <View
            style={[
              styles.toast,
              {
                width: `${Math.round(widthRatio * 100)}%`,
                borderColor: `${color}4D`,
                borderLeftColor: color,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${color}1F` }]}>
              {type === 'loading' && !content.icon ? (
                <ActivityIndicator size="small" color={color} />
              ) : (
                <Ionicons name={content.icon ?? icon} size={18} color={color} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toastTitle}>{content.title}</Text>
              {displayMessage ? (
                <Text style={styles.toastMessage} numberOfLines={2}>
                  {displayMessage}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
});

export default Toast;

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    minWidth: 260, // stays readable if the screen is narrow (portrait)
    maxWidth: 520,
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 14,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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