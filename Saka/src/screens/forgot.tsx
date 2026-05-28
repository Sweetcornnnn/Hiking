import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { resolveApiBaseUrl } from '../config/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { authToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Success toast ─────────────────────────────────────────────────────────
  const [successVisible, setSuccessVisible] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successY = useRef(new Animated.Value(10)).current;

  const showSuccessToast = () => {
    setSuccessVisible(true);
    successOpacity.setValue(0);
    successY.setValue(10);
    Animated.parallel([
      Animated.timing(successOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(successY,       { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(successY,       { toValue: 10, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setSuccessVisible(false);
        router.replace('/login');
      });
    }, 2600);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: 'transparent', width: '0%' };
    if (pwd.length < 8)   return { label: 'Weak', color: '#E07070', width: '33%' };
    if (pwd.length < 12)  return { label: 'Fair', color: '#C9A96E', width: '66%' };
    return { label: 'Strong', color: '#6FAF8A', width: '100%' };
  };

  const checkReqs = (pwd: string) => ({
    hasNumber:    /\d/.test(pwd),
    hasUpperCase: /[A-Z]/.test(pwd),
    hasLowerCase: /[a-z]/.test(pwd),
    hasSymbol:    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    isLongEnough: pwd.length >= 6,
  });

  const strength = getPasswordStrength(newPassword);
  const reqs = checkReqs(newPassword);
  const allReqsMet = Object.values(reqs).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const canSubmit = email.trim().length > 0 && allReqsMet && passwordsMatch && !isLoading;

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email address'); return; }
    if (!newPassword) { Alert.alert('Error', 'Please enter your new password'); return; }
    if (!confirmPassword) { Alert.alert('Error', 'Please confirm your password'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (!allReqsMet) { Alert.alert('Error', 'Password does not meet all requirements'); return; }

    setIsLoading(true);
    try {
      const body = { email: email.trim().toLowerCase(), newPassword };
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const base = await resolveApiBaseUrl();

      const response = await fetch(`${base}/api/password-change-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) { setIsLoading(false); Alert.alert('Error', data.error || 'Failed to request password change'); return; }
      setIsLoading(false);
      showSuccessToast();
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Network error');
    }
  };

  const REQ_ITEMS = [
    { key: 'hasNumber',    label: 'One number' },
    { key: 'hasUpperCase', label: 'One uppercase' },
    { key: 'hasLowerCase', label: 'One lowercase' },
    { key: 'hasSymbol',    label: 'One symbol' },
    { key: 'isLongEnough', label: '6+ characters' },
  ] as const;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Left panel ── */}
        <View style={styles.leftPanel}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>🔐</Text>
          </View>
          <Text style={styles.brandName}>Change{'\n'}Password</Text>
          <Text style={styles.brandTagline}>Admin approval{'\n'}required.</Text>

          <View style={styles.dividerH} />

          {/* Admin approval notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#C9A96E" />
            <Text style={styles.noticeText}>Your request will be reviewed before taking effect.</Text>
          </View>

          <View style={styles.dividerH} />

          <Text style={styles.sectionLabel}>PASSWORD RULES</Text>
          {REQ_ITEMS.map((item) => {
            const met = reqs[item.key];
            return (
              <View key={item.key} style={styles.reqRow}>
                <Ionicons
                  name={met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={11}
                  color={met ? '#6FAF8A' : 'rgba(255,255,255,0.18)'}
                />
                <Text style={[styles.reqText, met && styles.reqTextMet]}>{item.label}</Text>
              </View>
            );
          })}

          {newPassword.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}
        </View>

        {/* ── Vertical divider ── */}
        <View style={styles.dividerV} />

        {/* ── Right panel ── */}
        <View style={styles.rightPanel}>
          <Text style={styles.formTitle}>Set new password</Text>
          <Text style={styles.formSubtitle}>Choose a strong password to secure your account</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>

            {/* Email */}
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

            {/* New Password */}
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputRow, confirmPassword.length > 0 && { borderColor: passwordsMatch ? 'rgba(111,175,138,0.35)' : 'rgba(224,112,112,0.35)' }]}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && (
              <Text style={[styles.matchText, { color: passwordsMatch ? '#6FAF8A' : '#E07070' }]}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleReset}
              disabled={!canSubmit}
              activeOpacity={0.82}
            >
              {isLoading
                ? <Text style={styles.submitText}>Sending request…</Text>
                : <><Text style={styles.submitText}>Request Password Change</Text>
                    <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} /></>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backRow}>
              <Ionicons name="arrow-back" size={12} color="rgba(255,255,255,0.25)" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>

      </Animated.View>

      {/* ── Success toast ── */}
      {successVisible && (
        <Animated.View style={[styles.successToast, { opacity: successOpacity, transform: [{ translateY: successY }] }]}>
          <View style={styles.successToastBar} />
          <View style={styles.successToastIconWrap}>
            <Ionicons name="checkmark-circle" size={22} color="#6FAF8A" />
          </View>
          <View style={styles.successToastContent}>
            <Text style={styles.successToastTitle}>Request Sent</Text>
            <Text style={styles.successToastMsg}>
              Your password change has been submitted for admin approval. Redirecting to login…
            </Text>
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