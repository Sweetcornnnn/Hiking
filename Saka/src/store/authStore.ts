import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { resolveApiBaseUrl } from '../config/api';

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  contact_number?: string;
}

interface AuthState {
  user: User | null;
  authToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthToken: (token: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, contactNumber: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  // (demo mode removed)
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authToken: null,
  isLoading: false,
  isAuthenticated: false,
  // demo mode removed

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthToken: (token) => set({ authToken: token }),

  signIn: async (email, password) => {
    set({ isLoading: true });
    
    try {
      const base = await resolveApiBaseUrl();
      console.log(`Attempting login to ${base}/api/login`);
      const response = await fetchWithTimeout(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, 10000);

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Login failed' };
      }

      set({
        user: {
          id: String(data.user.id),
          email: data.user.email,
          name: data.user.name,
          is_admin: Boolean(data.user.is_admin),
          contact_number: data.user.contact_number || '',
        },
        authToken: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Store token for future requests
      await SecureStore.setItemAsync('authToken', data.token);

      return { error: null };
    } catch (error: any) {
      const message = error.name === 'AbortError' ? 'Request timed out' : error.message || 'Network error';
      console.log('Login error:', message, error);
      set({ isLoading: false });
      return { error: message };
    }
  },

  signUp: async (email, password, name, contactNumber) => {
    set({ isLoading: true });
    
    try {
      const base = await resolveApiBaseUrl();
      console.log(`Attempting signup to ${base}/api/register`);
      const response = await fetchWithTimeout(`${base}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, contact_number: contactNumber }),
      }, 10000);

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Signup failed' };
      }

      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.log('Signup error:', error.message);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync('authToken');
    set({ user: null, authToken: null, isAuthenticated: false });
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
  // demoLogin removed
}));
