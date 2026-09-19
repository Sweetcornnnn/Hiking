import { Species } from '../store/wildtrackStore';

const safeJsonFetch = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
};

// GBIF API Service
export const GBIF_API = {
  baseUrl: 'https://api.gbif.org/v1',

  async searchSpecies(name: string, limit: number = 10): Promise<any[]> {
    const data = await safeJsonFetch<{ results?: any[] }>(
      `${this.baseUrl}/species/match?name=${encodeURIComponent(name)}&limit=${limit}`
    );
    return data?.results || [];
  },

  async getSpeciesById(gbifId: number): Promise<any | null> {
    return safeJsonFetch<any>(`${this.baseUrl}/species/${gbifId}`);
  },

  async getOccurrences(gbifId: number, limit: number = 20): Promise<any[]> {
    const data = await safeJsonFetch<{ results?: any[] }>(
      `${this.baseUrl}/occurrence/search?taxonKey=${gbifId}&limit=${limit}`
    );
    return data?.results || [];
  },

  async getSpeciesByLocation(latitude: number, longitude: number, radius: number = 50, limit: number = 100): Promise<any[]> {
    const data = await safeJsonFetch<{ results?: any[] }>(
      `${this.baseUrl}/occurrence/search?decimalLatitude=${latitude}&decimalLongitude=${longitude}&radius=${radius}&limit=${limit}&hasCoordinate=true`
    );
    return data?.results || [];
  },

  async getSpeciesDescription(gbifId: number): Promise<any | null> {
    const data = await safeJsonFetch<{ results?: any[] }>(`${this.baseUrl}/species/${gbifId}/descriptions`);
    return data?.results?.[0] || null;
  },

  async getVernacularNames(gbifId: number): Promise<any[]> {
    const data = await safeJsonFetch<{ results?: any[] }>(`${this.baseUrl}/species/${gbifId}/vernacularNames`);
    return data?.results || [];
  },
};

// iNaturalist API Service
export const INATURALIST_API = {
  baseUrl: 'https://api.inaturalist.org/v1',

  async fetchJson(url: string): Promise<any | null> {
    return safeJsonFetch<any>(url);
  },

  async searchTaxa(q: string, perPage: number = 10): Promise<any[]> {
    const data = await this.fetchJson(
      `${this.baseUrl}/taxa?q=${encodeURIComponent(q)}&per_page=${perPage}`
    );
    return Array.isArray(data?.results) ? data.results : [];
  },

  async getTaxonById(taxonId: number): Promise<any | null> {
    const data = await this.fetchJson(`${this.baseUrl}/taxa/${taxonId}`);
    if (!data) return null;
    return Array.isArray(data.results) ? data.results[0] || null : null;
  },

  async getObservations(taxonId: number, perPage: number = 10): Promise<any[]> {
    const data = await this.fetchJson(
      `${this.baseUrl}/observations?taxon_id=${taxonId}&per_page=${perPage}&order=desc&order_by=created_at`
    );
    return Array.isArray(data?.results) ? data.results : [];
  },

  async getTaxonPhotos(taxonId: number): Promise<string[]> {
    try {
      const taxon = await this.getTaxonById(taxonId);
      const photos: string[] = [];

      if (taxon && taxon.default_photo) {
        if (taxon.default_photo.medium_url) {
          photos.push(taxon.default_photo.medium_url);
        } else if (taxon.default_photo.url) {
          photos.push(taxon.default_photo.url);
        }
      }

      const observations = await this.getObservations(taxonId, 5);
      for (const obs of observations) {
        if (obs.photos && obs.photos.length > 0) {
          for (const photo of obs.photos) {
            if (photo.url) {
              photos.push(photo.url);
            }
          }
        }
      }

      return photos;
    } catch (error) {
      console.error('iNaturalist photos error:', error);
      return [];
    }
  },

  async getObservationsByLocation(lat: number, lng: number, radius: number = 50, perPage: number = 30): Promise<any[]> {
    const data = await safeJsonFetch<{ results?: any[] }>(
      `${this.baseUrl}/observations?lat=${lat}&lng=${lng}&radius=${radius}&per_page=${perPage}&order=desc&order_by=created_at`
    );
    return data?.results || [];
  },

  async getTaxonComplete(taxonId: number): Promise<any | null> {
    const data = await safeJsonFetch<{ results?: any[] }>(`${this.baseUrl}/taxa/${taxonId}`);
    const taxon = data?.results?.[0];

    if (!taxon) return null;

    const observations = await this.getObservations(taxonId, 3);

    return {
      ...taxon,
      recent_observations: observations,
      observation_count: taxon.observations_count || 0,
    };
  },
};

