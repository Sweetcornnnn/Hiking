import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VIEWPOINTS_DATA, ViewpointsDataType } from '../data/viewpointsData';
import { MOUNTAINS_INFO } from '../data/mountains';

const VIEWPOINT_CACHE_PREFIX = 'SAKA_VIEWPOINT_CACHE:';
const VIEWPOINT_CACHE_UPDATED_PREFIX = 'SAKA_VIEWPOINT_CACHE_UPDATED:';

export type ViewpointDetailRecord = {
  id: string;
  name: string;
  subtitle: string;
  elevation: string;
  imageKey: string;
  accentColor: string;
  distanceFromStart: string;
  estimatedHike: string;
  bestTime: string;
  description: string;
  tags: string[];
  features: Array<{
    icon: string;
    text: string;
    safe: boolean;
  }>;
  trailNotes?: string[];
  difficulty?: 'Easy' | 'Moderate' | 'Hard' | 'Expert';
  trailStatus?: string;
  crowdLevel?: string;
};

function fallbackViewpoint(viewpointId: string): ViewpointDetailRecord | null {
  const fallback = VIEWPOINTS_DATA[(viewpointId as keyof ViewpointsDataType)] ?? Object.values(VIEWPOINTS_DATA)[0];
  return fallback ?? null;
}

export async function fetchViewpointDetail(viewpointId: string): Promise<ViewpointDetailRecord | null> {
  if (!viewpointId) {
    return null;
  }

  const cacheKey = `${VIEWPOINT_CACHE_PREFIX}${viewpointId}`;
  try {
    const cachedJson = await AsyncStorage.getItem(cacheKey);
    if (cachedJson) {
      const cached = JSON.parse(cachedJson) as ViewpointDetailRecord;
      if (cached?.id === viewpointId) {
        void refreshViewpointDetail(viewpointId).catch((error) => {
          console.warn('[viewpointService] Background viewpoint refresh failed:', error);
        });
        return cached;
      }
    }
  } catch (cacheError) {
    console.warn('[viewpointService] Failed to read cached viewpoint:', cacheError);
  }

  return refreshViewpointDetail(viewpointId);
}

async function refreshViewpointDetail(viewpointId: string): Promise<ViewpointDetailRecord | null> {
  const request = supabase
    .from('viewpoints')
    .select('*')
    .eq('id', viewpointId)
    .maybeSingle();
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch (requestError) {
    console.warn('[viewpointService] Viewpoint request failed, using local fallback:', requestError);
    return fallbackViewpoint(viewpointId);
  }
  const { data, error } = result;

  if (error) {
    console.warn('[viewpointService] Supabase query failed, using local fallback:', error.message);
    return fallbackViewpoint(viewpointId);
  }

  if (!data) {
    return fallbackViewpoint(viewpointId);
  }

  const record: ViewpointDetailRecord = {
    id: data.id,
    name: data.name,
    subtitle: data.subtitle || '',
    elevation: data.elevation || '~0m',
    imageKey: data.image_key || 'trailhead',
    accentColor: data.accent_color || '#C9A96E',
    distanceFromStart: data.distance_from_start || '0 km',
    estimatedHike: data.estimated_hike || '0 hrs',
    bestTime: data.best_time || 'Any time',
    description: data.description || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    features: Array.isArray(data.features) ? data.features : [],
    trailNotes: Array.isArray(data.trail_notes) ? data.trail_notes : [],
    difficulty: data.difficulty || 'Moderate',
    trailStatus: data.trail_status || 'Open',
    crowdLevel: data.crowd_level || 'Low',
  };
  const cacheKey = `${VIEWPOINT_CACHE_PREFIX}${viewpointId}`;
  const updatedAtKey = `${VIEWPOINT_CACHE_UPDATED_PREFIX}${viewpointId}`;
  try {
    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(record)),
      AsyncStorage.setItem(updatedAtKey, new Date().toISOString()),
    ]);
  } catch (cacheError) {
    console.warn('[viewpointService] Failed to persist viewpoint:', cacheError);
  }
  return record;
}

export async function getViewpointCacheUpdatedAt(viewpointId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${VIEWPOINT_CACHE_UPDATED_PREFIX}${viewpointId}`);
  } catch (error) {
    console.warn('[viewpointService] Failed to read viewpoint cache timestamp:', error);
    return null;
  }
}

const normalizeMountainName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function fetchMeetingPoints(
  mountainId: string,
  mountainName?: string,
  mountainViewpoints?: Array<{ name: string }> | null
): Promise<string[]> {
  const { data, error } = await supabase
    .from('viewpoints')
    .select('name')
    .eq('mountain_id', mountainId)
    .order('name', { ascending: true });

  if (error) {
    console.warn('[viewpointService] Failed to load meeting points by mountain ID:', error.message);
  } else if (data?.length) {
    return data.map((point) => point.name);
  }

  const legacyMountain = mountainName
    ? MOUNTAINS_INFO.find(
        (mountain) => normalizeMountainName(mountain.name) === normalizeMountainName(mountainName)
      )
    : undefined;

  if (legacyMountain && legacyMountain.id !== mountainId) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('viewpoints')
      .select('name')
      .eq('mountain_id', legacyMountain.id)
      .order('name', { ascending: true });

    if (legacyError) {
      console.warn('[viewpointService] Failed to load meeting points by legacy ID:', legacyError.message);
    } else if (legacyData?.length) {
      return legacyData.map((point) => point.name);
    }
  }

  return [...new Set((mountainViewpoints ?? []).map((point) => point.name).filter(Boolean))];
}
