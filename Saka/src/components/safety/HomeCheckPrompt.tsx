import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHikeSafetyStore } from '../../store/hikeSafetyStore';

const GOLD = '#C9A96E';
const GOLD_SOFT = '#F3DDA8';
const INK = '#0E1520';
const DANGER_TEXT = '#EE9A9A';

type Answer = 'got_home' | 'not_home_yet';

function formatDate(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFinish(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'Not available', time: 'Not available' };
  return {
    date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

/**
 * "Are you home?" safety check.
 *
 * Hierarchy, most to least important:
 *  1. The question and its two real answers (Got home / Not home yet)
 *  2. When you planned to be back, the fact that prompted the check
 *  3. Which activity and mountain it is about
 *  4. "Remind me later", a quiet text link rather than a button
 */
export default function HomeCheckPrompt() {
  const { prompt, busy, respondToPrompt, dismissPrompt } = useHikeSafetyStore();
  const { width, height } = useWindowDimensions();
  const wide = width > height;

  const [reduceMotion, setReduceMotion] = useState(false);
  const [pending, setPending] = useState<Answer | null>(null);
  const enter = useRef(new Animated.Value(0)).current;
  const open = !!prompt;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    enter.setValue(0);
    if (reduceMotion) {
      Animated.timing(enter, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else {
      Animated.spring(enter, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }).start();
    }
  }, [open, reduceMotion, enter]);

  useEffect(() => {
    if (!busy) setPending(null);
  }, [busy]);

  if (!prompt) return null;

  const answer = (value: Answer) => {
    setPending(value);
    void respondToPrompt(value);
  };

  const finish = formatFinish(prompt.plannedFinishAt);
  const activityDate = formatDate(prompt.activityDate, finish.date);
  const isHike = prompt.kind === 'hike';
  const activityTitle = isHike ? 'Your hike' : prompt.title;
  const mountain = prompt.mountain ?? 'Mountain or area not specified';

  const ringSizes = wide ? [84, 124, 166] : [88, 132, 180, 236];

  const header = (
    <View style={[styles.header, wide && styles.headerWide]}>
      <View style={styles.medallionBox}>
        {ringSizes.map((w, i) => (
          <View
            key={w}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 32 - w / 2,
              top: 32 - (w * 0.6) / 2,
              width: w,
              height: w * 0.6,
              borderRadius: w / 2,
              borderWidth: 1,
              borderColor: `rgba(201,169,110,${0.16 - i * 0.03})`,
              transform: [{ rotate: `${i % 2 === 0 ? -8 : 6}deg` }],
            }}
          />
        ))}
        <View style={styles.medallionRing}>
          <View style={styles.medallion}>
            <Ionicons name="home-outline" size={24} color={GOLD} />
          </View>
        </View>
      </View>

      <Text style={styles.eyebrow}>SAFETY CHECK · {isHike ? 'HIKE' : 'EVENT'}</Text>
      <Text style={[styles.title, wide && styles.textLeft]} accessibilityRole="header">
        Are you home?
      </Text>
      <Text style={[styles.body, wide && styles.textLeft]}>
        Let us know you’re safe after {activityTitle.toLowerCase()}.
      </Text>
    </View>
  );

  const details = (
    <View style={styles.panel}>
      <View style={styles.contextRow}>
        <View style={styles.contextIcon}>
          <Ionicons name={isHike ? 'walk-outline' : 'flag-outline'} size={16} color={GOLD} />
        </View>
        <View style={styles.contextText}>
          <Text style={styles.contextTitle} numberOfLines={1}>{activityTitle}</Text>
          <View style={styles.mountainRow}>
            <Ionicons name="trail-sign-outline" size={12} color="rgba(255,255,255,0.45)" />
            <Text style={styles.mountain} numberOfLines={1}>{mountain}</Text>
          </View>
        </View>
      </View>

      <View style={styles.hairline} />

      <View style={styles.factsRow}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>{isHike ? 'HIKE DATE' : 'EVENT DATE'}</Text>
          <Text style={styles.factValue} numberOfLines={2}>{activityDate}</Text>
        </View>
        <View style={styles.factDivider} />
        <View style={styles.fact}>
          <Text style={styles.factLabel}>PLANNED RETURN</Text>
          <Text style={styles.factTime}>{finish.time}</Text>
          <Text style={styles.factSub} numberOfLines={1}>{finish.date}</Text>
        </View>
      </View>
    </View>
  );

  const actions = (
    <>
      <Text style={styles.helper}>
        Still on the trail? Choose “Not home yet.” You can update your status later.
      </Text>

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnNotHome,
            busy && pending !== 'not_home_yet' && styles.btnDim,
            pressed && styles.btnPressed,
          ]}
          onPress={() => answer('not_home_yet')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not home yet"
        >
          {busy && pending === 'not_home_yet' ? (
            <ActivityIndicator size="small" color={DANGER_TEXT} />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={18} color={DANGER_TEXT} />
              <Text style={styles.btnNotHomeText}>Not home yet</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnGotHome,
            busy && pending !== 'got_home' && styles.btnDim,
            pressed && styles.btnPressed,
          ]}
          onPress={() => answer('got_home')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Got home"
        >
          {busy && pending === 'got_home' ? (
            <ActivityIndicator size="small" color={INK} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={INK} />
              <Text style={styles.btnGotHomeText}>Got home</Text>
            </>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={dismissPrompt}
        disabled={busy}
        hitSlop={8}
        style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Remind me later"
      >
        <Text style={styles.laterText}>Remind me later</Text>
      </Pressable>
    </>
  );

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={dismissPrompt}
    >
      <View style={styles.overlay}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: enter }]} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              width: Math.min(width - 36, wide ? 660 : 420),
              opacity: enter.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 22, 0] }) },
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.95, 1] }) },
              ],
            },
          ]}
        >
          {wide ? (
            <View style={styles.wideRow}>
              <View style={styles.wideLeft}>{header}</View>
              <View style={styles.wideRight}>
                {details}
                {actions}
              </View>
            </View>
          ) : (
            <>
              {header}
              {details}
              {actions}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,13,0.72)',
  },
  card: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 18,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: INK,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },

  // Landscape: header on the left, answer on the right
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  wideLeft: { flex: 0.85 },
  wideRight: { flex: 1.15 },

  // Header
  header: { alignItems: 'center' },
  headerWide: { alignItems: 'flex-start' },
  medallionBox: { width: 64, height: 64, marginBottom: 18 },
  medallionRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallion: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(201,169,110,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(201,169,110,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 8,
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  textLeft: { textAlign: 'left' },

  // Details panel
  panel: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  contextIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.22)',
  },
  contextText: { flex: 1 },
  contextTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mountainRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  mountain: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  factsRow: { flexDirection: 'row', alignItems: 'stretch', padding: 14 },
  fact: { flex: 1 },
  factDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 14,
  },
  factLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  factValue: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '600', lineHeight: 20 },
  factTime: { color: GOLD_SOFT, fontSize: 20, fontWeight: '800', lineHeight: 24 },
  factSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, marginTop: 1 },

  // Answer
  helper: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 15,
    paddingHorizontal: 8,
  },
  btnNotHome: {
    flex: 1,
    backgroundColor: 'rgba(224,112,112,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.45)',
  },
  btnNotHomeText: { color: DANGER_TEXT, fontSize: 15, fontWeight: '700' },
  btnGotHome: {
    flex: 1.2,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  btnGotHomeText: { color: INK, fontSize: 15, fontWeight: '800' },
  btnDim: { opacity: 0.4 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12, marginTop: 2 },
  laterText: { color: 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: '600' },
});