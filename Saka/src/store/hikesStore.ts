import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Hike {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  tagalongs: number;
  contact_number: string;
  emergency_contact: string;
  created_at: string;
}

interface HikesState {
  hikes: Hike[];
  allHikes: Hike[]; // For admin view
  isLoading: boolean;
  isDemoMode: boolean;
  demoHikes: Hike[]; // Local storage for demo mode
  
  // Actions
  fetchHikes: () => Promise<void>;
  fetchAllHikes: () => Promise<void>; // Admin only
  createHike: (hike: Omit<Hike, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateHike: (id: string, hike: Partial<Hike>) => Promise<{ error: string | null }>;
  deleteHike: (id: string) => Promise<{ error: string | null }>;
  setDemoMode: (enabled: boolean) => void;
}

export const useHikesStore = create<HikesState>((set, get) => ({
  hikes: [],
  allHikes: [],
  isLoading: false,
  isDemoMode: false,
  demoHikes: [],

  fetchHikes: async () => {
    set({ isLoading: true });
    
    // Check if in demo mode
    const authState = useAuthStore.getState();
    if (authState.isDemoMode) {
      set({ hikes: get().demoHikes });
      set({ isLoading: false });
      return;
    }
    
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
    
    // Check if in demo mode
    const authState = useAuthStore.getState();
    if (authState.isDemoMode) {
      // In demo mode, show all demo hikes
      set({ allHikes: get().demoHikes });
      set({ isLoading: false });
      return;
    }
    
    const { data, error } = await supabase
      .from('hikes')
      .select('*, profiles(email, name)')
      .order('date', { ascending: true });

    if (!error && data) {
      set({ allHikes: data });
    }
    
    set({ isLoading: false });
  },

  createHike: async (hikeData) => {
    set({ isLoading: true });

    // Check if in demo mode
    const authState = useAuthStore.getState();
    if (authState.isDemoMode) {
      const newHike: Hike = {
        ...hikeData,
        id: 'demo-' + Date.now(),
        user_id: 'demo-user-123',
        created_at: new Date().toISOString(),
      };
      const updatedHikes = [...get().demoHikes, newHike];
      set({ demoHikes: updatedHikes, hikes: updatedHikes });
      set({ isLoading: false });
      return { error: null };
    }

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

    // Check if in demo mode
    const authState = useAuthStore.getState();
    if (authState.isDemoMode) {
      const updatedHikes = get().demoHikes.map(h => 
        h.id === id ? { ...h, ...hikeData } : h
      );
      set({ demoHikes: updatedHikes, hikes: updatedHikes });
      set({ isLoading: false });
      return { error: null };
    }

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

    // Check if in demo mode
    const authState = useAuthStore.getState();
    if (authState.isDemoMode) {
      const updatedHikes = get().demoHikes.filter(h => h.id !== id);
      set({ demoHikes: updatedHikes, hikes: updatedHikes });
      set({ isLoading: false });
      return { error: null };
    }

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

  setDemoMode: (enabled) => {
    set({ isDemoMode: enabled });
  },
}));
