import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { Hike } from '../types';
import { supabase } from '../lib/supabase';
import { hikeSafetyService } from '../services/hikeSafetyService';
import { cancelCheck, scheduleCheck } from '../services/hikeSafetyNotifications';
import { isISODate } from '../utils/dateRange';

interface HikesState {
  hikes: Hike[];
  mountainHikes: Hike[];
  allHikes: Hike[];
  adminStats: { total_hikes: number; total_users: number } | null;
  isLoading: boolean;
  latestFetchToken: number;

  fetchHikes: (mountainId?: string) => Promise<void>;
  fetchMountainHikes: (mountainId?: string) => Promise<void>;
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

function plannedFinishFromHike(
  date: string,
  endTime: string,
  endDate?: string | null,
): Date | null {
  if (!isISODate(date)) return null;
  let finishDate = date;
  if (endDate) {
    if (!isISODate(endDate) || endDate < date) return null;
    finishDate = endDate;
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(finishDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(endTime);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const planned = new Date(`${finishDate}T${hour}:${minute}:00`);
  if (Number.isNaN(planned.getTime())) return null;

  if (
    planned.getFullYear() !== Number(year) ||
    planned.getMonth() !== Number(month) - 1 ||
    planned.getDate() !== Number(day) ||
    planned.getHours() !== Number(hour) ||
    planned.getMinutes() !== Number(minute)
  ) {
    return null;
  }

  return planned;
}

async function syncHikeSafetyCheck(args: {
  hikeId: string;
  userId: string;
  date: string;
  endTime: string;
  endDate?: string | null;
}): Promise<void> {
  try {
    const plannedFinishAt = plannedFinishFromHike(args.date, args.endTime, args.endDate);
    if (!plannedFinishAt) {
      const { data: check, error } = await supabase
        .from('hike_safety_checks')
        .select('id')
        .eq('hike_id', args.hikeId)
        .maybeSingle();

      if (error) {
        console.warn('[HikesStore] Could not look up invalid hike safety check:', error.message);
        return;
      }

      if (check?.id) await cancelCheck(check.id);
      await hikeSafetyService.deleteHikeCheck(args.hikeId);
      return;
    }

    const { checkId, error } = await hikeSafetyService.upsertHikeCheck({
      hikeId: args.hikeId,
      userId: args.userId,
      plannedFinishAt,
    });

    if (error || !checkId) {
      console.warn('[HikesStore] Could not save hike safety check:', error);
      return;
    }

    await cancelCheck(checkId);
    await scheduleCheck({ checkId, kind: 'hike', plannedFinishAt });
  } catch (error) {
    console.warn('[HikesStore] Could not synchronize hike safety check:', error);
  }
}

export const useHikesStore = create<HikesState>((set, get) => ({
  hikes: [],
  mountainHikes: [],
  allHikes: [],
  adminStats: null,
  isLoading: false,
  latestFetchToken: 0,

  fetchHikes: async (mountainId?: string) => {
    const fetchToken = Date.now() + Math.random();
    set({ isLoading: true, latestFetchToken: fetchToken, hikes: [] });

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        set({ hikes: [], isLoading: false });
        return;
      }

      let query = supabase
        .from('hikes')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (mountainId) {
        query = query.eq('mountain_id', mountainId);
      }

      const { data, error } = await query;

      if (get().latestFetchToken !== fetchToken) {
        return;
      }

      if (error) {
        console.error('[HikesStore] fetchHikes error:', error);
        set({ hikes: [], isLoading: false });
        return;
      }

      set({
        hikes: (data || []) as Hike[],
      });
    } catch (error: any) {
      if (get().latestFetchToken !== fetchToken) {
        return;
      }

      console.error('[HikesStore] Network error fetching hikes:', error);
      set({ hikes: [] });
    }

    if (get().latestFetchToken === fetchToken) {
      set({ isLoading: false });
    }
  },

  fetchMountainHikes: async (mountainId?: string) => {
    if (!mountainId) {
      set({ mountainHikes: [] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hikes')
        .select('*')
        .eq('mountain_id', mountainId)
        .order('date', { ascending: true });

      if (error) {
        console.error('[HikesStore] fetchMountainHikes error:', error);
        set({ mountainHikes: [] });
        return;
      }

      set({ mountainHikes: (data || []) as Hike[] });
    } catch (error: any) {
      console.error('[HikesStore] Network error fetching mountain hikes:', error);
      set({ mountainHikes: [] });
    }
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

      const { data: inserted, error } = await supabase
        .from('hikes')
        .insert({
          ...hikeData,
          user_id: userId,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[HikesStore] createHike error:', error);
        set({ isLoading: false });
        return { error: error.message || 'Failed to create hike' };
      }

      await syncHikeSafetyCheck({
        hikeId: inserted.id,
        userId,
        date: hikeData.date,
        endTime: hikeData.end_time,
        endDate: hikeData.end_date,
      });

      const mountainId = hikeData.mountain_id;
      await get().fetchHikes(mountainId);
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

      let existingHike = get().hikes.find((hike) => hike.id === id);
      if (!existingHike) {
        const { data, error: lookupError } = await supabase
          .from('hikes')
          .select('date, end_date, end_time, mountain_id')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle();

        if (lookupError) {
          console.warn('[HikesStore] Could not load hike before update:', lookupError.message);
        } else if (data) {
          existingHike = { ...data, id } as Hike;
        }
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

      const nextDate = hikeData.date ?? existingHike?.date;
      const nextEndDate =
        hikeData.end_date !== undefined ? hikeData.end_date : existingHike?.end_date ?? null;
      const nextEndTime = hikeData.end_time ?? existingHike?.end_time;
      const finishChanged =
        !existingHike ||
        nextDate !== existingHike.date ||
        (nextEndDate ?? null) !== (existingHike.end_date ?? null) ||
        nextEndTime !== existingHike.end_time;

      if (finishChanged && nextDate && nextEndTime) {
        await syncHikeSafetyCheck({
          hikeId: id,
          userId,
          date: nextDate,
          endTime: nextEndTime,
          endDate: nextEndDate,
        });
      }

      const mountainId = hikeData.mountain_id ?? existingHike?.mountain_id;
      await get().fetchHikes(mountainId);
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

      const { data: safetyCheck, error: safetyCheckError } = await supabase
        .from('hike_safety_checks')
        .select('id')
        .eq('hike_id', id)
        .maybeSingle();

      if (safetyCheckError) {
        console.warn('[HikesStore] Could not load hike safety check before delete:', safetyCheckError.message);
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

      if (safetyCheck?.id) await cancelCheck(safetyCheck.id);
      await hikeSafetyService.deleteHikeCheck(id);

      const mountainId = get().hikes.find((hike) => hike.id === id)?.mountain_id;
      await get().fetchHikes(mountainId);
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[HikesStore] deleteHike failed:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },
}));