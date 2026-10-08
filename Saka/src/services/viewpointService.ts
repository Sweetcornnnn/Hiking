import { supabase } from '../lib/supabase';
import { VIEWPOINTS_DATA, ViewpointsDataType } from '../data/viewpointsData';
import { MOUNTAINS_INFO } from '../data/mountains';

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

  const { data, error } = await supabase
    .from('viewpoints')
    .select('*')
    .eq('id', viewpointId)
    .maybeSingle();

  if (error) {
    console.warn('[viewpointService] Supabase query failed, using local fallback:', error.message);
    return fallbackViewpoint(viewpointId);
  }

  if (!data) {
    return fallbackViewpoint(viewpointId);
  }

  return {
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
