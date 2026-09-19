import { useCallback, useState } from 'react';
import { GBIFService } from '../services/gbifService';
import { INaturalistService } from '../services/inaturalistService';
import { SpeciesDetails, SpeciesSearchResult } from '../types/wildtrack';

const mergeDetails = (gbifDetails: SpeciesDetails | null, inatDetails: SpeciesDetails | null, baseSpecies: SpeciesSearchResult): SpeciesDetails => {
  const galleryImages = [
    inatDetails?.image_url,
    ...((inatDetails?.gallery_images || []).slice(0, 5)),
    baseSpecies.image_url,
  ].filter(Boolean) as string[];

  return {
    ...baseSpecies,
    ...gbifDetails,
    ...inatDetails,
    gallery_images: Array.from(new Set(galleryImages)).slice(0, 6),
    scientific_name: baseSpecies.scientific_name || gbifDetails?.scientific_name || inatDetails?.scientific_name,
    common_name: baseSpecies.common_name || gbifDetails?.common_name || inatDetails?.common_name,
    taxonomy: baseSpecies.taxonomy || gbifDetails?.taxonomy || inatDetails?.taxonomy,
    image_url: baseSpecies.image_url || inatDetails?.image_url || gbifDetails?.image_url,
    observation_summary: {
      total_records: Math.max(
        gbifDetails?.observation_summary?.total_records || 0,
        inatDetails?.occurrence_count || 0,
        baseSpecies.occurrence_count || 0,
      ),
      last_observed: gbifDetails?.last_observed || inatDetails?.last_observed || baseSpecies.last_observed,
      elevation_min: gbifDetails?.observation_summary?.elevation_min,
      elevation_max: gbifDetails?.observation_summary?.elevation_max,
      common_habitats: gbifDetails?.observation_summary?.common_habitats || [],
    },
  } as SpeciesDetails;
};

export const useSpeciesDetails = () => {
  const [detail, setDetail] = useState<SpeciesDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSpeciesDetails = useCallback(async (species: SpeciesSearchResult) => {
    setIsLoading(true);
    setError(null);

    try {
      const [gbifDetails, inatDetails] = await Promise.all([
        species.gbif_id ? GBIFService.getSpeciesDetails(species.gbif_id) : null,
        species.inaturalist_id ? INaturalistService.getTaxonDetails(species.inaturalist_id) : null,
      ]);

      const merged = mergeDetails(gbifDetails, inatDetails, species);
      setDetail(merged);
      return merged;
    } catch (loadError) {
      console.error('[useSpeciesDetails] loadSpeciesDetails error', loadError);
      setError('Unable to load full species details.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSpeciesDetails = () => {
    setDetail(null);
    setError(null);
  };

  return {
    detail,
    isLoading,
    error,
    loadSpeciesDetails,
    clearSpeciesDetails,
  };
};
