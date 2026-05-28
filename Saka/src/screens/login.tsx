import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Easing, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import * as ScreenOrientation from 'expo-screen-orientation';

// ─── Toast types ────────────────────────────────────────────────────────────
type ToastType = 'error' | 'denied' | 'success';
interface ToastConfig {
  type: ToastType;
  title: string;
  message: string;
}

// ─── In-theme Toast component ────────────────────────────────────────────────
function Toast({ config, onHide }: { config: ToastConfig | null; onHide: () => void }) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!config) return;
    // reset
    opacity.setValue(0);
    translateY.setValue(-6);

    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -4, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => onHide());
    }, 3200);

    return () => clearTimeout(timer);
  }, [config]);

  if (!config) return null;

  const accentColor =
    config.type === 'error'   ? '#C9A96E' :  // gold  — field error
    config.type === 'denied'  ? '#BF6A6A' :  // muted red — access denied
    /* success */               '#6AAE8F';    // muted green

  const iconName =
    config.type === 'error'   ? 'alert-circle-outline' :
    config.type === 'denied'  ? 'shield-outline' :
    /* success */               'checkmark-circle-outline';

  return (
    <Animated.View style={[toastStyles.wrap, { opacity, transform: [{ translateY }] }]}>
      <View style={[toastStyles.bar, { backgroundColor: accentColor }]} />
      <View style={toastStyles.iconWrap}>
        <Ionicons name={iconName as any} size={18} color={accentColor} />
      </View>
      <View style={toastStyles.textWrap}>
        <Text style={toastStyles.title}>{config.title}</Text>
        <Text style={toastStyles.message}>{config.message}</Text>
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141E2D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    zIndex: 20,
  },
  bar: {
    width: 3,
    alignSelf: 'stretch',
  },
  iconWrap: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  textWrap: {
    flex: 1,
    paddingVertical: 9,
    paddingRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  message: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 15,
  },
});

