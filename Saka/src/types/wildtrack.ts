export interface TaxonomyNode {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
}

export interface OccurrenceRecord {
  id: string;
  source: 'gbif' | 'inaturalist';
  recordedAt?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  elevation?: number;
  country?: string;
  locality?: string;
  dataset?: string;
  confidence?: string;
  habitat?: string;
  imageUrl?: string;
}

export interface SpeciesSearchResult {
  id: string;
  source: 'gbif' | 'inaturalist' | 'plantnet' | 'hybrid';
  gbif_id?: number;
  inaturalist_id?: number;
  plantnet_id?: string;
  scientific_name: string;
  common_name?: string;
  taxon_rank?: string;
  category?: string;
  taxonomy?: TaxonomyNode;
  image_url?: string;
  conservation_status?: string;
  is_endemic?: boolean;
  is_native?: boolean;
  has_image?: boolean;
  occurrence_count?: number;
  last_observed?: string;
  observation_sources?: string[];
  habitat?: string;
  location?: string;
  mountain_occurrence?: string[];
  description?: string;
  trilist?: string[];
}

export interface SpeciesDetails extends SpeciesSearchResult {
  scientific_description?: string;
  vernacular_names?: string[];
  taxonomy?: TaxonomyNode;
  gallery_images?: string[];
  distribution_notes?: string;
  elevation_range?: string;
  nativity?: string;
  observation_summary?: {
    total_records: number;
    last_observed?: string;
    elevation_min?: number;
    elevation_max?: number;
    common_habitats?: string[];
  };
  philippine_occurrence?: boolean;
  mountain_occurrence?: string[];
  endemic_status?: string;
}

export interface SpeciesSearchFilters {
  category: string;
  region: string;
  mountain: string;
  endemicOnly: boolean;
  threatenedOnly: boolean;
  nativeOnly: boolean;
  imagesOnly: boolean;
  recentOnly: boolean;
  highConfidenceOnly: boolean;
  taxonRanks: string[];
}
