// src/store/authStore.ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import {
  cacheProfileLocally,
  getCachedProfile,
  getProfileUpdateStatus,
  queueProfileUpdate,
  retryProfileUpdateQueue,
} from '../services/offlineProfileService';
import { uploadProfileAvatar } from '../services/profileAvatarService';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  contact_number: string | null;
  is_admin: boolean;
  role: 'hiker' | 'organization' | 'admin' | null;
  organization_id: string | null;
  is_verified: boolean;
  avatar_url: string | null;
  bio?: string | null;
  created_at: string;
  updated_at: string;
  sync_status?: 'pending' | 'failed';
  sync_conflict?: boolean;
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
  updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; error?: string; pendingSync?: boolean }>;
  retryProfileSync: () => Promise<void>;
  refreshProfileSyncStatus: () => Promise<void>;
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

      if (data.session?.access_token) {
        await SecureStore.setItemAsync('authToken', data.session.access_token);
      }

      set({
        user: data.user,
        session: data.session,
        authToken: data.session?.access_token ?? null,
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
            role: 'hiker',
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

      // Step 2: Create or update profile in profiles table (idempotent)
      // Use upsert so this call is safe if a DB trigger already created the profile.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: email,
            full_name: fullName,
            contact_number: contactNumber || null,
            is_admin: false,
            role: 'hiker',
            organization_id: null,
            is_verified: false,
            avatar_url: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.warn('[Auth] Profile creation blocked by RLS or backend config:', profileError);
        // RLS / permission error: allow sign-up but inform backend needs fixing
        if (profileError.code === '42501') {
          // permission denied under RLS - don't fail the signup flow here
        } else if (profileError.code === '23505') {
          // duplicate key - profile already exists (created previously)
          console.warn('[Auth] Profile already exists; loading existing profile');
          try {
            await get().loadProfile();
          } catch (e) {
            console.warn('[Auth] loadProfile failed after duplicate key:', e);
          }
        } else {
          throw new Error('Profile creation failed. Please try again.');
        }
      } else {
        console.log('[Auth] Profile created successfully');
      }

      if (data.session?.access_token) {
        await SecureStore.setItemAsync('authToken', data.session.access_token);
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
      await SecureStore.deleteItemAsync('authToken');
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
        const cachedProfile = await getCachedProfile<Profile>(session.user.id);
        const queuedUpdate = await getProfileUpdateStatus(session.user.id);
        await SecureStore.setItemAsync('authToken', session.access_token);
        set({
          session,
          user: normalizeUser(session.user, cachedProfile || null),
          profile: cachedProfile ? { ...cachedProfile, sync_status: queuedUpdate?.status } : null,
          authToken: session.access_token,
          isAuthenticated: true,
          isLoading: false,
        });

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (error) throw error;
        if (profile) {
          const currentQueuedUpdate = await getProfileUpdateStatus(session.user.id);
          const currentCachedProfile = await getCachedProfile<Profile>(session.user.id);
          const profileWithSyncStatus = {
            ...profile,
            sync_status: currentQueuedUpdate?.status,
            sync_conflict: currentCachedProfile?.sync_conflict || false,
          };
          await cacheProfileLocally(session.user.id, profileWithSyncStatus);
          set({
            user: normalizeUser(session.user, profileWithSyncStatus),
            profile: profileWithSyncStatus,
          });
        }
      } else {
        await SecureStore.deleteItemAsync('authToken');
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;

      const cachedProfile = await getCachedProfile<Profile>(user.id);
      if (cachedProfile) {
        const queuedUpdate = await getProfileUpdateStatus(user.id);
        set({
          profile: { ...cachedProfile, sync_status: queuedUpdate?.status },
          user: normalizeUser(user, cachedProfile),
        });
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      if (profile) {
        const queuedUpdate = await getProfileUpdateStatus(user.id);
        const profileWithSyncStatus = {
          ...profile,
          sync_status: queuedUpdate?.status,
          sync_conflict: cachedProfile?.sync_conflict || false,
        };
        await cacheProfileLocally(user.id, profileWithSyncStatus);
        set({
          profile: profileWithSyncStatus,
          user: normalizeUser(user, profileWithSyncStatus),
        });
      }
    } catch (error) {
      console.warn('[Auth] Profile refresh failed; retaining device copy:', error);
    }
  },

  // ─── UPDATE PROFILE ──────────────────────────────────────────────
  updateProfile: async (data) => {
    let queuedData = { ...data } as Record<string, unknown>;
    try {
      set({ isLoading: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) throw new Error('User not authenticated');

      const payload: Partial<Profile> = { ...data };
      if (typeof payload.avatar_url === 'string' && /^(file:|content:)/i.test(payload.avatar_url)) {
        payload.avatar_url = await uploadProfileAvatar(user.id, payload.avatar_url);
      }
      queuedData = { ...payload } as Record<string, unknown>;

      const { error } = await supabase
        .from('profiles')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await get().loadProfile();

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      const user = get().user;
      if (user && isNetworkFailure(error)) {
        try {
          await queueProfileUpdate(user.id, queuedData, get().profile?.updated_at ?? null);
          const currentProfile = get().profile;
          const localProfile = {
            ...currentProfile,
            ...data,
            id: user.id,
            sync_status: 'pending' as const,
          } as Profile;
          await cacheProfileLocally(user.id, localProfile);
          set({
            profile: localProfile,
            user: normalizeUser(user, localProfile),
            isLoading: false,
            error: null,
          });
          return { success: true, pendingSync: true };
        } catch (queueError) {
          const message = queueError instanceof Error ? queueError.message : 'Unable to save profile changes on this device.';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      }
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  retryProfileSync: async () => {
    try {
      await retryProfileUpdateQueue();
    } catch (error) {
      console.error('[Auth] Profile retry failed:', error);
    }
    await get().loadProfile();
  },

  refreshProfileSyncStatus: async () => {
    const userId = get().user?.id;
    const currentProfile = get().profile;
    if (!userId || !currentProfile) return;
    const queuedUpdate = await getProfileUpdateStatus(userId);
    const cachedProfile = await getCachedProfile<Profile>(userId);
    const updatedProfile = {
      ...currentProfile,
      ...(cachedProfile ?? {}),
      sync_status: queuedUpdate?.status,
      sync_conflict: cachedProfile?.sync_conflict ?? currentProfile.sync_conflict,
    };
    set({
      profile: updatedProfile,
      user: normalizeUser(get().user, updatedProfile),
    });
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

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network|fetch|offline|timed?\s*out|connection|internet/i.test(message);
}