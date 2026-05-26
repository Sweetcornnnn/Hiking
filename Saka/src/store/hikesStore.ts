import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { Hike } from '../types';
import { API_BASE_URL } from '../config/api';

interface HikesState {
  hikes: Hike[];
  allHikes: Hike[]; // For admin view
  adminStats: { total_hikes: number; total_users: number } | null; // Admin statistics
  isLoading: boolean;
  
  
  // Actions
  fetchHikes: () => Promise<void>;
  fetchAllHikes: () => Promise<void>; // Admin only
  fetchAdminStats: () => Promise<void>; // Admin only
  createHike: (hike: Omit<Hike, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateHike: (id: string, hike: Partial<Hike>) => Promise<{ error: string | null }>;
  deleteHike: (id: string) => Promise<{ error: string | null }>;
  
}

export const useHikesStore = create<HikesState>((set, get) => ({
  hikes: [],
  allHikes: [],
  adminStats: null,
  isLoading: false,
  

  fetchHikes: async () => {
    set({ isLoading: true });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ isLoading: false });
      return;
    }

    const { data, error } = await supabase
      .from('hikes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: true });

    if (!error && data) {
      set({ hikes: data });
    }
    
    set({ isLoading: false });
  },

  fetchAllHikes: async () => {
    set({ isLoading: true });
    
    try {
      const authState = useAuthStore.getState();
      let token = authState.authToken;
      if (!token) {
        token = await SecureStore.getItemAsync('authToken');
      }
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/hikes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch hikes:', data.error);
        set({ isLoading: false });
        return;
      }

      set({ allHikes: data.hikes });
    } catch (error) {
      console.error('Network error fetching hikes:', error);
    }
    
    set({ isLoading: false });
  },

  fetchAdminStats: async () => {
    try {
      const authState = useAuthStore.getState();
      let token = authState.authToken;
      if (!token) {
        token = await SecureStore.getItemAsync('authToken');
      }
      if (!token) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch admin stats:', data.error);
        return;
      }

      set({ adminStats: data });
    } catch (error) {
      console.error('Network error fetching admin stats:', error);
    }
  },

  createHike: async (hikeData) => {
    set({ isLoading: true });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ isLoading: false });
      return { error: 'Not authenticated' };
    }

    const { error } = await supabase.from('hikes').insert([
      {
        ...hikeData,
        user_id: session.user.id,
      },
    ]);

    if (!error) {
      await get().fetchHikes();
    }

    set({ isLoading: false });
    return { error: error?.message || null };
  },

  updateHike: async (id, hikeData) => {
    set({ isLoading: true });
    
    const { error } = await supabase
      .from('hikes')
      .update(hikeData)
      .eq('id', id);

    if (!error) {
      await get().fetchHikes();
    }

    set({ isLoading: false });
    return { error: error?.message || null };
  },

  deleteHike: async (id) => {
    set({ isLoading: true });
    
    const { error } = await supabase
      .from('hikes')
      .delete()
      .eq('id', id);

    if (!error) {
      await get().fetchHikes();
    }

    set({ isLoading: false });
    return { error: error?.message || null };
  },

  // demo mode removed
}));
