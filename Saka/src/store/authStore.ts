import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  demoLogin: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isDemoMode: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  signIn: async (email, password) => {
    set({ isLoading: true });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      return { error: error.message };
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    set({
      user: profile ? {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        is_admin: profile.is_admin,
      } : null,
      isAuthenticated: true,
      isLoading: false,
    });

    return { error: null };
  },

  signUp: async (email, password, name) => {
    set({ isLoading: true });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      return { error: error.message };
    }

    // Create profile
    if (data.user) {
      await supabase.from('profiles').insert([
        {
          id: data.user.id,
          email,
          name,
          is_admin: false,
        },
      ]);
    }

    set({ isLoading: false });
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      set({
        user: profile ? {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          is_admin: profile.is_admin,
        } : null,
        isAuthenticated: true,
      });
    }
  },

  demoLogin: () => {
    // Demo user for testing without Supabase
    set({
      user: {
        id: 'demo-user-123',
        email: 'demo@saka.app',
        name: 'Demo Hiker',
        is_admin: true, // Admin access in demo mode
      },
      isAuthenticated: true,
      isDemoMode: true,
      isLoading: false,
    });
  },
}));
