import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, ScrollView, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

type AuthFlow = 'recovery' | 'signup';

export default function AuthCallback() {
  const linkingUrl = Linking.useLinkingURL();
  const [status, setStatus] = useState<string>('Waiting for callback...');
  const [failedFlow, setFailedFlow] = useState<AuthFlow | null>(null);
  const lastProcessedUrl = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const extractInner = (raw: string) => {
      // Unwrap common wrappers like l.facebook.com/l.php?u=... or google url?q=...
      let current = raw;
      for (let i = 0; i < 6; i++) {
        try {
          const u = new URL(current);
          const q = u.searchParams.get('u') || u.searchParams.get('q') || u.searchParams.get('url');
          if (q) {
            if (q === current) break;
            current = q;
            continue;
          }
        } catch (e) {
          break;
        }
        break;
      }
      return current;
    };

    const getUrlCandidates = (rawUrl: string) => {
      const candidates = [extractInner(rawUrl)];
      try {
        const redirectTo = new URL(candidates[0]).searchParams.get('redirect_to');
        if (redirectTo && !candidates.includes(redirectTo)) {
          candidates.push(redirectTo);
        }
      } catch {
        // The raw callback will be reported as invalid below.
      }
      return candidates;
    };

    const processUrl = async (rawUrl: string | null) => {
      try {
        if (!rawUrl) {
          setStatus('No authentication callback URL received. Open the latest email link again.');
          setFailedFlow('recovery');
          return;
        }

        const urls = getUrlCandidates(rawUrl).map((candidate) => new URL(candidate));
        const getParam = (key: string) => {
          for (const url of urls) {
            const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
            const value = url.searchParams.get(key) || fragment.get(key);
            if (value) return value;
          }
          return null;
        };
        const accessToken = getParam('access_token');
        const refreshToken = getParam('refresh_token');
        const code = getParam('code');
        const tokenHash = getParam('token_hash') || getParam('token');
        const otpType = getParam('type');
        const requestedFlow = getParam('flow');
        const flow: AuthFlow =
          requestedFlow === 'signup' || otpType === 'signup' ? 'signup' : 'recovery';
        const authError = getParam('error_description') || getParam('error');

        const completeFlow = () => {
          if (flow === 'recovery') {
            setStatus('Recovery session verified. Opening password update...');
            router.replace('/Forgot?reset=1');
          } else {
            setStatus('Email confirmed. Opening SAKA...');
            router.replace('/Loading');
          }
        };

        if (authError) {
          setFailedFlow(flow);
          setStatus(
            flow === 'recovery'
              ? `The reset link could not be verified: ${authError.replace(/\+/g, ' ')}`
              : `The confirmation link could not be verified: ${authError.replace(/\+/g, ' ')}`,
          );
          return;
        }

        if (accessToken && refreshToken) {
          setStatus(flow === 'recovery' ? 'Setting recovery session...' : 'Verifying email confirmation...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!mounted) return;
          if (error) {
            console.warn('[Auth] Callback session setup failed:', error.message);
            setFailedFlow(flow);
            setStatus(
              flow === 'recovery'
                ? `Could not verify the reset link: ${error.message}`
                : `Could not confirm your email: ${error.message}`,
            );
          } else {
            completeFlow();
          }
        } else if (code) {
          setStatus('Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (error) {
            console.warn('[Auth] Callback code exchange failed:', error.message);
            setFailedFlow(flow);
            setStatus(
              flow === 'recovery'
                ? `Could not verify the reset link: ${error.message}`
                : `Could not confirm your email: ${error.message}`,
            );
          } else {
            completeFlow();
          }
        } else if (tokenHash && (otpType === 'recovery' || otpType === 'signup')) {
          setStatus(flow === 'recovery' ? 'Verifying recovery link...' : 'Confirming your email...');
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (!mounted) return;
          if (error) {
            console.warn('[Auth] Email token verification failed:', error.message);
            setFailedFlow(flow);
            setStatus(
              flow === 'recovery'
                ? `Could not verify the reset link: ${error.message}`
                : `Could not confirm your email: ${error.message}`,
            );
          } else {
            completeFlow();
          }
        } else {
          setFailedFlow(flow);
          setStatus(
            flow === 'recovery'
              ? 'This callback did not contain a valid reset token. Request a new reset link and open the newest email.'
              : 'This callback did not contain a valid confirmation token. Request a new confirmation email and open the newest email.',
          );
        }
      } catch (error) {
        if (!mounted) return;
        console.warn('[Auth] Recovery callback processing failed:', error);
        setStatus('Could not read the authentication link. Request a new link and try opening it again.');
        setFailedFlow('recovery');
      }
    };

    if (linkingUrl && lastProcessedUrl.current !== linkingUrl) {
      lastProcessedUrl.current = linkingUrl;
      void processUrl(linkingUrl).catch((error: unknown) => {
        if (!mounted) return;
        console.error('[Auth] Recovery callback failed unexpectedly:', error);
        setStatus('Could not process the authentication link. Request a new link and try again.');
        setFailedFlow('recovery');
      });
    }

    return () => {
      mounted = false;
    };
  }, [linkingUrl]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E1520', padding: 14 }}>
      <ActivityIndicator size="large" color="#C9A96E" />
      <ScrollView style={{ marginTop: 18, maxWidth: '96%' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, marginBottom: 6 }}>{status}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.36)', fontSize: 12 }}>If this stays blank, open the email link in your device browser rather than inside an email or social app.</Text>
      </ScrollView>
      {failedFlow ? (
        <View style={{ width: '100%', maxWidth: 360, marginTop: 18, gap: 10 }}>
          {failedFlow === 'recovery' ? (
            <Pressable
              onPress={() => router.replace('/Forgot')}
              style={{ minHeight: 48, borderRadius: 12, backgroundColor: '#C9A96E', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#0E1520', fontSize: 15, fontWeight: '700' }}>Request a new reset link</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.replace(failedFlow === 'signup' ? '/Signup' : '/Login')}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
              {failedFlow === 'signup' ? 'Back to sign up' : 'Back to login'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
