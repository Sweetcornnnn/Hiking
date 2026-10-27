import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Viewpoint } from '../utils/geoUtils';

let cachedMountains: Mountain[] = [];
const MOUNTAINS_CACHE_KEY = 'SAKA_MOUNTAINS_CACHE';
const MOUNTAINS_CACHE_UPDATED_KEY = 'SAKA_MOUNTAINS_CACHE_UPDATED_AT';
let mountainsLastUpdatedAt: string | null = null;
const mountainCacheListeners = new Set<(mountains: Mountain[], updatedAt: string | null) => void>();

export interface Mountain {
  id: string;
  name: string;
  location: string;
  description: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Expert';
  elevation: number;          // numeric in meters
  latitude: number;
  longitude: number;
  image_url: string | null;
  video_url: string | null;
  funny_warning: string | null;
  elevationDisplay: string;
  viewpoints: Viewpoint[] | null;  // <-- add this
}

// ─────────────────────────────────────────────────────────────
// Canonical mountain ordering
//
// The order the Home carousel should always render in. Keys are
// matched against a normalized form of the mountain name (lowercased,
// alphanumeric only). Unknown mountains fall to the end, alphabetical.
//
// NOTE: 'mtm' will match any name whose normalized form *starts with*
// "mtm" (e.g. "Mt. M..."). If you later add a second mountain that
// also starts with "M", tighten this to the full normalized name.
// ─────────────────────────────────────────────────────────────
const MOUNTAIN_ORDER = [
  'mtmadjaas',
  'mtnangtud',
  'mtm',
  'mtbalinsayaw',
  'pandanhills',
] as const;

