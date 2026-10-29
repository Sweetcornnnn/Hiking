import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
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
  type ToastConfig,
} from '../components/auth/AuthKit';

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
  const [offlineAction, setOfflineAction] = useState<'request' | 'update' | null>(null);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  // Shows the green toast, then heads back to Login.
  const showSuccessToast = (title: string, message: string) => {
    setToast({ type: 'success', title, message });
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    redirectTimer.current = setTimeout(() => {
      router.replace('/Login');
    }, 2600);
  };

  useEffect(() => {
    if (mode !== 'reset') return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        Alert.alert(
          'Connection problem',
          getAuthErrorMessage(error, 'Could not verify the reset link. Please try again.'),
        );
        return;
      }
      if (!session) {
        setMode('request');
        Alert.alert(
          'Link expired',
          'Your reset link is invalid or has expired. Please request a new one.',
        );
      }
    }).catch((error: unknown) => {
      if (cancelled) return;
      Alert.alert(
        'Could not verify reset link',
        getAuthErrorMessage(error, 'Please try again.'),
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
      setOfflineAction(null);
      showSuccessToast(
        'Reset link sent',
        'Check your email and follow the secure link to continue.',
      );
    } catch (error: any) {
      setIsLoading(false);
      if (isConnectionError(error)) {
        setOfflineAction('request');
      } else {
        setOfflineAction(null);
        Alert.alert(
          'Reset link not sent',
          getAuthErrorMessage(error, 'Could not send the reset link. Please try again.'),
        );
      }
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
        if (isConnectionError(error)) {
          setOfflineAction('update');
        } else {
          setOfflineAction(null);
          Alert.alert(
            'Update failed',
            getAuthErrorMessage(error, 'Could not update your password. Please try again.'),
          );
        }
        return;
      }

      await supabase.auth.signOut();
      setOfflineAction(null);
      showSuccessToast(
        'Password updated',
        'You can now sign in with your new password.',
      );
    } catch (error) {
      if (isConnectionError(error)) {
        setOfflineAction('update');
      } else {
        setOfflineAction(null);
        Alert.alert(
          'Update failed',
          getAuthErrorMessage(error, 'Could not update your password. Please try again.'),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isReset = mode === 'reset';

  return (
    <>
      <AuthShell
        eyebrow="ACCOUNT RECOVERY"
        title={isReset ? 'New password' : 'Forgot password'}
        subtitle={
          isReset
            ? 'Choose a strong password to secure your account.'
            : 'We’ll send a secure recovery link to your email.'
        }
        note={
          isReset
            ? 'Pick at least 6 characters. Avoid reusing old passwords.'
            : 'Use the link in your inbox to continue the reset.'
        }
        toast={toast}
        onHideToast={() => setToast(null)}
        footer={<FooterLink muted="Remembered it?" link="Back to Login" onPress={() => router.replace('/Login')} />}
      >
        {!isReset ? (
          <>
            <Field
              label="EMAIL"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />

            <PrimaryButton
              label="Send Reset Link"
              loadingLabel="Sending link…"
              loading={isLoading}
              disabled={!email.trim()}
              onPress={handleRequestReset}
            />
          </>
        ) : (
          <>
            <FieldRow>
              <Field
                label="NEW PASSWORD"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                secure={!showPassword}
                editable={!isLoading}
                right={<EyeToggle shown={showPassword} onPress={() => setShowPassword((v) => !v)} />}
              />
              <Field
                label="CONFIRM PASSWORD"
                icon="lock-closed-outline"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                secure={!showPassword}
                editable={!isLoading}
                tone={confirmPassword.length > 0 ? (passwordsMatch ? 'ok' : 'bad') : undefined}
                trailing={
                  confirmPassword.length > 0
                    ? { text: passwordsMatch ? '✓ Match' : '✗ No match', color: passwordsMatch ? AUTH.green : AUTH.red }
                    : undefined
                }
              />
            </FieldRow>

            <PrimaryButton
              label="Update Password"
              loadingLabel="Updating…"
              loading={isLoading}
              disabled={!password || !confirmPassword}
              onPress={handleUpdatePassword}
            />
          </>
        )}
      </AuthShell>

      <OfflineActionModal
        visible={offlineAction !== null}
        message={offlineAction === 'update'
          ? 'Updating your password needs an internet connection. Connect and try again.'
          : 'Sending a password reset link needs an internet connection. Connect and try again.'}
        retrying={isLoading}
        onRetry={() => {
          if (offlineAction === 'update') {
            void handleUpdatePassword();
          } else {
            void handleRequestReset();
          }
        }}
        onDismiss={() => setOfflineAction(null)}
      />
    </>
  );
}