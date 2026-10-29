import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getAuthErrorMessage } from '../utils/authErrorMessage';
import OfflineActionModal from '../components/OfflineActionModal';
import { isConnectionError } from '../services/offlineStatusService';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  AUTH,
  AuthShell,
  EyeToggle,
  Field,
  FooterLink,
  PrimaryButton,
  type ToastConfig,
} from '../components/auth/AuthKit';

// ─── Secret admin tap pattern ───────────────────────────────────────────────
// The logo is split into a 3 x 3 grid. Tap these cells, in order, to switch
// between hiker and admin sign in:
//
//     0 | 1 | 2        (1 = top, over the peak)
//    ---+---+---
//     3 | 4 | 5
//    ---+---+---
//     6 | 7 | 8
//
// Default: top, left, right, bottom, centre. Change the numbers to make your own.
const SECRET_PATTERN = [1, 3, 5, 7, 4];
// If you pause longer than this between taps, the pattern starts over.
const SECRET_TIMEOUT_MS = 2500;
// TEMPORARY: shows a toast on every logo tap so you can test the pattern.
// Set to false (or delete the debug lines) when you're done.
const SECRET_DEBUG = false;
// The part of the logo that counts as "the logo", as fractions of the logo box:
// x0/x1 = left/right edge, y0/y1 = top/bottom edge. The 3 x 3 grid covers only this area,
// and taps outside it are ignored. While SECRET_DEBUG is true the grid is drawn over the logo,
// so move these numbers until the box hugs the artwork.
const LOGO_GRID = { x0: 0.2, x1: 0.8, y0: 0.05, y1: 0.95, show: SECRET_DEBUG };

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const secretStep = useRef(0);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const { signIn, isLoading, resetLoading } = useAuthStore();

  useEffect(() => {
    // Reset loading state when the screen mounts and unmounts
    resetLoading();
    return () => {
      resetLoading();
      if (secretTimer.current) clearTimeout(secretTimer.current);
    };
  }, []);

  const showToast = useCallback((config: ToastConfig) => setToast(config), []);

  const toggleAdminMode = (nextState: boolean) => {
    setIsAdminLogin(nextState);
    secretStep.current = 0;
    setEmail('');
    setPassword('');
    setToast(null);
  };

  // Hidden: tap specific spots on the logo, in order, to switch between hiker and admin sign in.
  const handleLogoPress = (cell: number) => {
    if (secretTimer.current) clearTimeout(secretTimer.current);
    secretTimer.current = setTimeout(() => {
      secretStep.current = 0;
    }, SECRET_TIMEOUT_MS);

    if (cell === SECRET_PATTERN[secretStep.current]) {
      secretStep.current += 1;
      if (secretStep.current >= SECRET_PATTERN.length) {
        secretStep.current = 0;
        const nextAdmin = !isAdminLogin;
        toggleAdminMode(nextAdmin);
        if (SECRET_DEBUG) {
          showToast({
            type: 'success',
            title: 'Pattern complete',
            message: nextAdmin ? 'Switched to admin sign in.' : 'Switched to hiker sign in.',
          });
        }
      } else if (SECRET_DEBUG) {
        showToast({
          type: 'success',
          title: 'Correct',
          message: `Step ${secretStep.current} of ${SECRET_PATTERN.length}`,
        });
      }
    } else {
      // Wrong spot: start over (this tap may still be the first step).
      secretStep.current = cell === SECRET_PATTERN[0] ? 1 : 0;
      if (SECRET_DEBUG) {
        showToast({
          type: 'denied',
          title: 'Wrong spot',
          message:
            secretStep.current === 1
              ? `You tapped cell ${cell}. Restarted at step 1 of ${SECRET_PATTERN.length}.`
              : `You tapped cell ${cell}. Pattern reset.`,
        });
      }
    }
  };

  const handleLogin = async () => {
    // Prevent double submission
    if (isLoading) return;

    if (!email || !password) {
      showToast({
        type: 'error',
        title: 'Missing fields',
        message: 'Please enter both email and password.',
      });
      return;
    }

    try {
      const res = await signIn(email, password);

      if (res.error) {
        if (isConnectionError(res.error)) {
          setOfflineModalVisible(true);
        } else {
          setOfflineModalVisible(false);
          showToast({
            type: 'error',
            title: 'Sign in failed',
            message: getAuthErrorMessage(res.error, 'Could not sign in. Please try again.'),
          });
        }
        resetLoading();
        return;
      }

      setOfflineModalVisible(false);
      const authState = useAuthStore.getState();
      const role = authState.profile?.role ?? 'hiker';

      if (isAdminLogin) {
        if (!authState.profile?.is_admin) {
          showToast({
            type: 'denied',
            title: 'Access denied',
            message: 'This account does not have admin privileges.',
          });
          resetLoading();
          return;
        }
        router.replace('/Loading');
      } else {
        if (authState.profile?.is_admin) {
          showToast({
            type: 'denied',
            title: 'Access denied',
            message: 'Admin accounts must use the admin login.',
          });
          resetLoading();
          return;
        }

        if (role === 'organization') {
          router.replace('/Loading');
          return;
        }

        router.replace('/Loading');
      }
    } catch (err: unknown) {
      if (isConnectionError(err)) {
        setOfflineModalVisible(true);
      } else {
        setOfflineModalVisible(false);
        showToast({
          type: 'error',
          title: 'Sign in failed',
          message: getAuthErrorMessage(err, 'Could not sign in. Please try again.'),
        });
      }
      resetLoading();
    } finally {
      resetLoading();
    }
  };

  return (
    <>
      <AuthShell
        eyebrow={isAdminLogin ? 'ADMIN ACCESS' : 'INTO THE VERDANT SUBLIMITY'}
        title={isAdminLogin ? 'Admin login' : 'Welcome back'}
        subtitle={
          isAdminLogin
            ? 'Hidden sign in for administrators only.'
            : 'Ready for your climb? Sign in to discover the sublime landscapes of Aklan.'
        }
        note={isAdminLogin ? 'Admin ka Gale?' : undefined}
        onLogoPress={handleLogoPress}
        logoGrid={LOGO_GRID}
        toast={toast}
        onHideToast={() => setToast(null)}
        footer={
          isAdminLogin ? null : (
            <FooterLink muted="No account yet?" link="Create one" onPress={() => router.push('/Signup')} />
          )
        }
      >
        <Field
          label="EMAIL"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder={isAdminLogin ? 'admin@example.com' : 'you@example.com'}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          label="PASSWORD"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secure={!showPassword}
          right={<EyeToggle shown={showPassword} onPress={() => setShowPassword((v) => !v)} />}
        />

        {!isAdminLogin ? (
          <Pressable
            onPress={() => router.push('/Forgot')}
            hitSlop={8}
            style={styles.forgot}
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        ) : null}

        <PrimaryButton
          label={isAdminLogin ? 'Admin Sign In' : 'Sign In'}
          loadingLabel="Signing in…"
          loading={isLoading}
          onPress={handleLogin}
        />
      </AuthShell>

      <OfflineActionModal
        visible={offlineModalVisible}
        message="Signing in needs an internet connection. Check your connection and try again."
        retrying={isLoading}
        onRetry={() => void handleLogin()}
        onDismiss={() => setOfflineModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 10 },
  forgotText: { color: AUTH.gold, fontSize: 11, fontWeight: '600' },
});