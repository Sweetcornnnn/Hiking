import { useCallback, useState } from 'react';
import { GBIFService } from '../services/gbifService';
import { INaturalistService } from '../services/inaturalistService';
import { SpeciesDetails, SpeciesSearchResult } from '../types/wildtrack';

const decodeCodePoint = (value: string, radix = 10): string => {
  const codePoint = parseInt(value, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : '';
};

const cleanDescription = (description?: string): string | undefined => {
  if (!description) return undefined;

  const cleaned = description
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&#(\d+);/g, (_match, code: string) => decodeCodePoint(code))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => decodeCodePoint(code, 16))
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned || undefined;
};

const mergeDetails = (gbifDetails: SpeciesDetails | null, inatDetails: SpeciesDetails | null, baseSpecies: SpeciesSearchResult): SpeciesDetails => {
  const galleryImages = [
    inatDetails?.image_url,
    ...((inatDetails?.gallery_images || []).slice(0, 5)),
    baseSpecies.image_url,
  ].filter(Boolean) as string[];
  const taxonomy = baseSpecies.taxonomy || gbifDetails?.taxonomy || inatDetails?.taxonomy;
  const taxonomySource = baseSpecies.taxonomy
    ? baseSpecies.source === 'gbif'
      ? 'GBIF'
      : baseSpecies.source === 'inaturalist'
        ? 'iNaturalist'
        : undefined
    : gbifDetails?.taxonomy
      ? 'GBIF'
      : inatDetails?.taxonomy
        ? 'iNaturalist'
        : undefined;
  const descriptionDetails = inatDetails?.description
    ? inatDetails
    : gbifDetails?.description
      ? gbifDetails
      : null;

  return {
    ...baseSpecies,
    ...gbifDetails,
    ...inatDetails,
    gallery_images: Array.from(new Set(galleryImages)).slice(0, 6),
    scientific_name: baseSpecies.scientific_name || gbifDetails?.scientific_name || inatDetails?.scientific_name,
    common_name: baseSpecies.common_name || gbifDetails?.common_name || inatDetails?.common_name,
    taxonomy,
    taxonomy_source: taxonomySource,
    description: cleanDescription(descriptionDetails?.description),
    description_source: descriptionDetails?.description_source,
    occurrence_count:
      inatDetails?.occurrence_count ??
      gbifDetails?.observation_summary?.total_records ??
      baseSpecies.occurrence_count,
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
