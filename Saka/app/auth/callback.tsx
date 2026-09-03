import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function AuthCallback() {
  const [status, setStatus] = useState<string>('Waiting for callback...');
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
            const decoded = decodeURIComponent(q);
            if (decoded === current) break;
            current = decoded;
            continue;
          }
        } catch (e) {
          break;
        }
        break;
      }
      return current;
    };

    const processUrl = async (rawUrl: string | null) => {
      try {
        setStatus(`Raw URL: ${rawUrl ?? 'null'}`);
        if (!rawUrl) return;

        let urlStr = extractInner(rawUrl);
        setStatus(`Parsed URL: ${urlStr}`);

        // If a redirect_to param exists and contains an encoded URI, unwrap it
        try {
          const maybe = new URL(urlStr);
          const redirectTo = maybe.searchParams.get('redirect_to');
          if (redirectTo) {
            const decoded = decodeURIComponent(redirectTo);
            urlStr = decoded;
            setStatus(`Follow redirect_to -> ${urlStr}`);
          }
        } catch (e) {
          // ignore
        }

        // Now parse tokens from fragment or code from search
        const url = new URL(urlStr);
        const hash = (url.hash || '').replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = url.searchParams.get('code') || params.get('code');

        if (accessToken && refreshToken) {
          setStatus('Setting recovery session...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.warn('[Auth] Recovery session set failed:', error.message);
            setStatus(`Session set failed: ${error.message}`);
          } else {
            setStatus('Recovery session set; redirecting...');
          }
        } else if (code) {
          setStatus('Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('[Auth] Exchange code for session failed:', error.message);
            setStatus(`Exchange failed: ${error.message}`);
          } else {
            setStatus('Code exchanged; redirecting...');
          }
        } else {
          setStatus('Callback did not contain tokens or code.');
        }
      } catch (error) {
        console.warn('[Auth] URL processing failed:', error);
        setStatus(`Processing error: ${String(error)}`);
      } finally {
        if (mounted) {
          // small delay so user can see status
          setTimeout(() => router.replace('/Login'), 800);
        }
      }
    };

    const handleInitial = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        await processUrl(initialUrl);
      } catch (err) {
        console.warn('[Auth] Initial URL read failed:', err);
        setStatus(`Initial URL read failed: ${String(err)}`);
        setTimeout(() => router.replace('/Login'), 800);
      }
    };

    const onUrl = ({ url }: { url: string }) => {
      processUrl(url);
    };

    // listen for incoming url events (use subscription API when available)
    const subscription: any = (Linking as any).addEventListener
      ? (Linking as any).addEventListener('url', onUrl)
      : null;
    handleInitial();

    return () => {
      mounted = false;
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        // fallback for environments using the older add/removeEventListener API
        try {
          (Linking as any).removeEventListener?.('url', onUrl);
        } catch (e) {
          // ignore if not supported
        }
      }
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E1520', padding: 14 }}>
      <ActivityIndicator size="large" color="#C9A96E" />
      <ScrollView style={{ marginTop: 18, maxWidth: '96%' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, marginBottom: 6 }}>{status}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.36)', fontSize: 12 }}>If this stays blank, copy the verification link from the email and paste it into the device browser (not inside Gmail/Facebook wrappers).</Text>
      </ScrollView>
    </View>
  );
}
