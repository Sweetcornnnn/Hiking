import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Viewpoint } from '../utils/geoUtils';

let cachedMountains: Mountain[] = [];
const MOUNTAINS_CACHE_KEY = 'SAKA_MOUNTAINS_CACHE';

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

const formatElevation = (meters: number): string => `${meters.toLocaleString()} m`;

export const mountainService = {
  setCachedMountains(mountains: Mountain[]) {
    cachedMountains = mountains;
    void AsyncStorage.setItem(MOUNTAINS_CACHE_KEY, JSON.stringify(mountains)).catch((error) => {
      console.warn('[MountainService] Failed to persist mountain cache:', error);
    });
  },

  getCachedMountains(): Mountain[] {
    return cachedMountains;
  },

  getCachedMountainById(id: string): Mountain | null {
    return cachedMountains.find((mountain) => mountain.id === id) ?? null;
  },

  async fetchMountains(): Promise<Mountain[]> {
    if (cachedMountains.length > 0) {
      return cachedMountains;
    }

    try {
      const cachedJson = await AsyncStorage.getItem(MOUNTAINS_CACHE_KEY);
      if (cachedJson) {
        const persistedMountains = JSON.parse(cachedJson) as Mountain[];
        if (Array.isArray(persistedMountains) && persistedMountains.length > 0) {
          cachedMountains = persistedMountains;
          return cachedMountains;
        }
      }
    } catch (error) {
      console.warn('[MountainService] Failed to load persisted mountain cache:', error);
    }

    const { data, error } = await supabase
      .from('mountains')
      .select('*')
      .order('elevation', { ascending: false });

    if (error) {
      console.error('Error fetching mountains:', error);
      throw new Error('Failed to load mountains');
    }

    const mountains = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      location: item.location || '',
      description: item.description || '',
      difficulty: item.difficulty as Mountain['difficulty'],
      elevation: item.elevation,
      latitude: item.latitude,
      longitude: item.longitude,
      image_url: item.image_url,
      video_url: item.video_url,
      funny_warning: item.funny_warning || null,
      elevationDisplay: formatElevation(item.elevation),
      viewpoints: item.viewpoints || null,  // <-- add this
    }));

    this.setCachedMountains(mountains);
    return mountains;
  },

  async fetchMountainById(id: string): Promise<Mountain | null> {
    const { data, error } = await supabase
      .from('mountains')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching mountain by id:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      location: data.location || '',
      description: data.description || '',
      difficulty: data.difficulty as Mountain['difficulty'],
      elevation: data.elevation,
      latitude: data.latitude,
      longitude: data.longitude,
      image_url: data.image_url,
      video_url: data.video_url,
      funny_warning: data.funny_warning || null,
      elevationDisplay: formatElevation(data.elevation),
      viewpoints: data.viewpoints || null,  // <-- add this
    };
  }
};