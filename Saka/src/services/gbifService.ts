import { SpeciesSearchResult, SpeciesDetails, TaxonomyNode, OccurrenceRecord } from '../types/wildtrack';

const BASE_URL = 'https://api.gbif.org/v1';

const mapTaxonomy = (record: any): TaxonomyNode => ({
  kingdom: record.kingdom,
  phylum: record.phylum,
  class: record.class,
  order: record.order,
  family: record.family,
  genus: record.genus,
  species: record.species || record.speciesKey?.toString(),
});

const inferCategoryFromRank = (rank?: string, family?: string, genus?: string): string => {
  if (!rank) return 'Unknown';
  const normalized = rank.toLowerCase();
  if (normalized.includes('animalia')) return 'Fauna';
  if (normalized.includes('aves')) return 'Birds';
  if (normalized.includes('mammalia')) return 'Mammals';
  if (normalized.includes('amphibia')) return 'Amphibians';
  if (normalized.includes('reptilia')) return 'Reptiles';
  if (normalized.includes('insecta')) return 'Insects';
  if (normalized.includes('plantae')) return 'Flora';
  if (['genus', 'family', 'order', 'class'].includes(normalized)) {
    return 'Flora / Fauna';
  }
  if (family?.toLowerCase().includes('orchid')) return 'Orchids';
  if (family?.toLowerCase().includes('fern')) return 'Ferns';
  return 'Flora';
};

export const GBIFService = {
  async searchSpecies(name: string, limit: number = 18): Promise<SpeciesSearchResult[]> {
    try {
      const response = await fetch(`${BASE_URL}/species/search?q=${encodeURIComponent(name)}&limit=${limit}&rank=SPECIES`);
      const data = await response.json();
      const results = data.results || [];
      return results.map((item: any) => ({
        id: `gbif-${item.key}`,
        source: 'gbif',
        gbif_id: item.key,
        scientific_name: item.scientificName || item.canonicalName || item.scientificName,
        common_name: item.vernacularName || item.canonicalName,
        taxon_rank: item.rank,
        category: inferCategoryFromRank(item.rank, item.family, item.genus),
        taxonomy: mapTaxonomy(item),
        image_url: undefined,
        conservation_status: item.taxonomicStatus,
        is_endemic: false,
        is_native: false,
        occurrence_count: item.numDescendants ?? item.usageKey ?? undefined,
        habitat: item.kingdom,
        description: item.taxonomicStatus || `${item.rank || 'Species'} within ${item.kingdom || 'the tree of life'}`,
      }));
    } catch (error) {
      console.error('[GBIFService] searchSpecies error', error);
      return [];
    }
  },

  async getSpeciesDetails(gbifId: number): Promise<SpeciesDetails | null> {
    try {
      const [speciesResp, vernacularResp, occurrenceResp] = await Promise.all([
        fetch(`${BASE_URL}/species/${gbifId}`),
        fetch(`${BASE_URL}/species/${gbifId}/vernacularNames`),
        fetch(`${BASE_URL}/occurrence/search?taxonKey=${gbifId}&limit=12&hasCoordinate=true`),
      ]);

      const speciesData = await speciesResp.json();
      const vernacularData = await vernacularResp.json();
      const occurrenceData = await occurrenceResp.json();

      const vernacularNames = (vernacularData.results || []).map((item: any) => item.vernacularName).filter(Boolean);
      const occurrences = (occurrenceData.results || []).map((item: any) => item);
      const sortedObservations = occurrences.sort((a: any, b: any) => {
        const aDate = new Date(a.eventDate || a.created || 0).getTime();
        const bDate = new Date(b.eventDate || b.created || 0).getTime();
        return bDate - aDate;
      });

      const observationSummary = {
        total_records: occurrenceData.count || occurrences.length,
        last_observed: sortedObservations[0]?.eventDate || sortedObservations[0]?.created || undefined,
        elevation_min: Math.min(...occurrences.filter((o: any) => typeof o.elevation === 'number').map((o: any) => o.elevation || Infinity), Infinity),
        elevation_max: Math.max(...occurrences.filter((o: any) => typeof o.elevation === 'number').map((o: any) => o.elevation || -Infinity), -Infinity),
        common_habitats: Array.from(new Set((occurrences || []).slice(0, 6).map((o: any) => o.habitat || o.datasetTitle).filter(Boolean) as string[])).slice(0, 3),
      };

      return {
        id: `gbif-${speciesData.key}`,
        source: 'gbif',
        gbif_id: speciesData.key,
        scientific_name: speciesData.scientificName || speciesData.canonicalName,
        common_name: speciesData.vernacularName || speciesData.canonicalName,
        taxon_rank: speciesData.rank,
        category: inferCategoryFromRank(speciesData.rank, speciesData.family, speciesData.genus),
        taxonomy: mapTaxonomy(speciesData),
        image_url: undefined,
        conservation_status: speciesData.taxonomicStatus,
        is_endemic: false,
        is_native: true,
        gallery_images: [],
        vernacular_names: vernacularNames,
        distribution_notes: speciesData.taxonomicStatus,
        observation_summary: {
          ...observationSummary,
          elevation_min: Number.isFinite(observationSummary.elevation_min) ? observationSummary.elevation_min : undefined,
          elevation_max: Number.isFinite(observationSummary.elevation_max) ? observationSummary.elevation_max : undefined,
        },
        elevation_range: observationSummary.elevation_min && observationSummary.elevation_max
          ? `${observationSummary.elevation_min}–${observationSummary.elevation_max} m`
          : undefined,
        last_observed: observationSummary.last_observed,
      };
    } catch (error) {
      console.error('[GBIFService] getSpeciesDetails error', error);
      return null;
    }
  },

  async getSpeciesOccurrences(gbifId: number, limit: number = 18): Promise<OccurrenceRecord[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/occurrence/search?taxonKey=${gbifId}&limit=${limit}&hasCoordinate=true&country=PH`
      );
      const data = await response.json();
      return (data.results || []).map((item: any) => ({
        id: `occ-${item.key}`,
        source: 'gbif',
        recordedAt: item.eventDate || item.created,
        coordinates: item.decimalLatitude && item.decimalLongitude ? {
          latitude: item.decimalLatitude,
          longitude: item.decimalLongitude,
        } : undefined,
        elevation: item.elevation,
        country: item.country,
        locality: item.locality || item.localityText || item.town,
        dataset: item.datasetTitle,
        confidence: item.coordinatePrecision ? `±${item.coordinatePrecision} m` : undefined,
        habitat: item.habitat,
        imageUrl: item.media?.[0]?.identifier,
      }));
    } catch (error) {
      console.error('[GBIFService] getSpeciesOccurrences error', error);
      return [];
    }
  },
};