const normalizeMountainName = (name: string): string =>
  (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getMountainRank = (name: string): number => {
  const normalized = normalizeMountainName(name);
  // Exact match first (safer once you have multiple "Mt. M..." mountains)
  const exactIndex = (MOUNTAIN_ORDER as readonly string[]).indexOf(normalized);
  if (exactIndex !== -1) return exactIndex;
  // Then prefix match (lets "Mt. Madjaas" match key "mtmadjaas" style entries)
  for (let i = 0; i < MOUNTAIN_ORDER.length; i++) {
    if (normalized.startsWith(MOUNTAIN_ORDER[i])) return i;
  }
  return MOUNTAIN_ORDER.length; // unknown → after known
};

export const sortMountains = (list: Mountain[]): Mountain[] => {
  return [...list].sort((a, b) => {
    const rankDiff = getMountainRank(a.name) - getMountainRank(b.name);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
};

/**
 * Safely format an elevation value. Supabase can return `null` for
 * `elevation`, and calling `.toLocaleString()` on `null` throws
 * "Cannot read property 'toLocaleString' of null".
 */
const formatElevation = (meters: number | null | undefined): string => {
  if (meters == null || !Number.isFinite(Number(meters))) {
    return '—';
  }
  return `${Number(meters).toLocaleString()} m`;
};

/**
 * Coerce a possibly-null numeric column into a number (or a safe default).
 */
const toNumberOr = (
  value: number | string | null | undefined,
  fallback = 0
): number => {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const mountainService = {
  subscribeToCache(listener: (mountains: Mountain[], updatedAt: string | null) => void): () => void {
    mountainCacheListeners.add(listener);
    return () => mountainCacheListeners.delete(listener);
  },

  setCachedMountains(mountains: Mountain[]) {
    cachedMountains = sortMountains(mountains);   // <-- enforce order at the single source of truth
    mountainsLastUpdatedAt = new Date().toISOString();
    for (const listener of mountainCacheListeners) {
      try {
        listener(cachedMountains, mountainsLastUpdatedAt);
      } catch (error) {
        console.warn('[MountainService] Cache listener failed:', error);
      }
    }
    void Promise.all([
      AsyncStorage.setItem(MOUNTAINS_CACHE_KEY, JSON.stringify(cachedMountains)),
      AsyncStorage.setItem(MOUNTAINS_CACHE_UPDATED_KEY, mountainsLastUpdatedAt),
    ]).catch((error) => {
      console.warn('[MountainService] Failed to persist mountain cache:', error);
    });
  },

  getCachedMountains(): Mountain[] {
    return cachedMountains;   // already sorted — cachedMountains is only assigned via sortMountains
  },

  getCachedMountainById(id: string): Mountain | null {
    return cachedMountains.find((mountain) => mountain.id === id) ?? null;
  },

  getMountainsLastUpdatedAt(): string | null {
    return mountainsLastUpdatedAt;
  },

  async fetchMountains(forceRefresh = false): Promise<Mountain[]> {
    if (!forceRefresh && cachedMountains.length > 0) {
      return cachedMountains;
    }

    try {
      const cachedJson = await AsyncStorage.getItem(MOUNTAINS_CACHE_KEY);
      if (cachedJson) {
        const persistedMountains = JSON.parse(cachedJson) as Mountain[];
        if (Array.isArray(persistedMountains) && persistedMountains.length > 0) {
          // Sort persisted data too, so old caches written before this
          // fix still come out in the canonical order.
          cachedMountains = sortMountains(persistedMountains);
          mountainsLastUpdatedAt = await AsyncStorage.getItem(MOUNTAINS_CACHE_UPDATED_KEY);
          for (const listener of mountainCacheListeners) {
            try {
              listener(cachedMountains, mountainsLastUpdatedAt);
            } catch (error) {
              console.warn('[MountainService] Cache listener failed:', error);
            }
          }
          if (!forceRefresh) {
            return cachedMountains;
          }
        }
      }
    } catch (error) {
      console.warn('[MountainService] Failed to load persisted mountain cache:', error);
    }

    const { data, error } = await supabase
      .from('mountains')
      .select('*');
      // Note: DB-side ordering is now irrelevant — sortMountains() decides the order.
      // You can keep `.order(...)` here if you like; it just won't be what the UI sees.

    if (error) {
      console.error('Error fetching mountains:', error);
      if (cachedMountains.length > 0) {
        return cachedMountains;
      }
      throw new Error('Failed to load mountains');
    }

    const mountains = (data || []).map((item: any) => {
      const elevation = toNumberOr(item.elevation, 0);
      return {
        id: item.id,
        name: item.name,
        location: item.location || '',
        description: item.description || '',
        difficulty: item.difficulty as Mountain['difficulty'],
        elevation,
        latitude: toNumberOr(item.latitude, 0),
        longitude: toNumberOr(item.longitude, 0),
        image_url: item.image_url,
        video_url: item.video_url,
        funny_warning: item.funny_warning || null,
        elevationDisplay: formatElevation(item.elevation),
        viewpoints: item.viewpoints || null,  // <-- add this
      };
    });

    this.setCachedMountains(mountains);   // sorts + emits + persists
    return sortMountains(mountains);      // return sorted copy to caller too
  },

  async fetchMountainById(id: string): Promise<Mountain | null> {
    const cachedMountain = this.getCachedMountainById(id);
    if (cachedMountain) {
      void this.refreshMountainById(id).catch((error) => {
        console.warn('[MountainService] Background mountain refresh failed:', error);
      });
      return cachedMountain;
    }

    try {
      const cachedJson = await AsyncStorage.getItem(MOUNTAINS_CACHE_KEY);
      if (cachedJson) {
        const persistedMountains = JSON.parse(cachedJson) as Mountain[];
        if (Array.isArray(persistedMountains)) {
          cachedMountains = sortMountains(persistedMountains);
          mountainsLastUpdatedAt = await AsyncStorage.getItem(MOUNTAINS_CACHE_UPDATED_KEY);
          const persistedMountain = this.getCachedMountainById(id);
          if (persistedMountain) {
            void this.refreshMountainById(id).catch((error) => {
              console.warn('[MountainService] Background mountain refresh failed:', error);
            });
            return persistedMountain;
          }
        }
      }
    } catch (cacheError) {
      console.warn('[MountainService] Failed to read persisted mountain cache:', cacheError);
    }

    return this.refreshMountainById(id);
  },

  async refreshMountainById(id: string): Promise<Mountain | null> {
    const { data, error } = await supabase
      .from('mountains')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching mountain by id:', error);
      return this.getCachedMountainById(id);
    }

    if (!data) return null;

    const mountain: Mountain = {
      id: data.id,
      name: data.name,
      location: data.location || '',
      description: data.description || '',
      difficulty: data.difficulty as Mountain['difficulty'],
      elevation: toNumberOr(data.elevation, 0),
      latitude: toNumberOr(data.latitude, 0),
      longitude: toNumberOr(data.longitude, 0),
      image_url: data.image_url,
      video_url: data.video_url,
      funny_warning: data.funny_warning || null,
      elevationDisplay: formatElevation(data.elevation),
      viewpoints: data.viewpoints || null,  // <-- add this
    };
    // setCachedMountains() re-sorts, so merging here doesn't disturb order.
    this.setCachedMountains([
      ...cachedMountains.filter((item) => item.id !== mountain.id),
      mountain,
    ]);
    return mountain;
  }
};