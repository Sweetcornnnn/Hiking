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

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
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
        console.error('[Auth] Profile creation error:', profileError);
        throw new Error('Profile creation failed. Please try again.');
      }

      console.log('[Auth] Profile created successfully');

      set({
        user: data.user,
        session: data.session,
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
          user: session.user,
          profile: profile || null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          session: null,
          user: null,
          profile: null,
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
                user: session.user,
                profile: profile || null,
                isAuthenticated: true,
              });
            });
        } else {
          set({
            session: null,
            user: null,
            profile: null,
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
        set({ profile });
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

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'yourapp://reset-password',
      });

      if (error) throw error;

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
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