import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string }>();
  const { resetPassword } = useAuthStore();
  const [mode, setMode] = useState<'request' | 'reset'>(
    params.reset === '1' ? 'reset' : 'request',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [successVisible, setSuccessVisible] = useState(false);
  const [toastTitle, setToastTitle] = useState('Reset link sent');
  const [toastMessage, setToastMessage] = useState('Check your email and follow the secure link to continue.');
  const [successOpacity] = useState(() => new Animated.Value(0));
  const [successY] = useState(() => new Animated.Value(10));

  const showSuccessToast = (title: string, message: string) => {
    setToastTitle(title);
    setToastMessage(message);
    setSuccessVisible(true);
    successOpacity.setValue(0);
    successY.setValue(10);
    Animated.parallel([
      Animated.timing(successOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(successY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(successY, { toValue: 10, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setSuccessVisible(false);
        router.replace('/Login');
      });
    }, 2600);
  };

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(20));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (mode !== 'reset') return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error || !session) {
        setMode('request');
        Alert.alert(
          'Link expired',
          'Your reset link is invalid or has expired. Please request a new one.',
        );
      }
    }).catch(() => {
      if (cancelled) return;
      setMode('request');
      Alert.alert(
        'Link expired',
        'Your reset link is invalid or has expired. Please request a new one.',
      );
    });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(email.trim().toLowerCase());
      if (!result.success) {
        throw new Error(result.error || 'Unable to send reset link');
      }

      setIsLoading(false);
      showSuccessToast(
        'Reset link sent',
        'Check your email and follow the secure link to continue.',
      );
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert(
        'Reset link not sent',
        `${error.message || 'Unable to send reset link'}\n\nCheck your email address, make sure your Supabase Email provider is enabled, and confirm the redirect URL includes saka://auth/callback.`
      );
    }
  };

  const handleUpdatePassword = async () => {
    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }

      await supabase.auth.signOut();
      showSuccessToast(
        'Password updated',
        'You can now sign in with your new password.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update password.';
      Alert.alert('Update failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.leftPanel}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>{mode === 'reset' ? '🔑' : '🔐'}</Text>
          </View>
          <Text style={styles.brandName}>
            {mode === 'reset' ? 'New\nPassword' : 'Reset\nPassword'}
          </Text>
          <Text style={styles.brandTagline}>
            {mode === 'reset'
              ? 'Choose a strong password to secure your account.'
              : 'We’ll send a secure recovery link to your email.'}
          </Text>

          <View style={styles.dividerH} />

          <View style={styles.noticeBox}>
            <Ionicons
              name={mode === 'reset' ? 'lock-closed-outline' : 'mail-outline'}
              size={13}
              color="#C9A96E"
            />
            <Text style={styles.noticeText}>
              {mode === 'reset'
                ? 'Pick at least 6 characters. Avoid reusing old passwords.'
                : 'Use the link in your inbox to continue the password reset.'}
            </Text>
          </View>
        </View>

        <View style={styles.dividerV} />

        <View style={styles.rightPanel}>
          <Text style={styles.formTitle}>
            {mode === 'reset' ? 'Set a new password' : 'Forgot password'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'reset'
              ? 'Enter and confirm your new password'
              : 'Enter the email tied to your account'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {mode === 'request' ? (
              <>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, (!email.trim() || isLoading) && styles.submitBtnDisabled]}
                  onPress={handleRequestReset}
                  disabled={!email.trim() || isLoading}
                  activeOpacity={0.82}
                >
                  {isLoading ? (
                    <Text style={styles.submitText}>Sending link…</Text>
                  ) : (
                    <>
                      <Text style={styles.submitText}>Send Reset Link</Text>
                      <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="At least 6 characters"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((visible) => !visible)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={14}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, (!password || !confirmPassword || isLoading) && styles.submitBtnDisabled]}
                  onPress={handleUpdatePassword}
                  disabled={!password || !confirmPassword || isLoading}
                  activeOpacity={0.82}
                >
                  <Text style={styles.submitText}>
                    {isLoading ? 'Updating…' : 'Update Password'}
                  </Text>
                  {!isLoading && (
                    <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => router.replace('/Login')} style={styles.backRow}>
              <Ionicons name="arrow-back" size={12} color="rgba(255,255,255,0.25)" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>

      {successVisible && (
        <Animated.View style={[styles.successToast, { opacity: successOpacity, transform: [{ translateY: successY }] }]}>
          <View style={styles.successToastBar} />
          <View style={styles.successToastIconWrap}>
            <Ionicons name="checkmark-circle" size={22} color="#6FAF8A" />
          </View>
          <View style={styles.successToastContent}>
            <Text style={styles.successToastTitle}>{toastTitle}</Text>
            <Text style={styles.successToastMsg}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
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
    width: '82%',
    maxWidth: 580,
    height: 360,
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
    lineHeight: 19,
    marginBottom: 4,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 12,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: 'rgba(201,169,110,0.07)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.18)',
    marginBottom: 10,
  },
  noticeText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 9,
    lineHeight: 13,
    flex: 1,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 9,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reqText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 10,
  },
  reqTextMet: { color: '#6FAF8A' },
  strengthWrap: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  strengthTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Right panel
  rightPanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
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
  formScroll: {
    paddingBottom: 4,
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
  matchText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    height: 36,
    marginTop: 6,
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: {
    color: '#0E1520',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  backText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },

  // ── Success toast ─────────────────────────────────────────────────────────
  successToast: {
    position: 'absolute',
    bottom: 32,
    left: '50%',
    marginLeft: -152,
    width: 304,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111927',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,175,138,0.25)',
    overflow: 'hidden',
    zIndex: 200,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successToastBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#6FAF8A',
  },
  successToastIconWrap: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  successToastContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
  },
  successToastTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  successToastMsg: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    lineHeight: 14,
  },
});