// ─── Main screen ────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoPressCount, setLogoPressCount] = useState(0);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const { signIn, isLoading } = useAuthStore();

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(20)).current;
  const flipProgress = useRef(new Animated.Value(0)).current;

  // Lock landscape — no cleanup, so the transition to home never briefly unlocks
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const frontOpacity = flipProgress.interpolate({ inputRange: [0, 0.4, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipProgress.interpolate({ inputRange: [0, 0.4, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const cardScale    = flipProgress.interpolate({ inputRange: [0, 0.5, 1],       outputRange: [1, 0.96, 1] });

  const showToast = useCallback((config: ToastConfig) => setToast(config), []);

  const toggleAdminMode = (nextState: boolean) => {
    setIsAdminLogin(nextState);
    setLogoPressCount(0);
    setEmail('');
    setPassword('');
    setToast(null);
    Animated.timing(flipProgress, {
      toValue: nextState ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleLogoPress = () => {
    const next = logoPressCount + 1;
    if (next >= 7) toggleAdminMode(!isAdminLogin);
    else setLogoPressCount(next);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast({ type: 'error', title: 'Missing fields', message: 'Please enter both email and password.' });
      return;
    }
    const { error } = await signIn(email, password);
    if (error) {
      showToast({ type: 'error', title: 'Sign in failed', message: error });
      return;
    }
    const authState = useAuthStore.getState();

    if (isAdminLogin) {
      if (!authState.user?.is_admin) {
        showToast({ type: 'denied', title: 'Access denied', message: 'This account does not have admin privileges.' });
        return;
      }
      router.replace('/loading');
    } else {
      if (authState.user?.is_admin) {
        showToast({ type: 'denied', title: 'Access denied', message: 'Admin accounts must use the admin login.' });
        return;
      }
      router.replace('/loading');
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: cardScale }] }]}
      >
        {/* ── Toast ── */}
        <Toast config={toast} onHide={() => setToast(null)} />

        {/* ── USER FACE ── */}
        <Animated.View style={[styles.face, { opacity: frontOpacity }]} pointerEvents={isAdminLogin ? 'none' : 'auto'}>
          <View style={styles.leftPanel}>
            <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.75} style={styles.logoMark}>
              <Image
                source={require('../../assets/images/SakaLogo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.brandTagline}>Every summit begins{'\n'}with a single step.</Text>
            <View style={styles.dividerH} />
            {[
              { label: '10 peaks to conquer',    gold: false },
              { label: 'Track every ascent',      gold: true  },
              { label: 'Built for Filipino hikers', gold: false },
            ].map((item, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureDot, item.gold && styles.featureDotGold]} />
                <Text style={styles.featureText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.dividerV} />

          <View style={styles.rightPanel}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue your journey</Text>

            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" editable={!isLoading}
              />
            </View>

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push('/forgot')} style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleLogin} disabled={isLoading} activeOpacity={0.82}
            >
              <Text style={styles.submitText}>{isLoading ? 'Signing in…' : 'Sign In'}</Text>
              {!isLoading && <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} />}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>No account yet?</Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.footerLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── ADMIN FACE ── */}
        <Animated.View style={[styles.face, { opacity: backOpacity }]} pointerEvents={isAdminLogin ? 'auto' : 'none'}>
          <View style={styles.leftPanel}>
            <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.75} style={styles.logoMark}>
              <Image
                source={require('../../assets/images/SakaLogo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.brandName}>Admin Access</Text>
            <Text style={styles.brandTagline}>Hidden sign in for{'\n'}administrators only.</Text>
            <View style={styles.dividerH} />
            <Text style={styles.adminHint}>Admin ka Gale?</Text>
          </View>

          <View style={styles.dividerV} />

          <View style={styles.rightPanel}>
            <Text style={styles.formTitle}>Admin Login</Text>
            <Text style={styles.formSubtitle}>Use admin credentials to continue.</Text>

            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="admin@example.com"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" editable={!isLoading}
              />
            </View>

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleLogin} disabled={isLoading} activeOpacity={0.82}
            >
              <Text style={styles.submitText}>{isLoading ? 'Signing in…' : 'Admin Sign In'}</Text>
              {!isLoading && <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          </View>
        </Animated.View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '80%',
    maxWidth: 560,
    height: 290,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  face: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#0E1520',
    borderRadius: 16,
    overflow: 'hidden',
  },

  leftPanel: {
    width: 168,
    backgroundColor: '#111927',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
  },
  logoMark: {
    marginBottom: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: { width: 102, height: 102 },
  logoEmoji:   { fontSize: 24 },
  brandName:   { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2, marginBottom: 6, textAlign: 'center' },
  brandTagline:{ color: 'rgba(255,255,255,0.28)', fontSize: 10, lineHeight: 16, marginBottom: 14, textAlign: 'center' },
  dividerH:    { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', alignSelf: 'stretch', marginBottom: 12 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  featureDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  featureDotGold: { backgroundColor: '#C9A96E' },
  featureText: { color: 'rgba(255,255,255,0.32)', fontSize: 10 },
  adminHint:   { color: 'rgba(255,255,255,0.3)', fontSize: 10, lineHeight: 14, marginTop: 10, textAlign: 'center' },
  dividerV:    { width: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  rightPanel: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, justifyContent: 'center' },
  formTitle:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  formSubtitle:{ color: 'rgba(255,255,255,0.28)', fontSize: 10, marginBottom: 16 },
  fieldLabel:  { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, height: 36, marginBottom: 10,
  },
  inputIcon: { marginRight: 7 },
  input:     { flex: 1, color: '#FFFFFF', fontSize: 12 },
  eyeBtn:    { padding: 4, marginLeft: 2 },
  forgotWrap:{ alignSelf: 'flex-end', marginBottom: 12, marginTop: -2 },
  forgotText:{ color: '#C9A96E', fontSize: 10, fontWeight: '500' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C9A96E', borderRadius: 8, height: 36, marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText:  { color: '#0E1520', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  footerRow:   { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  footerMuted: { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
  footerLink:  { color: '#C9A96E', fontSize: 11, fontWeight: '600' },
});