import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WildTrackAPI } from '../services/wildtrackApi';
import { wildTrackSupabase } from '../services/wildtrackSupabase';

export interface Species {
  id: number;
  scientific_name: string;
  common_name: string;
  category: string;
  conservation_status?: string;
  gbif_id?: number;
  inaturalist_id?: number;
  image_url?: string;
  description?: string;
  habitat?: string;
  fun_facts?: string;
  is_endemic?: boolean;
  mountain_id?: string;
  discovered?: boolean;
}

export interface Discovery {
  id: number;
  user_id: number;
  species_id: number;
  mountain_id: string;
  discovered_at: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  scientific_name?: string;
  common_name?: string;
  category?: string;
  image_url?: string;
  conservation_status?: string;
}

export interface WildTrackStats {
  discovered_count: number;
  total_species: number;
  percentage: number;
  by_category: { category: string; count: number }[];
}

export interface MountainBiodiversity {
  id: string;
  name: string;
  curated_species_count: number;
  description: string;
  endemic_species_count: number;
  key_species: string;
  ecosystem: string;
  conservation_status: string;
}

interface WildTrackState {
  species: Species[];
  discoveries: Discovery[];
  featuredSpecies: Species[];
  mountainSpecies: Species[];
  stats: WildTrackStats | null;
  mountainBiodiversity: MountainBiodiversity | null;
  selectedMountainId: string;
  isLoading: boolean;
  isDemoMode: boolean;
  
  setSelectedMountainId: (id: string) => void;
  fetchSpecies: (mountainId?: string, category?: string) => Promise<void>;
  fetchSpeciesById: (id: number) => Promise<Species | null>;
  fetchDiscoveries: (mountainId?: string, category?: string) => Promise<void>;
  createDiscovery: (speciesId: number, mountainId: string, latitude?: number, longitude?: number, notes?: string) => Promise<{ error: string | null }>;
  removeDiscovery: (discoveryId: number) => Promise<{ error: string | null }>;
  fetchFeaturedSpecies: (mountainId?: string) => Promise<void>;
  fetchMountainSpecies: (mountainId: string) => Promise<void>;
  fetchStats: (mountainId?: string) => Promise<void>;
  fetchMountainBiodiversity: (mountainId: string) => Promise<void>;
  setDemoMode: (enabled: boolean) => void;
  cacheSpecies: (species: Species) => Promise<void>;
  getCachedSpecies: (speciesId: number) => Promise<Species | null>;
  cacheMountainChecklist: (mountainId: string, speciesList: any[]) => Promise<void>;
  getCachedMountainChecklist: (mountainId: string) => Promise<any[] | null>;
}

const CACHE_KEY_PREFIX = 'wildtrack_species_cache_';
const DISCOVERIES_CACHE_KEY = 'wildtrack_discoveries_cache';

