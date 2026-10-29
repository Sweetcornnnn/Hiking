import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardTypeOptions,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Shared look for Login and Signup ───────────────────────────────────────
export const AUTH = {
  bg: '#080D14',
  ink: '#0E1520',
  gold: '#C9A96E',
  goldSoft: '#F3DDA8',
  green: '#6FAF8A',
  red: '#E07070',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.12)',
};
// ─── LOGO CONTROLS (edit these) ─────────────────────────────────────────────
// size:         how big the logo is drawn in landscape (px)
// portraitSize: how big it is in portrait (px)
// trim:         0 to 0.4. Cuts empty space ABOVE and BELOW the logo so the text
//               sits closer. Raise it to pull the words up, lower it to push them down.
// gap:          extra space between the logo and the words (px, can be negative)
// textHeight:   room reserved for the words under the logo. Raise it if the
//               words still get cut off; the logo shrinks automatically to fit.
export const LOGO = { size: 320, portraitSize: 150, trim: 0.22, gap: -2, textHeight: 125 };
export const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return reduce;
}

// ─── Toast ──────────────────────────────────────────────────────────────────
export type ToastType = 'error' | 'denied' | 'success';
export interface ToastConfig {
  type: ToastType;
  title: string;
  message: string;
}

export function Toast({ config, onHide }: { config: ToastConfig | null; onHide: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!config) return;
    opacity.setValue(0);
    translateY.setValue(-6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -4, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => onHide());
    }, 3200);
    return () => clearTimeout(timer);
  }, [config]);

  if (!config) return null;

  const accent = config.type === 'error' ? AUTH.gold : config.type === 'denied' ? '#BF6A6A' : AUTH.green;
  const icon =
    config.type === 'error' ? 'alert-circle-outline' : config.type === 'denied' ? 'shield-outline' : 'checkmark-circle-outline';

  return (
    <View pointerEvents="none" style={toast.holder}>
      <Animated.View style={[toast.wrap, { opacity, transform: [{ translateY }] }]}>
        <View style={[toast.bar, { backgroundColor: accent }]} />
        <View style={toast.icon}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <View style={toast.text}>
          <Text style={toast.title}>{config.title}</Text>
          <Text style={toast.message}>{config.message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const toast = StyleSheet.create({
  holder: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  wrap: {
    width: '92%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141E2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  bar: { width: 3, alignSelf: 'stretch' },
  icon: { paddingHorizontal: 10, paddingVertical: 10 },
  text: { flex: 1, paddingVertical: 9, paddingRight: 12 },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 1 },
  message: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 16 },
});

// ─── Backdrop: faint topographic rings ──────────────────────────────────────
function Backdrop({ cx, cy }: { cx: number; cy: number }) {
  const rings = [
    { w: 230, a: 0.14 },
    { w: 350, a: 0.1 },
    { w: 480, a: 0.07 },
    { w: 630, a: 0.05 },
    { w: 800, a: 0.03 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rings.map((r, i) => (
        <View
          key={r.w}
          style={{
            position: 'absolute',
            left: cx - r.w / 2,
            top: cy - (r.w * 0.62) / 2,
            width: r.w,
            height: r.w * 0.62,
            borderRadius: r.w / 2,
            borderWidth: 1,
            borderColor: `rgba(201,169,110,${r.a})`,
            transform: [{ rotate: `${i % 2 === 0 ? -10 : 7}deg` }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Shell: brand on one side, compact form on the other ────────────────────
interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Small extra line under the subtitle. */
  note?: string;
  /** Called when a cell of the 3 x 3 logo grid is tapped. cell is 0 to 8, left to right, top to bottom. */
  onLogoPress?: (cell: number) => void;
  /**
   * The area of the logo box that counts as "the logo", as fractions 0 to 1
   * (x0/x1 = left/right edge, y0/y1 = top/bottom edge). Only this area is
   * tappable, split into 9 real touch cells, so what you see is what you tap.
   * Set show: true to draw the grid so you can line it up with the artwork.
   */
  logoGrid?: { x0: number; x1: number; y0: number; y1: number; show?: boolean };
  toast: ToastConfig | null;
  onHideToast: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  note,
  onLogoPress,
  logoGrid,
  toast: toastConfig,
  onHideToast,
  children,
  footer,
}: AuthShellProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const wide = width > height;

  const enterBrand = useRef(new Animated.Value(0)).current;
  const enterForm = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      enterBrand.setValue(1);
      enterForm.setValue(1);
      glow.setValue(0.5);
      return;
    }
    Animated.stagger(140, [
      Animated.timing(enterBrand, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(enterForm, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce]);

  const brandW = Math.min(300, width * 0.38);
  // Bigger logo: scales with the screen height so it never crowds the text.
  // The logo never grows past the space left over after the words, so the text can't be pushed off screen.
  const room = height - insets.top - insets.bottom - 16 - LOGO.textHeight - LOGO.gap;
  const fitSize = room / (1 - 2 * LOGO.trim);
  const logoSize = wide ? Math.round(Math.max(90, Math.min(LOGO.size, fitSize, brandW))) : LOGO.portraitSize;
  const logoBoxH = Math.round(logoSize * (1 - 2 * LOGO.trim));
  const glowSize = logoSize * 1.6;

  return (
    <KeyboardAvoidingView
      style={shell.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Backdrop cx={wide ? insets.left + 20 + brandW / 2 : width / 2} cy={wide ? height / 2 : height * 0.16} />

      <View
        style={[
          shell.layout,
          wide ? shell.row : shell.column,
          {
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
            paddingTop: insets.top + (wide ? 8 : 20),
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Brand */}
        <Animated.View
          style={[
            shell.brand,
            wide ? { width: brandW } : { paddingBottom: 6 },
            {
              opacity: enterBrand,
              transform: [
                wide
                  ? { translateX: enterBrand.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }
                  : { translateY: enterBrand.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              ],
            },
          ]}
        >
          <View
            style={[shell.logoWrap, { width: logoSize, height: logoBoxH, marginBottom: LOGO.gap }]}
            accessibilityRole="image"
            accessibilityLabel="Saka"
          >
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (logoSize - glowSize) / 2,
                top: (logoBoxH - glowSize) / 2,
                width: glowSize,
                height: glowSize,
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }) }],
              }}
            >
              <Svg width={glowSize} height={glowSize}>
                <Defs>
                  <RadialGradient id="authGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={AUTH.gold} stopOpacity={0.26} />
                    <Stop offset="55%" stopColor={AUTH.gold} stopOpacity={0.07} />
                    <Stop offset="100%" stopColor={AUTH.gold} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#authGlow)" />
              </Svg>
            </Animated.View>
            <Image
              source={require('../../../assets/images/SakaLogo.png')}
              style={{ position: 'absolute', left: 0, top: (logoBoxH - logoSize) / 2, width: logoSize, height: logoSize }}
              resizeMode="contain"
              pointerEvents="none"
            />
            {onLogoPress ? (
              <View
                style={{
                  position: 'absolute',
                  left: (logoGrid?.x0 ?? 0) * logoSize,
                  top: (logoGrid?.y0 ?? 0) * logoBoxH,
                  width: ((logoGrid?.x1 ?? 1) - (logoGrid?.x0 ?? 0)) * logoSize,
                  height: ((logoGrid?.y1 ?? 1) - (logoGrid?.y0 ?? 0)) * logoBoxH,
                  borderWidth: logoGrid?.show ? 1 : 0,
                  borderColor: 'rgba(201,169,110,0.6)',
                }}
              >
                {[0, 1, 2].map((row) => (
                  <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
                    {[0, 1, 2].map((col) => {
                      const cell = row * 3 + col;
                      return (
                        <Pressable
                          key={cell}
                          onPress={() => onLogoPress(cell)}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: logoGrid?.show ? StyleSheet.hairlineWidth : 0,
                            borderColor: 'rgba(201,169,110,0.5)',
                          }}
                        >
                          {logoGrid?.show ? (
                            <Text style={{ color: 'rgba(201,169,110,0.7)', fontSize: 10, fontWeight: '700' }}>{cell}</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Text style={shell.eyebrow}>{eyebrow}</Text>
          <Text style={shell.title} accessibilityRole="header">{title}</Text>
          <Text style={shell.subtitle}>{subtitle}</Text>
          {note ? <Text style={shell.note}>{note}</Text> : null}
        </Animated.View>

        {wide ? <View style={shell.vline} /> : null}

        {/* Form: no scrolling in landscape; portrait keeps a scroll as a safety net */}
        <Animated.View
          style={[
            shell.formWrap,
            {
              opacity: enterForm,
              transform: [{ translateY: enterForm.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          {wide ? (
            <View style={shell.formFixed}>
              <View style={shell.formInner}>
                {children}
                {footer}
              </View>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={shell.formScroll}
            >
              <View style={shell.formInner}>
                {children}
                {footer}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>

      <Toast config={toastConfig} onHide={onHideToast} />
    </KeyboardAvoidingView>
  );
}

const shell = StyleSheet.create({
  root: { flex: 1, backgroundColor: AUTH.bg, overflow: 'hidden' },
  layout: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flexDirection: 'column' },
  brand: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    color: AUTH.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  title: {
    marginTop: 6,
    color: AUTH.text,
    fontFamily: SERIF,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: AUTH.muted,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  note: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11.5,
    textAlign: 'center',
  },
  vline: {
    alignSelf: 'center',
    width: StyleSheet.hairlineWidth,
    height: '58%',
    marginHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  formWrap: { flex: 1 },
  formFixed: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  formInner: { width: '100%', maxWidth: 410 },
});

// ─── Field: compact boxed input with a small icon ───────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  /** Small icon at the left of the input. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Something on the right of the input, like a show/hide eye. */
  right?: ReactNode;
  /** Small status text on the right of the label. */
  trailing?: { text: string; color: string };
  /** Tints the border. */
  tone?: 'ok' | 'bad';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  icon,
  right,
  trailing,
  tone,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const border =
    tone === 'ok'
      ? 'rgba(111,175,138,0.5)'
      : tone === 'bad'
      ? 'rgba(224,112,112,0.5)'
      : focused
      ? AUTH.gold
      : 'rgba(255,255,255,0.08)';

  return (
    <View style={field.wrap}>
      <View style={field.labelRow}>
        <Text style={[field.label, focused && { color: AUTH.gold }]}>{label}</Text>
        {trailing ? (
          <Text numberOfLines={1} style={[field.trailing, { color: trailing.color }]}>{trailing.text}</Text>
        ) : null}
      </View>
      <View style={[field.inputRow, { borderColor: border }]}>
        {icon ? <Ionicons name={icon} size={13} color="rgba(255,255,255,0.28)" style={field.icon} /> : null}
        <TextInput
          style={field.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.2)"
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          selectionColor={AUTH.gold}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
        />
        {right}
      </View>
    </View>
  );
}

const field = StyleSheet.create({
  wrap: { marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  label: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  trailing: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, flexShrink: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  icon: { marginRight: 7 },
  input: { flex: 1, minWidth: 0, color: AUTH.text, fontSize: 12.5, paddingVertical: 0, paddingHorizontal: 0 },
});

/** The eye button that sits on the right of a password Field. */
export function EyeToggle({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{ paddingLeft: 6, paddingVertical: 4 }}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
    >
      <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
}

/** Two fields side by side in landscape, stacked in portrait. */
export function FieldRow({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 12 : 0 }}>
      {React.Children.map(children, (child) => (
        <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{child}</View>
      ))}
    </View>
  );
}

// ─── Button + footer ────────────────────────────────────────────────────────
export function PrimaryButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loadingLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel : label}
      style={({ pressed }) => [btn.base, off && btn.off, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
    >
      <Text style={btn.text}>{loading ? loadingLabel : label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={AUTH.ink} style={{ marginLeft: 8 }} />
      ) : (
        <Ionicons name="arrow-forward" size={13} color={AUTH.ink} style={{ marginLeft: 8 }} />
      )}
    </Pressable>
  );
}

const btn = StyleSheet.create({
  base: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: AUTH.gold,
  },
  off: { opacity: 0.42 },
  text: { color: AUTH.ink, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
});

export function FooterLink({ muted, link, onPress }: { muted: string; link: string; onPress: () => void }) {
  return (
    <View style={foot.row}>
      <Text style={foot.muted}>{muted}</Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Text style={foot.link}>{link}</Text>
      </Pressable>
    </View>
  );
}

const foot = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  muted: { color: 'rgba(255,255,255,0.35)', fontSize: 11.5 },
  link: { color: AUTH.gold, fontSize: 11.5, fontWeight: '700' },
});