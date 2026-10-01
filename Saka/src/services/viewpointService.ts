import { supabase } from '../lib/supabase';
import { VIEWPOINTS_DATA, ViewpointsDataType } from '../data/viewpointsData';

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