export const useWildTrackStore = create<WildTrackState>((set, get) => ({
  species: [],
  discoveries: [],
  featuredSpecies: [],
  mountainSpecies: [],
  stats: null,
  mountainBiodiversity: null,
  selectedMountainId: '',
  isLoading: false,
  isDemoMode: false,

  setSelectedMountainId: (id) => {
    if (get().selectedMountainId === id) {
      return;
    }

    set({ selectedMountainId: id });
  },

  fetchSpecies: async (mountainId, category) => {
    set({ isLoading: true });

    try {
      if (get().isDemoMode) return;
      set({ species: await wildTrackSupabase.fetchSpecies(mountainId, category) });
    } catch (error) {
      console.error('Network error fetching species:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSpeciesById: async (id) => {
    try {
      if (get().isDemoMode) {
        const cached = await get().getCachedSpecies(id);
        return cached;
      }

      const species = await wildTrackSupabase.fetchSpeciesById(id);
      if (species) await get().cacheSpecies(species);
      return species;
    } catch (error) {
      console.error('Network error fetching species:', error);
      return null;
    }
  },

  fetchDiscoveries: async (mountainId, category) => {
    set({ isLoading: true });

    try {
      if (get().isDemoMode) {
        const cached = await AsyncStorage.getItem(DISCOVERIES_CACHE_KEY);
        if (cached) {
          const allDiscoveries = JSON.parse(cached);
          const filtered = mountainId 
            ? allDiscoveries.filter((d: Discovery) => d.mountain_id === mountainId)
            : allDiscoveries;
          set({ discoveries: filtered });
        } else {
          set({ discoveries: [] });
        }
        set({ isLoading: false });
        return;
      }
      set({ discoveries: await wildTrackSupabase.fetchDiscoveries(mountainId, category) });
    } catch (error) {
      console.error('Network error fetching discoveries:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createDiscovery: async (speciesId, mountainId, latitude, longitude, notes) => {
    set({ isLoading: true });

    const authState = get();
    if (authState.isDemoMode) {
      try {
        const cached = await AsyncStorage.getItem(DISCOVERIES_CACHE_KEY);
        const allDiscoveries = cached ? JSON.parse(cached) : [];
        
        const existing = allDiscoveries.find(
          (d: Discovery) => d.species_id === speciesId && d.mountain_id === mountainId
        );
        
        if (existing) {
          set({ isLoading: false });
          return { error: null };
        }
        
        const species = await get().getCachedSpecies(speciesId);
        
        const newDiscovery: Discovery = {
          id: Date.now(),
          user_id: 0,
          species_id: speciesId,
          mountain_id: mountainId,
          discovered_at: new Date().toISOString(),
          latitude,
          longitude,
          notes,
          scientific_name: species?.scientific_name,
          common_name: species?.common_name,
          category: species?.category,
          image_url: species?.image_url,
          conservation_status: species?.conservation_status,
        };
        
        allDiscoveries.push(newDiscovery);
        await AsyncStorage.setItem(DISCOVERIES_CACHE_KEY, JSON.stringify(allDiscoveries));
        
        await get().fetchDiscoveries(mountainId);
        
        set({ isLoading: false });
        return { error: null };
      } catch (error) {
        console.error('Error saving discovery locally:', error);
        set({ isLoading: false });
        return { error: 'Failed to save discovery' };
      }
    }

    try {
      const result = await wildTrackSupabase.createDiscovery(
        speciesId,
        mountainId,
        latitude,
        longitude,
        notes,
      );
      if (result.error) {
        set({ isLoading: false });
        return result;
      }

      await get().fetchDiscoveries(mountainId);
      await get().fetchStats(mountainId);

      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('Network error creating discovery:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  fetchFeaturedSpecies: async (mountainId) => {
    set({ isLoading: true });

    try {
      const species = await wildTrackSupabase.fetchMountainSpecies(mountainId || get().selectedMountainId);

      const speciesWithRealImages = await Promise.all(
        species.map(async (species: Species) => {
          let finalImageUrl: string | undefined;
          
          if (species.inaturalist_id || species.gbif_id) {
            try {
              const realImage = await WildTrackAPI.getSpeciesImage(
                species.inaturalist_id, 
                species.gbif_id, 
                species.scientific_name
              );
              if (realImage) {
                finalImageUrl = realImage;
              }
            } catch {
              // Ignore external image fetch failures and use the fallback image.
            }
          }
          
          if (!finalImageUrl) {
            finalImageUrl = WildTrackAPI.getDefaultSilhouette(species.category);
          }
          
          return { ...species, image_url: finalImageUrl };
        })
      );

      set({ featuredSpecies: speciesWithRealImages });
    } catch (error) {
      console.error('Network error fetching featured species:', error);
    }
    
    set({ isLoading: false });
  },

  fetchMountainSpecies: async (mountainId) => {
    set({ isLoading: true });

    try {
      const authState = get();

      const cachedChecklist = await get().getCachedMountainChecklist(mountainId);
      if (cachedChecklist && authState.isDemoMode) {
        set({ mountainSpecies: cachedChecklist, isLoading: false });
        return;
      }

      const species = await wildTrackSupabase.fetchMountainSpecies(mountainId);

      const speciesWithRealImages = await Promise.all(
        species.map(async (species: Species) => {
          let finalImageUrl: string | undefined;
          
          if (species.inaturalist_id || species.gbif_id) {
            try {
              const realImage = await WildTrackAPI.getSpeciesImage(
                species.inaturalist_id, 
                species.gbif_id, 
                species.scientific_name
              );
              if (realImage) {
                finalImageUrl = realImage;
              }
            } catch {
              // Ignore external image fetch failures and use the fallback image.
            }
          }
          
          if (!finalImageUrl) {
            finalImageUrl = WildTrackAPI.getDefaultSilhouette(species.category);
          }
          
          return { ...species, image_url: finalImageUrl };
        })
      );

      await get().cacheMountainChecklist(mountainId, speciesWithRealImages);

      set({ mountainSpecies: speciesWithRealImages });
    } catch (error) {
      console.error('Network error fetching mountain species:', error);
      
      const cachedChecklist = await get().getCachedMountainChecklist(mountainId);
      if (cachedChecklist) {
        set({ mountainSpecies: cachedChecklist });
      }
    }
    
    set({ isLoading: false });
  },

  fetchStats: async (mountainId) => {
    try {
      if (get().isDemoMode) return;
      set({ stats: await wildTrackSupabase.fetchStats(mountainId) });
    } catch (error) {
      console.error('Network error fetching stats:', error);
    }
  },

  setDemoMode: (enabled) => {
    set({ isDemoMode: enabled });
  },

  cacheSpecies: async (species) => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${species.id}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: species,
        cachedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error caching species:', error);
    }
  },

  getCachedSpecies: async (speciesId) => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${speciesId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, cachedAt } = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('[WildTrack] Error getting cached species:', error);
      return null;
    }
  },

  removeDiscovery: async (discoveryId) => {
    set({ isLoading: true });

    const authState = get();
    if (authState.isDemoMode) {
      try {
        const cached = await AsyncStorage.getItem(DISCOVERIES_CACHE_KEY);
        if (cached) {
          const allDiscoveries = JSON.parse(cached);
          const filtered = allDiscoveries.filter((d: Discovery) => d.id !== discoveryId);
          await AsyncStorage.setItem(DISCOVERIES_CACHE_KEY, JSON.stringify(filtered));
          
          await get().fetchDiscoveries(authState.selectedMountainId);
          await get().fetchStats(authState.selectedMountainId);
          
          set({ isLoading: false });
          return { error: null };
        }
        set({ isLoading: false });
        return { error: 'Discovery not found' };
      } catch (error) {
        console.error('[WildTrack] Error removing discovery locally:', error);
        set({ isLoading: false });
        return { error: 'Failed to remove discovery' };
      }
    }

    try {
      const result = await wildTrackSupabase.removeDiscovery(discoveryId);
      if (result.error) {
        set({ isLoading: false });
        return result;
      }

      await get().fetchDiscoveries(authState.selectedMountainId);
      await get().fetchStats(authState.selectedMountainId);

      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[WildTrack] Network error removing discovery:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  fetchMountainBiodiversity: async (mountainId) => {
    try {
      const info = await wildTrackSupabase.fetchMountainBiodiversity(mountainId);
      if (info) {
        set({ mountainBiodiversity: info });
      }
    } catch (error) {
      console.error('[WildTrack] Network error fetching mountain biodiversity:', error);
    }
  },

  cacheMountainChecklist: async (mountainId, speciesList) => {
    try {
      const cacheKey = `wildtrack_mountain_checklist_${mountainId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        species_list: speciesList,
        cached_at: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[WildTrack] Error caching mountain checklist:', error);
    }
  },

  getCachedMountainChecklist: async (mountainId) => {
    try {
      const cacheKey = `wildtrack_mountain_checklist_${mountainId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { species_list, cached_at } = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(cached_at).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          return species_list;
        }
      }
      return null;
    } catch (error) {
      console.error('[WildTrack] Error getting cached mountain checklist:', error);
      return null;
    }
  },
}));
