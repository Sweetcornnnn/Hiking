import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, ScrollView, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { signUp, isLoading } = useAuthStore();

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

  const strength = getPasswordStrength(password);
  const reqs = checkReqs(password);
  const allReqsMet = Object.values(reqs).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canSubmit = allReqsMet && passwordsMatch && phone.trim().length > 0 && !isLoading;

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword || !name || !phone.trim()) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (!allReqsMet) { Alert.alert('Error', 'Password does not meet all requirements'); return; }
    const { error } = await signUp(email, password, name, phone.trim());
    if (error) Alert.alert('Error', error);
    else setShowSuccessModal(true);
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
          <TouchableOpacity activeOpacity={0.75} style={styles.logoMark}>
            <Image
              source={require('../../assets/images/SakaLogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.brandTagline}>Join thousands of{'\n'}Filipino hikers.</Text>

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

          {/* Strength bar */}
          {password.length > 0 && (
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
          <Text style={styles.formTitle}>Create account</Text>
          <Text style={styles.formSubtitle}>Start tracking your summits</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {/* Name */}
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Juan dela Cruz" placeholderTextColor="rgba(255,255,255,0.18)"
                value={name} onChangeText={setName} editable={!isLoading} />
            </View>

            {/* Email */}
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.18)"
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />
            </View>

            {/* Phone Number */}
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="09xx xxx xxxx" placeholderTextColor="rgba(255,255,255,0.18)"
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" editable={!isLoading} />
            </View>

            {/* Password */}
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.18)"
                value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputRow, confirmPassword.length > 0 && { borderColor: passwordsMatch ? 'rgba(111,175,138,0.35)' : 'rgba(224,112,112,0.35)' }]}>
              <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.18)"
                value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} editable={!isLoading} />
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
              onPress={handleSignup}
              disabled={!canSubmit}
              activeOpacity={0.82}
            >
              {isLoading
                ? <Text style={styles.submitText}>Creating account…</Text>
                : <><Text style={styles.submitText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={13} color="#0E1520" style={{ marginLeft: 6 }} /></>
              }
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/Login')}>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

      </Animated.View>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={32} color="#6FAF8A" />
            </View>
            <Text style={styles.successModalTitle}>Account created</Text>
            <Text style={styles.successModalMessage}>Your account has been created successfully. Please sign in to continue.</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/Login');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successModalButtonText}>Go to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
  },
  logoMark: {
    marginBottom: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 102,
    height: 102,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 14,
    textAlign: 'center',
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 12,
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
  reqTextMet: {
    color: '#6FAF8A',
  },
  strengthWrap: {
    marginTop: 10,
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
    marginBottom: 14,
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
    height: 34,
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
    marginBottom: 8,
    marginLeft: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    height: 34,
    marginTop: 4,
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(111,175,138,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successModalMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  successModalButton: {
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  successModalButtonText: {
    color: '#0E1520',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});