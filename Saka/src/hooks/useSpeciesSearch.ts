import { useEffect, useMemo, useRef, useState } from 'react';
import { GBIFService } from '../services/gbifService';
import { INaturalistService } from '../services/inaturalistService';
import { PlantNetService } from '../services/plantnetService';
import { SpeciesSearchFilters, SpeciesSearchResult } from '../types/wildtrack';

const defaultFilters: SpeciesSearchFilters = {
  category: 'all',
  region: 'philippines',
  mountain: 'all',
  endemicOnly: false,
  threatenedOnly: false,
  nativeOnly: true,
  imagesOnly: false,
  recentOnly: false,
  highConfidenceOnly: false,
  taxonRanks: [],
};

const categoryLabels = [
  { key: 'all', label: 'All' },
  { key: 'flora', label: 'Flora' },
  { key: 'fauna', label: 'Fauna' },
  { key: 'birds', label: 'Birds' },
  { key: 'mammals', label: 'Mammals' },
  { key: 'amphibians', label: 'Amphibians' },
  { key: 'reptiles', label: 'Reptiles' },
  { key: 'insects', label: 'Insects' },
  { key: 'trees', label: 'Trees' },
  { key: 'ferns', label: 'Ferns' },
  { key: 'orchids', label: 'Orchids' },
];

const regionOptions = [
  { key: 'philippines', label: 'Philippines' },
  { key: 'panay', label: 'Panay' },
  { key: 'mount-apo', label: 'Mt. Apo' },
  { key: 'mount-kanlaon', label: 'Mt. Kanlaon' },
  { key: 'sierra-madre', label: 'Sierra Madre' },
];

const mountainOptions = [
  { key: 'all', label: 'All Mountains' },
  { key: 'Mt. Apo', label: 'Mt. Apo' },
  { key: 'Mt. Kanlaon', label: 'Mt. Kanlaon' },
  { key: 'Mt. Pulag', label: 'Mt. Pulag' },
  { key: 'Mt. Madjaas', label: 'Mt. Madjaas' },
];

const filterSpecies = (item: SpeciesSearchResult, filters: SpeciesSearchFilters): boolean => {
  if (filters.category !== 'all' && item.category?.toLowerCase() !== filters.category.toLowerCase()) {
    if (!item.category?.toLowerCase().includes(filters.category.toLowerCase())) {
      return false;
    }
  }

  if (filters.endemicOnly && !item.is_endemic) {
    return false;
  }

  if (filters.threatenedOnly && !(item.conservation_status?.toLowerCase().includes('endangered') || item.conservation_status?.toLowerCase().includes('vulnerable') || item.conservation_status?.toLowerCase().includes('threatened'))) {
    return false;
  }

  if (filters.nativeOnly && item.is_native === false) {
    return false;
  }

  if (filters.imagesOnly && !item.has_image && !item.image_url) {
    return false;
  }

  if (filters.recentOnly && item.last_observed) {
    const observed = new Date(item.last_observed);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    if (observed < cutoff) return false;
  }

  if (filters.highConfidenceOnly && item.observation_sources?.length === 0) {
    return false;
  }

  if (filters.region !== 'philippines' && filters.region !== 'all') {
    const term = filters.region.toLowerCase();
    const nameMatch = item.common_name?.toLowerCase().includes(term) || item.scientific_name.toLowerCase().includes(term);
    if (!nameMatch && !item.habitat?.toLowerCase().includes(term) && !item.observation_sources?.some((source) => source.toLowerCase().includes(term))) {
      return false;
    }
  }

  if (filters.mountain !== 'all' && filters.mountain) {
    const mountainTerm = filters.mountain.toLowerCase();
    const mountainMatch = item.mountain_occurrence?.some((mountain) => mountain.toLowerCase().includes(mountainTerm));
    if (!mountainMatch && !item.location?.toLowerCase().includes(mountainTerm)) {
      return false;
    }
  }

  if (filters.taxonRanks.length > 0 && item.taxon_rank) {
    const rank = item.taxon_rank.toLowerCase();
    if (!filters.taxonRanks.some((taxonRank) => rank.includes(taxonRank.toLowerCase()))) {
      return false;
    }
  }

  return true;
};

export const useSpeciesSearch = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SpeciesSearchFilters>(defaultFilters);
  const [results, setResults] = useState<SpeciesSearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, SpeciesSearchResult[]>>(new Map());

  const pageSize = 8;

  const filteredResults = useMemo(() => {
    return results.filter((item) => filterSpecies(item, filters));
  }, [results, filters]);

  const visibleResults = useMemo(() => {
    return filteredResults.slice(0, (page + 1) * pageSize);
  }, [filteredResults, page]);

  const hasMore = visibleResults.length < filteredResults.length;

  const suggestions = useMemo(() => {
    const allTerms = filteredResults
      .slice(0, 14)
      .flatMap((item) => [item.common_name, item.scientific_name])
      .filter(Boolean) as string[];
    return Array.from(new Set(allTerms)).slice(0, 10);
  }, [filteredResults]);

  useEffect(() => {
    const queryKey = `${query.trim().toLowerCase()}|${JSON.stringify(filters)}`;
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      if (cacheRef.current.has(queryKey)) {
        setResults(cacheRef.current.get(queryKey) || []);
        setPage(0);
        return;
      }

      setIsFetching(true);
      setError(null);

      try {
        const [gbifItems, inatItems, plantItems] = await Promise.all([
          GBIFService.searchSpecies(query, 12),
          INaturalistService.searchTaxa(query, 12),
          PlantNetService.searchPlants(query, 6),
        ]);

        const merged = [...gbifItems, ...inatItems, ...plantItems];
        const unique: SpeciesSearchResult[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          const fingerprint = `${item.scientific_name?.toLowerCase()}|${item.common_name?.toLowerCase()}`;
          if (!seen.has(fingerprint)) {
            seen.add(fingerprint);
            unique.push({
              ...item,
              has_image: Boolean(item.image_url),
              is_native: item.is_native ?? true,
            });
          }
        }

        cacheRef.current.set(queryKey, unique);
        setResults(unique);
        setPage(0);
      } catch (fetchError) {
        console.error('[useSpeciesSearch] failed to load species', fetchError);
        setError('Unable to load species results. Check your connection and try again.');
      } finally {
        setIsFetching(false);
      }
    }, 420);

    return () => clearTimeout(timeout);
  }, [query, filters]);

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPage(0);
  };

  const setFilter = (key: keyof SpeciesSearchFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(0);
  };

  const expandResults = () => {
    if (!hasMore) return;
    setPage((prev) => prev + 1);
  };

  const selectSuggestion = (value: string) => {
    setSelectedSuggestion(value);
    setQuery(value);
  };

  return {
    query,
    setQuery,
    filters,
    setFilters,
    categoryLabels,
    regionOptions,
    mountainOptions,
    results: visibleResults,
    allResults: filteredResults,
    suggestions,
    selectedSuggestion,
    isFetching,
    error,
    hasMore,
    expandResults,
    clearFilters,
    setFilter,
    selectSuggestion,
  };
};