// PlantNET API Service (for plant identification)
export const PLANTNET_API = {
  baseUrl: 'https://api.plantnet.org/v1',

  async identify(imageData: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: JSON.stringify({ images: [imageData] }),
      });
      const data = await response.json();
      return data.results || null;
    } catch (error) {
      console.error('PlantNET identification error:', error);
      return null;
    }
  },

  async searchPlants(name: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/all/websites/${encodeURIComponent(name)}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('PlantNET search error:', error);
      return [];
    }
  },
};

// Combined API Service for WildTrack
export const WildTrackAPI = {
  imageCache: new Map<string, string | null>(),

  async searchSpecies(name: string): Promise<Partial<Species>[]> {
    try {
      const gbifResults = await GBIF_API.searchSpecies(name, 5);
      const inatResults = await INATURALIST_API.searchTaxa(name, 5);

      const merged: Partial<Species>[] = [];
      const seen = new Set<string>();

      for (const gbif of gbifResults) {
        const scientificName = gbif.scientificName || gbif.canonicalName;
        if (scientificName && !seen.has(scientificName)) {
          seen.add(scientificName);
          merged.push({
            scientific_name: scientificName,
            common_name: gbif.vernacularName,
            gbif_id: gbif.speciesKey || gbif.usageKey,
            category: this.mapGBIFRankToCategory(gbif.rank),
          });
        }
      }

      for (const inat of inatResults) {
        if (!seen.has(inat.name)) {
          seen.add(inat.name);
          merged.push({
            scientific_name: inat.name,
            common_name: inat.preferred_common_name,
            inaturalist_id: inat.id,
            image_url: inat.default_photo?.medium_url || inat.default_photo?.url,
            category: this.mapINatRankToCategory(inat.rank),
            conservation_status: inat.conservation_status?.status_name,
          });
        }
      }

      return merged;
    } catch (error) {
      console.error('Combined search error:', error);
      return [];
    }
  },

  async getCompleteSpeciesData(gbifId?: number, inatId?: number): Promise<Partial<Species>> {
    const data: Partial<Species> = {};

    try {
      if (gbifId) {
        const gbifData = await GBIF_API.getSpeciesById(gbifId);
        if (gbifData) {
          data.scientific_name = gbifData.scientificName || gbifData.canonicalName;
          data.gbif_id = gbifId;
          data.category = this.mapGBIFRankToCategory(gbifData.rank);

          const vernacular = await GBIF_API.getVernacularNames(gbifId);
          if (vernacular.length > 0) {
            data.common_name = vernacular[0].vernacularName;
          }

          const description = await GBIF_API.getSpeciesDescription(gbifId);
          if (description) {
            data.description = description.description;
          }
        }
      }

      if (inatId) {
        const inatData = await INATURALIST_API.getTaxonComplete(inatId);
        if (inatData) {
          data.scientific_name = data.scientific_name || inatData.name;
          data.common_name = data.common_name || inatData.preferred_common_name;
          data.inaturalist_id = inatId;
          data.image_url = data.image_url || inatData.default_photo?.medium_url || inatData.default_photo?.url;
          data.category = data.category || this.mapINatRankToCategory(inatData.rank);
          if (inatData.conservation_status) {
            data.conservation_status = inatData.conservation_status.status_name;
          }
          if (inatData.taxon) {
            data.habitat = inatData.taxon.habitat;
          }
        }
      }
    } catch (error) {
      console.error('Error getting complete species data:', error);
    }

    return data;
  },

  async getSpeciesByLocation(latitude: number, longitude: number, radius: number = 50): Promise<Partial<Species>[]> {
    try {
      const [gbifOccurrences, inatObservations] = await Promise.all([
        GBIF_API.getSpeciesByLocation(latitude, longitude, radius, 50),
        INATURALIST_API.getObservationsByLocation(latitude, longitude, radius, 30),
      ]);

      const species: Partial<Species>[] = [];
      const seen = new Set<string>();

      for (const occ of gbifOccurrences) {
        if (occ.species && !seen.has(occ.species)) {
          seen.add(occ.species);
          species.push({
            scientific_name: occ.species,
            common_name: occ.vernacularName,
            gbif_id: occ.taxonKey,
            category: this.mapGBIFRankToCategory(occ.taxonRank),
          });
        }
      }

      for (const obs of inatObservations) {
        if (obs.taxon && !seen.has(obs.taxon.name)) {
          seen.add(obs.taxon.name);
          species.push({
            scientific_name: obs.taxon.name,
            common_name: obs.taxon.preferred_common_name,
            inaturalist_id: obs.taxon.id,
            image_url: obs.taxon.default_photo?.medium_url || obs.photos?.[0]?.url,
            category: this.mapINatRankToCategory(obs.taxon.rank),
            conservation_status: obs.taxon.conservation_status?.status_name,
          });
        }
      }

      return species;
    } catch (error) {
      console.error('Error getting species by location:', error);
      return [];
    }
  },

  mapGBIFRankToCategory(rank: string): string {
    const rankLower = rank?.toLowerCase() || '';
    if (rankLower.includes('species') || rankLower.includes('specie')) return 'Others';
    if (rankLower.includes('genus')) return 'Plants';
    if (rankLower.includes('family')) return 'Plants';
    if (rankLower.includes('order')) return 'Others';
    if (rankLower.includes('class')) return 'Others';
    return 'Others';
  },

  mapINatRankToCategory(rank: string): string {
    const rankLower = rank?.toLowerCase() || '';
    if (rankLower.includes('species')) return 'Others';
    if (rankLower.includes('genus')) return 'Plants';
    if (rankLower.includes('family')) return 'Plants';
    if (rankLower.includes('order')) return 'Others';
    if (rankLower.includes('class')) return 'Others';
    return 'Others';
  },

  mapTaxonToCategory(scientificName: string, commonName?: string): string {
    const name = (scientificName + ' ' + (commonName || '')).toLowerCase();
    if (name.includes('insect') || name.includes('beetle') || name.includes('butterfly') ||
        name.includes('moth') || name.includes('ant') || name.includes('bee') ||
        name.includes('fly') || name.includes('dragonfly') || name.includes('grasshopper')) {
      return 'Insects';
    }
    if (name.includes('tree') || name.includes('oak') || name.includes('pine') ||
        name.includes('maple') || name.includes('palm') || name.includes('cedar') ||
        name.includes('fir') || name.includes('spruce') || name.includes('mahogany')) {
      return 'Trees';
    }
    if (name.includes('fern') || name.includes('pteris') || name.includes('adiantum') ||
        name.includes('nephrolepis') || name.includes('blechnum')) {
      return 'Ferns';
    }
    if (name.includes('herb') || name.includes('mint') || name.includes('basil') ||
        name.includes('oregano') || name.includes('thyme') || name.includes('rosemary')) {
      return 'Herbs';
    }
    if (name.includes('flower') || name.includes('rose') || name.includes('orchid') ||
        name.includes('lily') || name.includes('tulip') || name.includes('sunflower') ||
        name.includes('daisy') || name.includes('jasmine')) {
      return 'Flowers';
    }
    if (name.includes('mushroom') || name.includes('fungus') || name.includes('agaricus') ||
        name.includes('boletus') || name.includes('amanita') || name.includes('cantharellus')) {
      return 'Mushrooms';
    }
    if (name.includes('bird') || name.includes('eagle') || name.includes('hawk') ||
        name.includes('owl') || name.includes('parrot') || name.includes('hornbill')) {
      return 'Birds';
    }
    if (name.includes('mammal') || name.includes('deer') || name.includes('monkey') ||
        name.includes('bat') || name.includes('rodent') || name.includes('civet')) {
      return 'Mammals';
    }
    if (name.includes('reptile') || name.includes('lizard') || name.includes('snake') ||
        name.includes('turtle') || name.includes('crocodile')) {
      return 'Reptiles';
    }
    if (name.includes('amphibian') || name.includes('frog') || name.includes('toad') ||
        name.includes('salamander')) {
      return 'Amphibians';
    }
    if (name.includes('plant') || name.includes('flora') || name.includes('botany')) {
      return 'Plants';
    }
    return 'Others';
  },

  normalizeSpeciesName(name?: string): string {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/[_–—‑]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  isTaxonMatch(searchName: string | null, taxon: any): boolean {
    if (!searchName || !taxon) return false;
    const normalizedSearchName = this.normalizeSpeciesName(searchName);
    const normalizedTaxonName = this.normalizeSpeciesName(taxon.name);
    const normalizedCommonName = this.normalizeSpeciesName(taxon.preferred_common_name);

    return (
      normalizedTaxonName === normalizedSearchName ||
      normalizedCommonName === normalizedSearchName ||
      normalizedTaxonName.includes(normalizedSearchName) ||
      normalizedCommonName.includes(normalizedSearchName) ||
      normalizedSearchName.includes(normalizedTaxonName) ||
      normalizedSearchName.includes(normalizedCommonName)
    );
  },

  async getSpeciesImage(inatId?: number, gbifId?: number, scientificName?: string): Promise<string | null> {
    try {
      const cacheKey = `${inatId || ''}:${gbifId || ''}:${scientificName || ''}`;
      if (this.imageCache.has(cacheKey)) return this.imageCache.get(cacheKey) || null;

      const searchName = scientificName || (gbifId ? (await GBIF_API.getSpeciesById(gbifId))?.scientificName : null);

      if (inatId) {
        const taxon = await INATURALIST_API.getTaxonById(inatId);
        if (taxon) {
          const taxonMatches = this.isTaxonMatch(searchName, taxon);
          if (taxonMatches) {
            const photos = await INATURALIST_API.getTaxonPhotos(inatId);
            if (photos.length > 0) {
              this.imageCache.set(cacheKey, photos[0]);
              return photos[0];
            }
          }
        }
      }

      if (searchName) {
        const inatResults = await INATURALIST_API.searchTaxa(searchName, 20);
        const exactMatch = inatResults.find((taxon: any) => this.isTaxonMatch(searchName, taxon));
        if (exactMatch && exactMatch.default_photo) {
          const imageUrl = exactMatch.default_photo.medium_url || exactMatch.default_photo.url;
          this.imageCache.set(cacheKey, imageUrl);
          return imageUrl;
        }

        const fallback = inatResults.find((taxon: any) => taxon.default_photo && this.isTaxonMatch(searchName, taxon));
        if (fallback) {
          const imageUrl = fallback.default_photo.medium_url || fallback.default_photo.url;
          this.imageCache.set(cacheKey, imageUrl);
          return imageUrl;
        }
      }

      this.imageCache.set(cacheKey, null);
      return null;
    } catch (error) {
      console.error('Error getting species image:', error);
      return null;
    }
  },

  getDefaultSilhouette(category: string): string {
    try {
      return require('../../assets/images/wildtrackdefaultimg.png');
    } catch (e) {
      return require('../../assets/images/icon.png');
    }
  },
};
