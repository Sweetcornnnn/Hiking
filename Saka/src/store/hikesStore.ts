import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './authStore';
import { Hike } from '../types';
import { API_BASE_URL, resolveApiBaseUrl } from '../config/api';

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const getAuthToken = async (): Promise<string | null> => {
  const authState = useAuthStore.getState();
  if (authState.authToken) return authState.authToken;
  return await SecureStore.getItemAsync('authToken');
};

const getBaseUrl = async (): Promise<string> => {
  return await resolveApiBaseUrl();
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const parseJsonSafe = async (response: Response) => {
  const text = await response.clone().text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON response: ${text}`);
  }
};

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

    try {
      const headers = await getAuthHeaders();
      const base = await getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/hikes`, {
        method: 'GET',
        headers,
      });
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        console.error('Failed to fetch hikes:', data.error || data);
        set({ isLoading: false });
        return;
      }

      set({ hikes: data.hikes || [] });
    } catch (error) {
      console.error('Network error fetching hikes:', error);
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

      const response = await fetch(`${await getBaseUrl()}/api/admin/hikes`, {
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

      const response = await fetch(`${await getBaseUrl()}/api/admin/stats`, {
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

    try {
      const headers = await getAuthHeaders();
      const base = await getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/hikes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(hikeData),
      });
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Failed to create hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('Network error creating hike:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  updateHike: async (id, hikeData) => {
    set({ isLoading: true });

    try {
      const headers = await getAuthHeaders();
      const base = await getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/hikes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(hikeData),
      });
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Failed to update hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('Network error updating hike:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  deleteHike: async (id) => {
    set({ isLoading: true });

    try {
      const headers = await getAuthHeaders();
      const base = await getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/hikes/${id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Failed to delete hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('Network error deleting hike:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  // demo mode removed
}));
