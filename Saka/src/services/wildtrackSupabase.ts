import { supabase } from '../lib/supabase';
import type { Discovery, Species, WildTrackStats, MountainBiodiversity } from '../store/wildtrackStore';

const mapSpecies = (row: any, discovered = false): Species => ({
  id: Number(row.id),
  scientific_name: row.scientific_name,
  common_name: row.common_name,
  category: row.category,
  conservation_status: row.conservation_status || undefined,
  gbif_id: row.gbif_id || undefined,
  inaturalist_id: row.inaturalist_id || undefined,
  image_url: row.image_url || undefined,
  description: row.description || undefined,
  habitat: row.habitat || undefined,
  fun_facts: row.fun_facts || undefined,
  is_endemic: Boolean(row.is_endemic),
  mountain_id: row.mountain_id || undefined,
  discovered,
});

const getCurrentUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[WildTrackSupabase] Could not resolve current user:', error.message);
    return null;
  }
  return data.user?.id || null;
};

const loadMountainLinks = async (mountainId: string, endemicOnly = false) => {
  let query = supabase
    .from('wildtrack_mountain_species')
    .select('species_id, mountain_id, is_endemic')
    .eq('mountain_id', mountainId);

  if (endemicOnly) query = query.eq('is_endemic', true);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const loadSpeciesRows = async (speciesIds: number[]) => {
  if (speciesIds.length === 0) return [];

  const { data, error } = await supabase
    .from('wildtrack_species')
    .select('*')
    .in('id', speciesIds)
    .order('common_name', { ascending: true });

  if (error) throw error;
  return data || [];
};

const loadDiscoveredIds = async (mountainId: string, userId: string | null) => {
  if (!userId) return new Set<number>();

  const { data, error } = await supabase
    .from('wildtrack_discoveries')
    .select('species_id')
    .eq('user_id', userId)
    .eq('mountain_id', mountainId);

  if (error) throw error;
  return new Set((data || []).map((row: any) => Number(row.species_id)));
};

export const wildTrackSupabase = {
  async fetchSpecies(mountainId?: string, category?: string): Promise<Species[]> {
    if (!mountainId) {
      let query = supabase.from('wildtrack_species').select('*').order('common_name', { ascending: true });
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: any) => mapSpecies(row));
    }

    const links = await loadMountainLinks(mountainId);
    const rows = await loadSpeciesRows(links.map((link: any) => Number(link.species_id)));
    const linkMap = new Map(links.map((link: any) => [Number(link.species_id), link]));
    return rows
      .filter((row: any) => !category || row.category === category)
      .map((row: any) => ({
        ...mapSpecies(row),
        mountain_id: mountainId,
        is_endemic: Boolean(linkMap.get(Number(row.id))?.is_endemic),
      }));
  },

  async fetchSpeciesById(id: number): Promise<Species | null> {
    const { data, error } = await supabase
      .from('wildtrack_species')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSpecies(data) : null;
  },

  async fetchMountainSpecies(mountainId: string, featuredOnly = false): Promise<Species[]> {
    const [links, userId] = await Promise.all([
      loadMountainLinks(mountainId, featuredOnly),
      getCurrentUserId(),
    ]);
    const [rows, discoveredIds] = await Promise.all([
      loadSpeciesRows(links.map((link: any) => Number(link.species_id))),
      loadDiscoveredIds(mountainId, userId),
    ]);
    const linkMap = new Map(links.map((link: any) => [Number(link.species_id), link]));

    return rows.map((row: any) => ({
      ...mapSpecies(row, discoveredIds.has(Number(row.id))),
      mountain_id: mountainId,
      is_endemic: Boolean(linkMap.get(Number(row.id))?.is_endemic),
    }));
  },

  async fetchDiscoveries(mountainId?: string, category?: string): Promise<Discovery[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    let query = supabase
      .from('wildtrack_discoveries')
      .select('*, wildtrack_species(*)')
      .eq('user_id', userId)
      .order('discovered_at', { ascending: false });

    if (mountainId) query = query.eq('mountain_id', mountainId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .map((row: any) => ({
        id: Number(row.id),
        user_id: 0,
        species_id: Number(row.species_id),
        mountain_id: row.mountain_id,
        discovered_at: row.discovered_at,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
        notes: row.notes || undefined,
        scientific_name: row.wildtrack_species?.scientific_name,
        common_name: row.wildtrack_species?.common_name,
        category: row.wildtrack_species?.category,
        image_url: row.wildtrack_species?.image_url,
        conservation_status: row.wildtrack_species?.conservation_status,
      }))
      .filter((row: Discovery) => !category || row.category === category);
  },

  async createDiscovery(speciesId: number, mountainId: string, latitude?: number, longitude?: number, notes?: string) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: 'Not authenticated' };

    const { error } = await supabase.from('wildtrack_discoveries').insert({
      user_id: userId,
      species_id: speciesId,
      mountain_id: mountainId,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      notes: notes ?? null,
    });

    return { error: error?.code === '23505' ? 'Species already discovered on this mountain' : error?.message || null };
  },

  async removeDiscovery(discoveryId: number) {
    const { error } = await supabase
      .from('wildtrack_discoveries')
      .delete()
      .eq('id', discoveryId);

    return { error: error?.message || null };
  },

  async fetchStats(mountainId?: string): Promise<WildTrackStats> {
    const [discoveries, biodiversity] = await Promise.all([
      this.fetchDiscoveries(mountainId),
      mountainId
        ? supabase.from('wildtrack_mountain_biodiversity').select('curated_species_count').eq('id', mountainId).maybeSingle()
        : supabase.from('wildtrack_mountain_biodiversity').select('curated_species_count'),
    ]);

    if ('error' in biodiversity && biodiversity.error) throw biodiversity.error;
    const biodiversityRows = Array.isArray(biodiversity.data) ? biodiversity.data : biodiversity.data ? [biodiversity.data] : [];
    const totalSpecies = biodiversityRows.reduce((sum: number, row: any) => sum + Number(row.curated_species_count || 0), 0);
    const byCategory = new Map<string, number>();

    discoveries.forEach((discovery) => {
      const category = discovery.category || 'Others';
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    });

    return {
      discovered_count: discoveries.length,
      total_species: totalSpecies,
      percentage: totalSpecies > 0 ? Math.round((discoveries.length / totalSpecies) * 100) : 0,
      by_category: Array.from(byCategory, ([category, count]) => ({ category, count })),
    };
  },

  async fetchMountainBiodiversity(mountainId: string): Promise<MountainBiodiversity | null> {
    const { data, error } = await supabase
      .from('wildtrack_mountain_biodiversity')
      .select('*')
      .eq('id', mountainId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      curated_species_count: data.curated_species_count,
      description: data.description || '',
      endemic_species_count: data.endemic_species_count || 0,
      key_species: Array.isArray(data.key_species) ? data.key_species.join(', ') : String(data.key_species || ''),
      ecosystem: data.ecosystem || '',
      conservation_status: data.conservation_status || '',
    };
  },
};
