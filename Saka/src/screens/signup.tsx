import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { getAuthErrorMessage } from '../utils/authErrorMessage';
import OfflineActionModal from '../components/OfflineActionModal';
import { isConnectionError } from '../services/offlineStatusService';
import {
  AUTH,
  AuthShell,
  EyeToggle,
  Field,
  FieldRow,
  FooterLink,
  PrimaryButton,
  SERIF,
} from '../components/auth/AuthKit';

const REQ_ITEMS = [
  { key: 'isLongEnough', label: '6+ characters' },
  { key: 'hasNumber', label: 'Number' },
  { key: 'hasUpperCase', label: 'Uppercase' },
  { key: 'hasLowerCase', label: 'Lowercase' },
  { key: 'hasSymbol', label: 'Symbol' },
] as const;

export default function SignupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const { signUp, isLoading } = useAuthStore();

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: 'transparent', width: '0%' };
    if (pwd.length < 8) return { label: 'Weak', color: AUTH.red, width: '33%' };
    if (pwd.length < 12) return { label: 'Fair', color: AUTH.gold, width: '66%' };
    return { label: 'Strong', color: AUTH.green, width: '100%' };
  };

  const checkReqs = (pwd: string) => ({
    hasNumber: /\d/.test(pwd),
    hasUpperCase: /[A-Z]/.test(pwd),
    hasLowerCase: /[a-z]/.test(pwd),
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    isLongEnough: pwd.length >= 6,
  });

  const strength = getPasswordStrength(password);
  const reqs = checkReqs(password);
  const allReqsMet = Object.values(reqs).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canSubmit = allReqsMet && passwordsMatch && phone.trim().length > 0 && !isLoading;

  // 0 = separate chips, 1 = one full-width pill (fades/slides between the two)
  const done = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(done, {
      toValue: allReqsMet ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [allReqsMet]);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword || !name || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (!allReqsMet) {
      Alert.alert('Error', 'Password does not meet all requirements');
      return;
    }
    try {
      const { error } = await signUp(email, password, name, phone.trim());
      if (error) {
        if (isConnectionError(error)) {
          setOfflineModalVisible(true);
        } else {
          setOfflineModalVisible(false);
          Alert.alert(
            'Sign up failed',
            getAuthErrorMessage(error, 'Could not create your account. Please try again.'),
          );
        }
      } else {
        setOfflineModalVisible(false);
        setShowSuccessModal(true);
      }
    } catch (error) {
      if (isConnectionError(error)) {
        setOfflineModalVisible(true);
      } else {
        setOfflineModalVisible(false);
        Alert.alert(
          'Sign up failed',
          getAuthErrorMessage(error, 'Could not create your account. Please try again.'),
        );
      }
    }
  };

  return (
    <>
      <AuthShell
        eyebrow="INTO THE VERDANT SUBLIMITY"
        title="Create account"
        subtitle="Start tracking your summits."
        note="Your trail. Your adventure. Your SAKA."
        toast={null}
        onHideToast={() => {}}
        footer={
          <FooterLink muted="Already have an account?" link="Sign in" onPress={() => router.push('/Login')} />
        }
      >
        <FieldRow>
          <Field
            label="FULL NAME"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Juan dela Cruz"
            autoCapitalize="words"
            editable={!isLoading}
          />
          <Field
            label="PHONE NUMBER"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="09xx xxx xxxx"
            keyboardType="phone-pad"
            editable={!isLoading}
          />
        </FieldRow>

        <Field
          label="EMAIL"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          editable={!isLoading}
        />

        <FieldRow>
          <Field
            label="PASSWORD"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secure={!showPassword}
            editable={!isLoading}
            right={<EyeToggle shown={showPassword} onPress={() => setShowPassword((v) => !v)} />}
          />
          <Field
            label="CONFIRM PASSWORD"
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secure={!showConfirmPassword}
            editable={!isLoading}
            tone={confirmPassword.length > 0 ? (passwordsMatch ? 'ok' : 'bad') : undefined}
            trailing={
              confirmPassword.length > 0
                ? { text: passwordsMatch ? '✓ Match' : '✗ No match', color: passwordsMatch ? AUTH.green : AUTH.red }
                : undefined
            }
            right={<EyeToggle shown={showConfirmPassword} onPress={() => setShowConfirmPassword((v) => !v)} />}
          />
        </FieldRow>

        {/* Password rules: chips light up green; when all are met they melt into one full-width pill */}
        <View accessibilityLabel="Password requirements">
          <Animated.View
            style={[
              styles.chips,
              {
                opacity: done.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
                transform: [{ scale: done.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }],
              },
            ]}
          >
            {REQ_ITEMS.map((item) => {
              const met = reqs[item.key];
              return (
                <View key={item.key} style={[styles.chip, met && styles.chipMet]}>
                  <Text style={[styles.chipText, met && styles.chipTextMet]}>{item.label}</Text>
                </View>
              );
            })}
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.pillWrap,
              {
                opacity: done.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ scaleX: done.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          >
            <View style={styles.pill}>
              <Text style={styles.pillText}>All requirements met</Text>
            </View>
          </Animated.View>
        </View>

        {password.length > 0 ? (
          <View style={styles.strengthRow}>
            <View style={styles.strengthTrack}>
              <View
                style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]}
              />
            </View>
            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
          </View>
        ) : null}

        <View style={{ height: 8 }} />

        <PrimaryButton
          label="Create Account"
          loadingLabel="Creating account…"
          loading={isLoading}
          disabled={!canSubmit}
          onPress={handleSignup}
        />
      </AuthShell>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.successCard, { width: Math.min(width - 48, 340) }]}>
            <View style={styles.successRing}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={26} color={AUTH.green} />
              </View>
            </View>
            <Text style={styles.successTitle} accessibilityRole="header">Account created</Text>
            <Text style={styles.successMessage}>
              Your account has been created successfully. Please sign in to continue.
            </Text>
            <Pressable
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/Login');
              }}
              style={({ pressed }) => [styles.successButton, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
            >
              <Text style={styles.successButtonText}>Go to sign in</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <OfflineActionModal
        visible={offlineModalVisible}
        message="Creating an account needs an internet connection. Check your connection and try again."
        retrying={isLoading}
        onRetry={() => void handleSignup()}
        onDismiss={() => setOfflineModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: -2 },
  pillWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center' },
  pill: {
    alignSelf: 'stretch',
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,175,138,0.55)',
    backgroundColor: 'rgba(111,175,138,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: AUTH.green, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipMet: { borderColor: 'rgba(111,175,138,0.6)', backgroundColor: 'rgba(111,175,138,0.18)' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 9.5, fontWeight: '600' },
  chipTextMet: { color: AUTH.green },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 9.5, fontWeight: '700', minWidth: 36, textAlign: 'right' },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,8,13,0.72)',
  },
  successCard: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: AUTH.ink,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },
  successRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(111,175,138,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(111,175,138,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(111,175,138,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(111,175,138,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginTop: 16,
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  successMessage: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  successButton: {
    alignSelf: 'stretch',
    height: 50,
    marginTop: 20,
    borderRadius: 25,
    backgroundColor: AUTH.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonText: { color: AUTH.ink, fontSize: 15.5, fontWeight: '800' },
});