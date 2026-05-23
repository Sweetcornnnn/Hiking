import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { WildTrackAPI } from '../services/wildtrackApi';

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
  
  // Actions
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
  selectedMountainId: '1', // Default to Mt. Madjaas
  isLoading: false,
  isDemoMode: false,

  setSelectedMountainId: (id) => {
    console.log(`[WildTrack] Mountain changed to: ${id}`);
    set({ selectedMountainId: id });
  },

  fetchSpecies: async (mountainId, category) => {
    set({ isLoading: true });
    
    try {
      let token = await SecureStore.getItemAsync('authToken');
      const authState = get();
      
      if (authState.isDemoMode) {
        // In demo mode, use cached or mock data
        set({ isLoading: false });
        return;
      }

      const queryParams = new URLSearchParams();
      if (mountainId) queryParams.append('mountain_id', mountainId);
      if (category) queryParams.append('category', category);

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/species?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch species:', data.error);
        set({ isLoading: false });
        return;
      }

      set({ species: data.species });
    } catch (error) {
      console.error('Network error fetching species:', error);
    }
    
    set({ isLoading: false });
  },

  fetchSpeciesById: async (id) => {
    try {
      let token = await SecureStore.getItemAsync('authToken');
      const authState = get();
      
      if (authState.isDemoMode) {
        // Try to get from cache in demo mode
        const cached = await get().getCachedSpecies(id);
        return cached;
      }

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/species/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch species:', data.error);
        return null;
      }

      // Cache the species data
      await get().cacheSpecies(data.species);
      
      return data.species;
    } catch (error) {
      console.error('Network error fetching species:', error);
      return null;
    }
  },

  fetchDiscoveries: async (mountainId, category) => {
    set({ isLoading: true });
    
    try {
      let token = await SecureStore.getItemAsync('authToken');
      const authState = get();
      
      if (authState.isDemoMode) {
        // Load from local storage in demo mode
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

      if (!token) {
        set({ isLoading: false });
        return;
      }

      const queryParams = new URLSearchParams();
      if (mountainId) queryParams.append('mountain_id', mountainId);
      if (category) queryParams.append('category', category);

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/discoveries?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch discoveries:', data.error);
        set({ isLoading: false });
        return;
      }

      set({ discoveries: data.discoveries });
    } catch (error) {
      console.error('Network error fetching discoveries:', error);
    }
    
    set({ isLoading: false });
  },

  createDiscovery: async (speciesId, mountainId, latitude, longitude, notes) => {
    set({ isLoading: true });

    const authState = get();
    if (authState.isDemoMode) {
      // In demo mode, save to local storage
      try {
        const cached = await AsyncStorage.getItem(DISCOVERIES_CACHE_KEY);
        const allDiscoveries = cached ? JSON.parse(cached) : [];
        
        // Check if already discovered
        const existing = allDiscoveries.find(
          (d: Discovery) => d.species_id === speciesId && d.mountain_id === mountainId
        );
        
        if (existing) {
          set({ isLoading: false });
          return { error: null };
        }
        
        // Get species details from cache
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
        
        // Refresh discoveries
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
      let token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        set({ isLoading: false });
        return { error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/discover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          species_id: speciesId,
          mountain_id: mountainId,
          latitude,
          longitude,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isLoading: false });
        return { error: data.error || 'Failed to create discovery' };
      }

      // Refresh discoveries after creating
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
      const queryParams = new URLSearchParams();
      if (mountainId) queryParams.append('mountain_id', mountainId);

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/featured?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch featured species:', data.error);
        set({ isLoading: false });
        return;
      }

      // Fetch real images from APIs for each species
      const speciesWithRealImages = await Promise.all(
        data.species.map(async (species: Species) => {
          let finalImageUrl: string | undefined;
          
          if (species.inaturalist_id || species.gbif_id) {
            try {
              const realImage = await WildTrackAPI.getSpeciesImage(
                species.inaturalist_id, 
                species.gbif_id, 
                species.scientific_name
              );
              if (realImage) {
                console.log(`[WildTrack] Successfully fetched image for ${species.common_name}`);
                finalImageUrl = realImage;
              }
            } catch (error) {
              console.log(`[WildTrack] Failed to fetch image for ${species.common_name}, using fallback`);
            }
          }
          
          // Use default silhouette if no real image was found
          if (!finalImageUrl) {
            finalImageUrl = WildTrackAPI.getDefaultSilhouette(species.category);
            console.log(`[WildTrack] Using silhouette for ${species.common_name}`);
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
      let token = await SecureStore.getItemAsync('authToken');
      const authState = get();
      
      // Try to get from cache first for offline support
      const cachedChecklist = await get().getCachedMountainChecklist(mountainId);
      if (cachedChecklist && authState.isDemoMode) {
        console.log(`[WildTrack] Using cached checklist for mountain: ${mountainId}`);
        set({ mountainSpecies: cachedChecklist, isLoading: false });
        return;
      }
      
      const queryParams = new URLSearchParams();
      if (token && !authState.isDemoMode) {
        queryParams.append('user_id', String(authState.isDemoMode ? 'demo' : token));
      }

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/mountain/${mountainId}?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch mountain species:', data.error);
        set({ isLoading: false });
        return;
      }

      // Fetch real images from APIs for each species
      const speciesWithRealImages = await Promise.all(
        data.species.map(async (species: Species) => {
          let finalImageUrl: string | undefined;
          
          if (species.inaturalist_id || species.gbif_id) {
            try {
              const realImage = await WildTrackAPI.getSpeciesImage(
                species.inaturalist_id, 
                species.gbif_id, 
                species.scientific_name
              );
              if (realImage) {
                console.log(`[WildTrack] Successfully fetched image for ${species.common_name}`);
                finalImageUrl = realImage;
              }
            } catch (error) {
              console.log(`[WildTrack] Failed to fetch image for ${species.common_name}, using fallback`);
            }
          }
          
          // Use default silhouette if no real image was found
          if (!finalImageUrl) {
            finalImageUrl = WildTrackAPI.getDefaultSilhouette(species.category);
            console.log(`[WildTrack] Using silhouette for ${species.common_name}`);
          }
          
          return { ...species, image_url: finalImageUrl };
        })
      );

      // Cache the checklist for offline access
      await get().cacheMountainChecklist(mountainId, speciesWithRealImages);

      set({ mountainSpecies: speciesWithRealImages });
    } catch (error) {
      console.error('Network error fetching mountain species:', error);
      
      // Try to use cached data as fallback
      const cachedChecklist = await get().getCachedMountainChecklist(mountainId);
      if (cachedChecklist) {
        console.log(`[WildTrack] Using cached checklist as fallback for mountain: ${mountainId}`);
        set({ mountainSpecies: cachedChecklist });
      }
    }
    
    set({ isLoading: false });
  },

  fetchStats: async (mountainId) => {
    try {
      let token = await SecureStore.getItemAsync('authToken');
      const authState = get();
      
      if (authState.isDemoMode) {
        set({ isLoading: false });
        return;
      }

      if (!token) {
        return;
      }

      const queryParams = new URLSearchParams();
      if (mountainId) queryParams.append('mountain_id', mountainId);

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/stats?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch stats:', data.error);
        return;
      }

      set({ stats: data });
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
        // Cache expires after 7 days
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`[WildTrack] Cache hit for species: ${speciesId}`);
          return data;
        }
      }
      console.log(`[WildTrack] Cache miss for species: ${speciesId}`);
      return null;
    } catch (error) {
      console.error('[WildTrack] Error getting cached species:', error);
      return null;
    }
  },

  removeDiscovery: async (discoveryId) => {
    set({ isLoading: true });
    console.log(`[WildTrack] Removing discovery: ${discoveryId}`);

    const authState = get();
    if (authState.isDemoMode) {
      // In demo mode, remove from local storage
      try {
        const cached = await AsyncStorage.getItem(DISCOVERIES_CACHE_KEY);
        if (cached) {
          const allDiscoveries = JSON.parse(cached);
          const filtered = allDiscoveries.filter((d: Discovery) => d.id !== discoveryId);
          await AsyncStorage.setItem(DISCOVERIES_CACHE_KEY, JSON.stringify(filtered));
          
          // Refresh discoveries
          await get().fetchDiscoveries(authState.selectedMountainId);
          await get().fetchStats(authState.selectedMountainId);
          
          console.log(`[WildTrack] Discovery removed in demo mode: ${discoveryId}`);
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
      let token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        set({ isLoading: false });
        return { error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/wildtrack/discovery/${discoveryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[WildTrack] Failed to remove discovery:', data.error);
        set({ isLoading: false });
        return { error: data.error || 'Failed to remove discovery' };
      }

      // Refresh discoveries and stats after removing
      await get().fetchDiscoveries(authState.selectedMountainId);
      await get().fetchStats(authState.selectedMountainId);

      console.log(`[WildTrack] Discovery removed successfully: ${discoveryId}`);
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      console.error('[WildTrack] Network error removing discovery:', error);
      set({ isLoading: false });
      return { error: error.message || 'Network error' };
    }
  },

  fetchMountainBiodiversity: async (mountainId) => {
    console.log(`[WildTrack] Fetching mountain biodiversity for: ${mountainId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/wildtrack/mountain-info/${mountainId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[WildTrack] Failed to fetch mountain biodiversity:', data.error);
        return;
      }

      console.log(`[WildTrack] Mountain biodiversity retrieved for ${data.info.name}`);
      set({ mountainBiodiversity: data.info });
    } catch (error) {
      console.error('[WildTrack] Network error fetching mountain biodiversity:', error);
    }
  },

  // Cache mountain species checklist for offline access
  cacheMountainChecklist: async (mountainId: string, speciesList: any[]) => {
    try {
      const cacheKey = `wildtrack_mountain_checklist_${mountainId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        species_list: speciesList,
        cached_at: new Date().toISOString(),
      }));
      console.log(`[WildTrack] Cached checklist for mountain: ${mountainId}`);
    } catch (error) {
      console.error('[WildTrack] Error caching mountain checklist:', error);
    }
  },

  // Get cached mountain species checklist
  getCachedMountainChecklist: async (mountainId: string) => {
    try {
      const cacheKey = `wildtrack_mountain_checklist_${mountainId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { species_list, cached_at } = JSON.parse(cached);
        // Cache expires after 7 days
        const cacheAge = Date.now() - new Date(cached_at).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`[WildTrack] Cache hit for mountain checklist: ${mountainId}`);
          return species_list;
        }
      }
      console.log(`[WildTrack] Cache miss for mountain checklist: ${mountainId}`);
      return null;
    } catch (error) {
      console.error('[WildTrack] Error getting cached mountain checklist:', error);
      return null;
    }
  },
}));
