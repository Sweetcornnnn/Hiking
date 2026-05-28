import { SpeciesSearchResult, SpeciesDetails, OccurrenceRecord } from '../types/wildtrack';

const BASE_URL = 'https://api.inaturalist.org/v1';

const inferCategoryFromInat = (iconicTaxonName?: string, rank?: string): string => {
  if (!iconicTaxonName) return 'Flora / Fauna';
  const normalized = iconicTaxonName.toLowerCase();
  if (normalized.includes('bird')) return 'Birds';
  if (normalized.includes('mammal')) return 'Mammals';
  if (normalized.includes('amphibian')) return 'Amphibians';
  if (normalized.includes('reptile')) return 'Reptiles';
  if (normalized.includes('insect')) return 'Insects';
  if (normalized.includes('plant')) return 'Flora';
  if (normalized.includes('fungi')) return 'Fungi';
  return 'Flora / Fauna';
};

export const INaturalistService = {
  async searchTaxa(query: string, perPage: number = 16): Promise<SpeciesSearchResult[]> {
    try {
      const response = await fetch(`${BASE_URL}/taxa?q=${encodeURIComponent(query)}&per_page=${perPage}`);
      const data = await response.json();
      const results = data.results || [];

      return results.map((item: any) => ({
        id: `inat-${item.id}`,
        source: 'inaturalist',
        inaturalist_id: item.id,
        scientific_name: item.name || item.scientific_name,
        common_name: item.preferred_common_name || item.common_name || item.name,
        taxon_rank: item.rank,
        category: inferCategoryFromInat(item.iconic_taxon_name, item.rank),
        taxonomy: {
          kingdom: item.kingdom_name,
          phylum: item.phylum_name,
          class: item.class_name,
          order: item.order_name,
          family: item.family_name,
          genus: item.genus_name,
          species: item.species_name,
        },
        image_url: item.default_photo?.medium_url || item.default_photo?.square_url,
        conservation_status: item.conservation_status?.status_name,
        is_endemic: false,
        is_native: true,
        occurrence_count: item.observations_count,
        last_observed: item.last_observation_at,
        observation_sources: item.preferred_common_name ? [item.preferred_common_name] : [],
        description: item.wikipedia_summary || `${item.rank || 'Species'} - ${item.observations_count || 0} observations recorded`,
      }));
    } catch (error) {
      console.error('[INaturalistService] searchTaxa error', error);
      return [];
    }
  },

  async getTaxonDetails(taxonId: number): Promise<SpeciesDetails | null> {
    try {
      const response = await fetch(`${BASE_URL}/taxa/${taxonId}`);
      const data = await response.json();
      const taxon = data.results?.[0];
      if (!taxon) return null;

      const photos = (taxon.taxon_photos || []).map((photo: any) => photo.photo?.medium_url || photo.photo?.original_url).filter(Boolean);
      const vernacularNames = (taxon.vernacular_names || []).map((item: any) => item.name).filter(Boolean);

      return {
        id: `inat-${taxon.id}`,
        source: 'inaturalist',
        inaturalist_id: taxon.id,
        scientific_name: taxon.name,
        common_name: taxon.preferred_common_name || taxon.name,
        taxon_rank: taxon.rank,
        category: inferCategoryFromInat(taxon.iconic_taxon_name, taxon.rank),
        taxonomy: {
          kingdom: taxon.kingdom_name,
          phylum: taxon.phylum_name,
          class: taxon.class_name,
          order: taxon.order_name,
          family: taxon.family_name,
          genus: taxon.genus_name,
          species: taxon.species_name,
        },
        image_url: taxon.default_photo?.medium_url || taxon.default_photo?.square_url,
        gallery_images: photos,
        conservation_status: taxon.conservation_status?.status_name,
        vernacular_names: vernacularNames,
        occurrence_count: taxon.observations_count,
        last_observed: taxon.last_observation_at,
        observation_sources: [taxon.iconic_taxon_name].filter(Boolean),
        description: taxon.wikipedia_url ? `More information available at ${taxon.wikipedia_url}` : undefined,
        distribution_notes: taxon.native ? 'Native species' : 'Introduced or unknown origin',
      };
    } catch (error) {
      console.error('[INaturalistService] getTaxonDetails error', error);
      return null;
    }
  },

  async getObservations(taxonId: number, perPage: number = 12): Promise<OccurrenceRecord[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/observations?taxon_id=${taxonId}&per_page=${perPage}&order=desc&order_by=observed_on`
      );
      const data = await response.json();
      return (data.results || []).map((item: any) => ({
        id: `inat-obs-${item.id}`,
        source: 'inaturalist',
        recordedAt: item.observed_on,
        coordinates: item.geojson?.coordinates
          ? { longitude: item.geojson.coordinates[0], latitude: item.geojson.coordinates[1] }
          : undefined,
        elevation: item.taxon?.elevation || item.location_accuracy,
        country: item.place_guess,
        locality: item.location_guess,
        dataset: item.site_id?.toString(),
        habitat: item.taxon?.preferred_common_name,
        confidence: item.quality_grade,
        imageUrl: item.photos?.[0]?.url,
      }));
    } catch (error) {
      console.error('[INaturalistService] getObservations error', error);
      return [];
    }
  },
};
