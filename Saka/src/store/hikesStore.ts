import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { Hike } from '../types';
import { supabase } from '../lib/supabase';

interface HikesState {
  hikes: Hike[];
  allHikes: Hike[];
  adminStats: { total_hikes: number; total_users: number } | null;
  isLoading: boolean;

  fetchHikes: () => Promise<void>;
  fetchAllHikes: () => Promise<void>;
  fetchAdminStats: () => Promise<void>;
  createHike: (
    hike: Omit<Hike, 'id' | 'user_id' | 'created_at'>
  ) => Promise<{ error: string | null }>;
  updateHike: (
    id: string,
    hike: Partial<Hike>
  ) => Promise<{ error: string | null }>;
  deleteHike: (id: string) => Promise<{ error: string | null }>;
}

const getCurrentUserId = async (): Promise<string | null> => {
  const { user, session } = useAuthStore.getState();

  if (user?.id) return user.id;
  if (session?.user?.id) return session.user.id;

  const {
    data: { user: freshUser },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.warn('[HikesStore] Could not resolve current user:', error.message);
    return null;
  }

  return freshUser?.id ?? null;
};

const mapUserShape = (userRow?: { email?: string | null; full_name?: string | null } | null) => {
  if (!userRow) return undefined;

  return {
    email: userRow.email || '',
    name: userRow.full_name || userRow.email || 'Unknown',
  };
};

export const useHikesStore = create<HikesState>((set, get) => ({
  hikes: [],
  allHikes: [],
  adminStats: null,
  isLoading: false,

  fetchHikes: async () => {
    set({ isLoading: true });

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        set({ hikes: [], isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('hikes')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) {
        console.error('[HikesStore] fetchHikes error:', error);
        set({ hikes: [], isLoading: false });
        return;
      }

      set({
        hikes: (data || []) as Hike[],
      });
    } catch (error: any) {
      console.error('[HikesStore] Network error fetching hikes:', error);
      set({ hikes: [] });
    }

    set({ isLoading: false });
  },

  fetchAllHikes: async () => {
    set({ isLoading: true });

    try {
      const { data: hikesData, error: hikesError } = await supabase
        .from('hikes')
        .select('*')
        .order('date', { ascending: false });

      if (hikesError) {
        console.error('[HikesStore] fetchAllHikes error:', hikesError);
        set({ allHikes: [], isLoading: false });
        return;
      }

      const userIds = [...new Set((hikesData || []).map((hike) => hike.user_id))];

      let profilesData: Array<{ id: string; email?: string | null; full_name?: string | null }> = [];

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (profileError) {
          console.warn('[HikesStore] Profiles lookup failed:', profileError.message);
        } else {
          profilesData = profileRows || [];
        }
      }

      const profileMap = new Map(
        profilesData.map((profile) => [
          profile.id,
          {
            email: profile.email || '',
            name: profile.full_name || profile.email || 'Unknown',
          },
        ])
      );

      const allHikes = (hikesData || []).map((hike) => ({
        ...hike,
        user: profileMap.get(hike.user_id) || {
          email: '',
          name: 'Unknown',
        },
      })) as Hike[];

      set({ allHikes });
    } catch (error: any) {
      console.error('[HikesStore] Network error fetching all hikes:', error);
      set({ allHikes: [] });
    }

    set({ isLoading: false });
  },

  fetchAdminStats: async () => {
    try {
      const [{ count: totalHikes }, { count: totalUsers }] = await Promise.all([
        supabase.from('hikes').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);

      set({
        adminStats: {
          total_hikes: totalHikes ?? 0,
          total_users: totalUsers ?? 0,
        },
      });
    } catch (error) {
      console.error('[HikesStore] Network error fetching admin stats:', error);
      set({ adminStats: { total_hikes: 0, total_users: 0 } });
    }
  },

  createHike: async (hikeData) => {
    set({ isLoading: true });

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        set({ isLoading: false });
        return { error: 'Please sign in to manage hikes' };
      }

      const { error } = await supabase.from('hikes').insert([
        {
          ...hikeData,
          user_id: userId,
        },
      ]);

      if (error) {
        console.error('[HikesStore] createHike error:', error);
        set({ isLoading: false });
        return { error: error.message || 'Failed to create hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[HikesStore] createHike failed:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  updateHike: async (id, hikeData) => {
    set({ isLoading: true });

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        set({ isLoading: false });
        return { error: 'Please sign in to manage hikes' };
      }

      const { error } = await supabase
        .from('hikes')
        .update(hikeData)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[HikesStore] updateHike error:', error);
        set({ isLoading: false });
        return { error: error.message || 'Failed to update hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[HikesStore] updateHike failed:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  deleteHike: async (id) => {
    set({ isLoading: true });

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        set({ isLoading: false });
        return { error: 'Please sign in to manage hikes' };
      }

      const { error } = await supabase
        .from('hikes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[HikesStore] deleteHike error:', error);
        set({ isLoading: false });
        return { error: error.message || 'Failed to delete hike' };
      }

      await get().fetchHikes();
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[HikesStore] deleteHike failed:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },
}));