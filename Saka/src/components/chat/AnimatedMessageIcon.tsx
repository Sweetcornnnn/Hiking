// components/chat/AnimatedMessageIcon.tsx
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  CHAT_BG,
  CHAT_BORDER,
  CHAT_RADIUS_BTN,
} from '../../theme/designTokens';

export type ChatNotificationPayload = {
  type: 'private' | 'group';
  id: string;
  senderName: string;
  content: string;
};

export type AnimatedMessageIconHandle = {
  notify: (payload: ChatNotificationPayload) => void;
};

const PREVIEW_MAX_CHARS = 42;
const EXPAND_MS = 260;
const HOLD_MS = 1500;
const COLLAPSE_MS = 220;
const PILL_MIN_WIDTH = 40;
const PILL_MAX_WIDTH = 240;

function buildPreview(p: ChatNotificationPayload): string {
  const safeName =
    p.senderName.length > 16
      ? `${p.senderName.slice(0, 15).trimEnd()}…`
      : p.senderName;
  const body = p.content.replace(/\s+/g, ' ').trim();
  const full = `${safeName}: ${body}`;
  if (full.length <= PREVIEW_MAX_CHARS) return full;
  return `${full.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`;
}

type Props = {
  onPress?: () => void;
  onPressNotification?: (payload: ChatNotificationPayload) => void;
  unreadCount?: number;
};

export const AnimatedMessageIcon = forwardRef<
  AnimatedMessageIconHandle,
  Props
>(function AnimatedMessageIcon(
  { onPress, onPressNotification, unreadCount = 0 },
  ref
) {
  const [preview, setPreview] = useState<ChatNotificationPayload | null>(null);
  const [pillWidth, setPillWidth] = useState(PILL_MIN_WIDTH);

  const anim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const queue = useRef<ChatNotificationPayload[]>([]);
  const showing = useRef(false);
  const reduceMotionRef = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) reduceMotionRef.current = enabled;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled: boolean) => {
        reduceMotionRef.current = enabled;
      }
    );
    return () => {
      mounted = false;
      sub?.remove?.();
      clearTimers();
    };
  }, []);

  const showNextFromQueue = useCallback(() => {
    const next = queue.current.shift();
    if (next) {
      runNotify(next);
    } else {
      showing.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collapse = useCallback(() => {
    if (reduceMotionRef.current) {
      anim.setValue(0);
      textOpacity.setValue(0);
      setPreview(null);
      showNextFromQueue();
      return;
    }

    Animated.parallel([
      Animated.timing(anim, {
        toValue: 0,
        duration: COLLAPSE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: COLLAPSE_MS / 2,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPreview(null);
        showNextFromQueue();
      }
    });
  }, [anim, textOpacity, showNextFromQueue]);

  const runNotify = useCallback(
    (payload: ChatNotificationPayload) => {
      clearTimers();
      setPreview(payload);
      anim.setValue(0);
      textOpacity.setValue(0);

      if (reduceMotionRef.current) {
        anim.setValue(1);
        textOpacity.setValue(1);
        timers.current.push(setTimeout(collapse, HOLD_MS));
        return;
      }

      Animated.timing(anim, {
        toValue: 1,
        duration: EXPAND_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      timers.current.push(
        setTimeout(() => {
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }, 90)
      );

      timers.current.push(setTimeout(collapse, EXPAND_MS + HOLD_MS));
    },
    [anim, textOpacity, collapse]
  );

  const notify = useCallback(
    (payload: ChatNotificationPayload) => {
      if (showing.current) {
        queue.current.push(payload);
        return;
      }
      showing.current = true;
      runNotify(payload);
    },
    [runNotify]
  );

  useImperativeHandle(ref, () => ({ notify }), [notify]);

  const handlePress = () => {
    if (preview && onPressNotification) {
      const p = preview;
      clearTimers();
      queue.current = [];
      showing.current = false;
      collapse();
      onPressNotification(p);
      return;
    }
    onPress?.();
  };

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PILL_MIN_WIDTH, Math.max(pillWidth, 120)],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.hitbox}
    >
      <Animated.View style={[styles.pill, { width }]}>
        <View style={styles.iconSlot}>
          <Ionicons
            name="chatbubble-ellipses"
            size={20}
            color="#C9A96E"
          />
          {unreadCount > 0 && !preview && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {preview && (
          <Animated.View
            style={[styles.textSlot, { opacity: textOpacity }]}
            pointerEvents="none"
          >
            <Text
              style={styles.previewText}
              numberOfLines={1}
              ellipsizeMode="tail"
              onLayout={(e) => {
                const measured = Math.ceil(e.nativeEvent.layout.width) + 40 + 20;
                const clamped = Math.min(
                  Math.max(measured, 120),
                  PILL_MAX_WIDTH
                );
                setPillWidth((prev) => (clamped > prev ? clamped : prev));
              }}
            >
              {buildPreview(preview)}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  hitbox: {
    paddingVertical: 6,
    paddingLeft: 6,
    alignItems: 'flex-end',
  },
  pill: {
    height: 36,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: 'rgba(38, 46, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.28)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  iconSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: CHAT_BG,
    fontSize: 8,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  textSlot: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
});