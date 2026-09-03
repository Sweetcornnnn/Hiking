// src/store/authStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  contact_number: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

type AppUser = User & { name?: string | null };

interface AuthState {
  user: AppUser | null;
  session: Session | null;
  profile: Profile | null;
  authToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, contactNumber?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  resetLoading: () => void;
}

const getDisplayName = (user: User | null, profile: Profile | null = null): string => {
  const metadataName = (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
    ?? (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name
    ?? profile?.full_name
    ?? user?.email?.split('@')[0]
    ?? 'Hiker';

  return metadataName || 'Hiker';
};

const normalizeUser = (user: User | null, profile: Profile | null = null): AppUser | null => {
  if (!user) return null;
  return {
    ...user,
    name: getDisplayName(user, profile),
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  authToken: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  // ─── SIGN IN ──────────────────────────────────────────────────
  signIn: async (email, password) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({
        user: data.user,
        session: data.session,
        isAuthenticated: !!data.session,
        isLoading: false,
      });

      await get().loadProfile();

      return { success: true };
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // ─── SIGN UP (FIXED FOR SUPABASE) ──────────────────────────
  signUp: async (email, password, fullName, contactNumber) => {
    try {
      set({ isLoading: true, error: null });

      console.log('[Auth] Creating user:', email);

      // Step 1: Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'saka://auth/callback',
          data: {
            full_name: fullName,
            contact_number: contactNumber || null,
          },
        },
      });

      if (error) {
        console.error('[Auth] Signup error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('User creation failed');
      }

      console.log('[Auth] User created in Auth:', data.user.id);

      // Step 2: Create profile in profiles table
      // If RLS is not configured yet, Supabase will reject this insert.
      // We still keep the auth user alive and surface a backend fix instead of failing the whole sign-up.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          contact_number: contactNumber || null,
          is_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.warn('[Auth] Profile creation blocked by RLS or backend config:', profileError);
        if (profileError.code !== '42501') {
          throw new Error('Profile creation failed. Please try again.');
        }
      } else {
        console.log('[Auth] Profile created successfully');
      }

      set({
        user: normalizeUser(data.user),
        session: data.session,
        authToken: data.session?.access_token ?? null,
        isAuthenticated: !!data.session,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Signup failed:', error.message);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // ─── SIGN OUT ──────────────────────────────────────────────────
  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      set({
        user: null,
        session: null,
        profile: null,
        authToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ─── LOAD SESSION ──────────────────────────────────────────────
  loadSession: async () => {
    try {
      set({ isLoading: true });

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          session,
          user: normalizeUser(session.user, profile || null),
          profile: profile || null,
          authToken: session.access_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          session: null,
          user: null,
          profile: null,
          authToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              set({
                session,
                user: normalizeUser(session.user, profile || null),
                profile: profile || null,
                authToken: session.access_token,
                isAuthenticated: true,
              });
            });
        } else {
          set({
            session: null,
            user: null,
            profile: null,
            authToken: null,
            isAuthenticated: false,
          });
        }
      });
    } catch (error) {
      console.error('[Auth] loadSession error:', error);
      set({ isLoading: false });
    }
  },

  // ─── LOAD PROFILE ──────────────────────────────────────────────
  loadProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        set({
          profile,
          user: normalizeUser(user, profile),
        });
      }
    } catch (error) {
      console.error('[Auth] loadProfile error:', error);
    }
  },

  // ─── UPDATE PROFILE ──────────────────────────────────────────────
  updateProfile: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await get().loadProfile();

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // ─── RESET PASSWORD ──────────────────────────────────────────────
  resetPassword: async (email) => {
    try {
      set({ isLoading: true, error: null });

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured in this app. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'saka://auth/callback',
      });

      if (error) {
        const message = error.message || 'Password reset request failed.';

        if (message.toLowerCase().includes('user not found')) {
          throw new Error('No account exists for this email. Check the email address or sign up first.');
        }

        if (message.toLowerCase().includes('email') || message.toLowerCase().includes('provider')) {
          throw new Error('Supabase email auth is not configured correctly. Enable Email sign-in and add the redirect URL saka://auth/callback in Supabase Auth settings.');
        }

        throw new Error(message);
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      const message = error?.message || 'Password reset request failed.';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // ─── CLEAR ERROR ──────────────────────────────────────────────────
  clearError: () => {
    set({ error: null });
  },

  // ─── RESET LOADING ──────────────────────────────────────────────
  resetLoading: () => {
    set({ isLoading: false, error: null });
  },
}));