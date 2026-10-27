import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

// ── ONE number to resize the whole card and everything inside it ──
// 1 = original size, 0.85 = smaller, 0.7 = even smaller. Change only this.
const SCALE = 0.85;
const s = (n: number) => Math.round(n * SCALE);

// ── Size controls (scaled automatically) ──
const INPUT_HEIGHT = s(36);      // height of every input box and the button
const INPUT_FONT_SIZE = s(12);   // text size inside the input boxes
const INPUT_GAP = s(12);         // horizontal space between the two columns
const FIELD_ROW_GAP = s(8);      // vertical space between rows of fields

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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Left panel ── */}
        <ImageBackground
          source={require('../../assets/images/MountainBg.jpg')}
          style={styles.leftPanel}
          resizeMode="cover"
        >
          {/* Dark overlay so the text stays readable. Change the 0.45 in styles.leftOverlay to adjust. */}
          <View style={[styles.leftOverlay, { pointerEvents: 'none' }]} />

          <TouchableOpacity activeOpacity={0.75} style={styles.logoMark}>
            <Image
              source={require('../../assets/images/SakaLogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.brandStatement}>INTO THE VERDANT SUBLIMITY</Text>
          <Text style={styles.brandTagline}>Your trail. Your adventure.{'\n'}Your SAKA</Text>

          <View style={styles.dividerH} />

          <View style={styles.rulesCard}>
          <Text style={styles.sectionLabel}>PASSWORD RULES</Text>
          {REQ_ITEMS.map((item) => {
            const met = reqs[item.key];
            return (
              <View key={item.key} style={styles.reqRow}>
                <Ionicons
                  name={met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={s(11)}
                  color={met ? '#6FAF8A' : 'rgba(255,255,255,0.35)'}
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
        </ImageBackground>

        {/* ── Vertical divider ── */}
        <View style={styles.dividerV} />

        {/* ── Right panel ── */}
        <View style={styles.rightPanel}>
          <Text style={styles.formTitle}>Create account</Text>
          <Text style={styles.formSubtitle}>Start tracking your summits</Text>

          <View style={styles.fieldsGrid}>
            <View style={styles.fieldRow}>
              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={s(13)} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Juan dela Cruz" placeholderTextColor="rgba(255,255,255,0.18)"
                    value={name} onChangeText={setName} editable={!isLoading} />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={s(13)} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.18)"
                    value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={s(14)} color="rgba(255,255,255,0.28)" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.fieldRow}>
              {/* Phone Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="call-outline" size={s(13)} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="09xx xxx xxxx" placeholderTextColor="rgba(255,255,255,0.18)"
                    value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" editable={!isLoading} />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                  {confirmPassword.length > 0 && (
                    <Text numberOfLines={1} style={[styles.matchText, { color: passwordsMatch ? '#6FAF8A' : '#E07070' }]}>
                      {passwordsMatch ? '✓ Match' : '✗ No match'}
                    </Text>
                  )}
                </View>
                <View style={[styles.inputRow, confirmPassword.length > 0 && { borderColor: passwordsMatch ? 'rgba(111,175,138,0.35)' : 'rgba(224,112,112,0.35)' }]}>
                  <Ionicons name="lock-closed-outline" size={s(13)} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.18)"
                    value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} editable={!isLoading} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={s(14)} color="rgba(255,255,255,0.28)" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Email */}
            <View style={styles.emailFieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={s(13)} color="rgba(255,255,255,0.22)" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.18)"
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />
              </View>
            </View>
          </View>

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={!canSubmit}
              activeOpacity={0.82}
            >
              {isLoading
                ? <Text style={styles.submitText}>Creating account…</Text>
                : <><Text style={styles.submitText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={s(13)} color="#0E1520" style={{ marginLeft: s(10) }} /></>
              }
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/Login')}>
                <Text style= {styles.footerLink}>Sign in</Text> 
              </TouchableOpacity>
            </View>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Card size
  card: {
    flexDirection: 'row',
    width: '92%',
    maxWidth: s(700),
    height: '94%',
    maxHeight: s(330),
    backgroundColor: '#0E1520',
    borderRadius: s(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // ── Left panel ──
  leftPanel: {
    width: s(168),
    overflow: 'hidden',
    backgroundColor: '#111927',
    paddingHorizontal: s(18),
    paddingTop: s(14),
    paddingBottom: s(12),
    alignItems: 'center',
  },
  // Darkens the mountain image. Higher number = darker image.
  leftOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,13,20,0.45)',
  },
  // Frosted box behind the password rules so they stay easy to read.
  rulesCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(8,13,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: s(10),
    paddingVertical: s(7),
    paddingHorizontal: s(6),
  },
  logoMark: {
    marginBottom: -s(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Logo size
  logoImage: {
    width: s(76),
    height: s(76),
  },
  brandStatement: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: s(10),
    fontWeight: '700',
    letterSpacing: 0.7,
    lineHeight: s(14),
    marginBottom: s(4),
    textAlign: 'center',
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: s(10),
    lineHeight: s(14),
    marginBottom: s(10),
    textAlign: 'center',
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: s(10),
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: s(12),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: s(6),
    alignSelf: 'stretch',
    paddingHorizontal: s(4),
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: s(5),
    gap: s(9),
    marginBottom: s(10),
  },
  reqText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: s(10),
  },
  reqTextMet: {
    color: '#6FAF8A',
  },
  strengthWrap: {
    marginTop: s(8),
    alignSelf: 'stretch',
    paddingHorizontal: s(4),
  },
  strengthTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: s(4),
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: s(9),
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // ── Right panel ──
  rightPanel: {
    flex: 1,
    paddingHorizontal: s(20),
    paddingTop: s(14),
    paddingBottom: s(12),
    justifyContent: 'center',
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: s(16),
    fontWeight: '700',
    marginBottom: s(3),
  },
  formSubtitle: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: s(10),
    marginBottom: s(10),
  },
  // Vertical space between the rows of fields.
  fieldsGrid: {
    gap: FIELD_ROW_GAP,
  },
  // Horizontal space between the two columns.
  fieldRow: {
    flexDirection: 'row',
    gap: INPUT_GAP,
  },
  // Equal flex = both columns have exactly the same width.
  fieldGroup: {
    flex: 1,
    minWidth: 0,
  },
  // Email uses the full row width.
  emailFieldGroup: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: s(9),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: s(4),
  },
  // Height, radius and padding of every input box.
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: s(10),
    height: INPUT_HEIGHT,
  },
  inputIcon: { marginRight: s(7) },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: INPUT_FONT_SIZE,
    paddingVertical: 0,
  },
  eyeBtn: { padding: s(4), marginLeft: s(2) },
  // "Match" text sits on the label line so it never pushes the layout down.
  matchText: {
    fontSize: s(9),
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: s(4),
    flexShrink: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A96E',
    borderRadius: s(8),
    height: INPUT_HEIGHT,
    marginTop: s(12),
    marginBottom: s(8),
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: {
    color: '#0E1520',
    fontSize: s(12),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(5),
  },
  footerMuted: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: s(12),
  },
  footerLink: {
    color: '#C9A96E',
    fontSize: s(12),
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