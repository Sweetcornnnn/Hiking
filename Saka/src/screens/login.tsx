import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, isLoading } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter both email and password'); return; }
    const { error } = await signIn(email, password);
    if (error) {
      Alert.alert('Error', error);
    } else {
      const authState = useAuthStore.getState();
      if (authState.user?.is_admin) router.replace('/drawer/admin/[...admin]');
      else router.replace('/drawer/home');
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Left panel ── */}
        <View style={styles.leftPanel}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>🏔️</Text>
          </View>
          <Text style={styles.brandName}>TaraSaka</Text>
          <Text style={styles.brandTagline}>Every summit begins{'\n'}with a single step.</Text>

          <View style={styles.dividerH} />

          {[
            { label: '10 peaks to conquer', gold: false },
            { label: 'Track every ascent', gold: true },
            { label: 'Built for Filipino hikers', gold: false },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureDot, item.gold && styles.featureDotGold]} />
              <Text style={styles.featureText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Vertical divider ── */}
        <View style={styles.dividerV} />

        {/* ── Right panel ── */}
        <View style={styles.rightPanel}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>Sign in to continue your journey</Text>

          {/* Email */}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Password */}
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/forgot')} style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.82}
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
    flexDirection: 'row',
    width: '80%',
    maxWidth: 560,
    height: 290,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // Left panel
  leftPanel: {
    width: 168,
    backgroundColor: '#111927',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'flex-start',
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoEmoji: { fontSize: 17 },
  brandName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 14,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  featureDotGold: { backgroundColor: '#C9A96E' },
  featureText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 10,
  },

  // Divider
  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Right panel
  rightPanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    justifyContent: 'center',
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  formSubtitle: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    marginBottom: 16,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 10,
  },
  inputIcon: { marginRight: 7 },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
  },
  eyeBtn: { padding: 4, marginLeft: 2 },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    marginTop: -2,
  },
  forgotText: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '500',
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    height: 36,
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: {
    color: '#0E1520',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  footerMuted: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
  footerLink: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '600',
  },
});