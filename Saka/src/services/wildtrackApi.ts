import { Species } from '../store/wildtrackStore';

// GBIF API Service
export const GBIF_API = {
  baseUrl: 'https://api.gbif.org/v1',

  // Search for species by name
  async searchSpecies(name: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/species/match?name=${encodeURIComponent(name)}&limit=${limit}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('GBIF search error:', error);
      return [];
    }
  },

  // Get species details by GBIF ID
  async getSpeciesById(gbifId: number): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/species/${gbifId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('GBIF species details error:', error);
      return null;
    }
  },

  // Get occurrences for a species
  async getOccurrences(gbifId: number, limit: number = 20): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/occurrence/search?taxonKey=${gbifId}&limit=${limit}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('GBIF occurrences error:', error);
      return [];
    }
  },

  // Get species by location (for mountain-specific species)
  async getSpeciesByLocation(latitude: number, longitude: number, radius: number = 50, limit: number = 100): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/occurrence/search?decimalLatitude=${latitude}&decimalLongitude=${longitude}&radius=${radius}&limit=${limit}&hasCoordinate=true`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('GBIF location search error:', error);
      return [];
    }
  },

  // Get species description and vernacular names
  async getSpeciesDescription(gbifId: number): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/species/${gbifId}/descriptions`);
      const data = await response.json();
      return data.results?.[0] || null;
    } catch (error) {
      console.error('GBIF description error:', error);
      return null;
    }
  },

  // Get vernacular names (common names in different languages)
  async getVernacularNames(gbifId: number): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/species/${gbifId}/vernacularNames`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('GBIF vernacular names error:', error);
      return [];
    }
  },
};

// iNaturalist API Service
export const INATURALIST_API = {
  baseUrl: 'https://api.inaturalist.org/v1',

  // Search for taxa (species)
  async searchTaxa(q: string, perPage: number = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/taxa?q=${encodeURIComponent(q)}&per_page=${perPage}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('iNaturalist search error:', error);
      return [];
    }
  },

  // Get taxon details by ID
  async getTaxonById(taxonId: number): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/taxa/${taxonId}`);
      const data = await response.json();
      return data.results?.[0] || null;
    } catch (error) {
      console.error('iNaturalist taxon details error:', error);
      return null;
    }
  },

  // Get observations for a taxon
  async getObservations(taxonId: number, perPage: number = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/observations?taxon_id=${taxonId}&per_page=${perPage}&order=desc&order_by=created_at`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('iNaturalist observations error:', error);
      return [];
    }
  },

  // Get taxon photos - prioritize taxon's own photos, then observations
  async getTaxonPhotos(taxonId: number): Promise<string[]> {
    try {
      // First try to get the taxon directly to get its default photo
      const taxon = await this.getTaxonById(taxonId);
      const photos: string[] = [];
      
      // Add taxon's default photo if it exists
      if (taxon && taxon.default_photo) {
        if (taxon.default_photo.medium_url) {
          photos.push(taxon.default_photo.medium_url);
        } else if (taxon.default_photo.url) {
          photos.push(taxon.default_photo.url);
        }
      }
      
      // Then get observations for additional photos
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

  // Get observations by location (for mountain-specific species)
  async getObservationsByLocation(lat: number, lng: number, radius: number = 50, perPage: number = 30): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/observations?lat=${lat}&lng=${lng}&radius=${radius}&per_page=${perPage}&order=desc&order_by=created_at`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('iNaturalist location observations error:', error);
      return [];
    }
  },

  // Get taxon with complete details including conservation status
  async getTaxonComplete(taxonId: number): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/taxa/${taxonId}`);
      const data = await response.json();
      const taxon = data.results?.[0];
      
      if (!taxon) return null;

      // Get additional observations for more data
      const observations = await this.getObservations(taxonId, 3);
      
      return {
        ...taxon,
        recent_observations: observations,
        observation_count: taxon.observations_count || 0,
      };
    } catch (error) {
      console.error('iNaturalist complete taxon error:', error);
      return null;
    }
  },
};

// PlantNET API Service (for plant identification)
export const PLANTNET_API = {
  baseUrl: 'https://api.plantnet.org/v1',

  // Identify plant from image
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

  // Search plants by name
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
  // Search species across both APIs
  async searchSpecies(name: string): Promise<Partial<Species>[]> {
    try {
      // Search GBIF first
      const gbifResults = await GBIF_API.searchSpecies(name, 5);
      
      // Search iNaturalist
      const inatResults = await INATURALIST_API.searchTaxa(name, 5);
      
      // Merge results and deduplicate
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

  // Get complete species data by combining both APIs
  async getCompleteSpeciesData(gbifId?: number, inatId?: number): Promise<Partial<Species>> {
    const data: Partial<Species> = {};
    
    try {
      if (gbifId) {
        const gbifData = await GBIF_API.getSpeciesById(gbifId);
        if (gbifData) {
          data.scientific_name = gbifData.scientificName || gbifData.canonicalName;
          data.gbif_id = gbifId;
          data.category = this.mapGBIFRankToCategory(gbifData.rank);
          
          // Get vernacular names for common names
          const vernacular = await GBIF_API.getVernacularNames(gbifId);
          if (vernacular.length > 0) {
            data.common_name = vernacular[0].vernacularName;
          }
          
          // Get description
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
          
          // Get conservation status if available
          if (inatData.conservation_status) {
            data.conservation_status = inatData.conservation_status.status_name;
          }
          
          // Get additional info from taxon
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

  // Get species by location for mountain-specific biodiversity
  async getSpeciesByLocation(latitude: number, longitude: number, radius: number = 50): Promise<Partial<Species>[]> {
    try {
      // Get species from both APIs by location
      const [gbifOccurrences, inatObservations] = await Promise.all([
        GBIF_API.getSpeciesByLocation(latitude, longitude, radius, 50),
        INATURALIST_API.getObservationsByLocation(latitude, longitude, radius, 30),
      ]);
      
      const species: Partial<Species>[] = [];
      const seen = new Set<string>();
      
      // Process GBIF occurrences
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
      
      // Process iNaturalist observations
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

  // Map GBIF rank to category (expanded for insects, trees, ferns, herbs, flowers, mushrooms)
  mapGBIFRankToCategory(rank: string): string {
    const rankLower = rank?.toLowerCase() || '';
    if (rankLower.includes('species') || rankLower.includes('specie')) return 'Others';
    if (rankLower.includes('genus')) return 'Plants';
    if (rankLower.includes('family')) return 'Plants';
    if (rankLower.includes('order')) return 'Others';
    if (rankLower.includes('class')) return 'Others';
    return 'Others';
  },

  // Map iNaturalist rank to category (expanded for insects, trees, ferns, herbs, flowers, mushrooms)
  mapINatRankToCategory(rank: string): string {
    const rankLower = rank?.toLowerCase() || '';
    if (rankLower.includes('species')) return 'Others';
    if (rankLower.includes('genus')) return 'Plants';
    if (rankLower.includes('family')) return 'Plants';
    if (rankLower.includes('order')) return 'Others';
    if (rankLower.includes('class')) return 'Others';
    return 'Others';
  },

  // Map taxon name to more specific category
  mapTaxonToCategory(scientificName: string, commonName?: string): string {
    const name = (scientificName + ' ' + (commonName || '')).toLowerCase();
    
    // Insects
    if (name.includes('insect') || name.includes('beetle') || name.includes('butterfly') || 
        name.includes('moth') || name.includes('ant') || name.includes('bee') || 
        name.includes('fly') || name.includes('dragonfly') || name.includes('grasshopper')) {
      return 'Insects';
    }
    
    // Trees
    if (name.includes('tree') || name.includes('oak') || name.includes('pine') || 
        name.includes('maple') || name.includes('palm') || name.includes('cedar') || 
        name.includes('fir') || name.includes('spruce') || name.includes('mahogany')) {
      return 'Trees';
    }
    
    // Ferns
    if (name.includes('fern') || name.includes('pteris') || name.includes('adiantum') || 
        name.includes('nephrolepis') || name.includes('blechnum')) {
      return 'Ferns';
    }
    
    // Herbs
    if (name.includes('herb') || name.includes('mint') || name.includes('basil') || 
        name.includes('oregano') || name.includes('thyme') || name.includes('rosemary')) {
      return 'Herbs';
    }
    
    // Flowers
    if (name.includes('flower') || name.includes('rose') || name.includes('orchid') || 
        name.includes('lily') || name.includes('tulip') || name.includes('sunflower') || 
        name.includes('daisy') || name.includes('jasmine') || name.includes('hibiscus')) {
      return 'Flowers';
    }
    
    // Mushrooms/Fungi
    if (name.includes('mushroom') || name.includes('fungus') || name.includes('agaricus') || 
        name.includes('boletus') || name.includes('amanita') || name.includes('cantharellus')) {
      return 'Mushrooms';
    }
    
    // Birds
    if (name.includes('bird') || name.includes('eagle') || name.includes('hawk') || 
        name.includes('owl') || name.includes('parrot') || name.includes('hornbill')) {
      return 'Birds';
    }
    
    // Mammals
    if (name.includes('mammal') || name.includes('deer') || name.includes('monkey') || 
        name.includes('bat') || name.includes('rodent') || name.includes('civet')) {
      return 'Mammals';
    }
    
    // Reptiles
    if (name.includes('reptile') || name.includes('lizard') || name.includes('snake') || 
        name.includes('turtle') || name.includes('crocodile')) {
      return 'Reptiles';
    }
    
    // Amphibians
    if (name.includes('amphibian') || name.includes('frog') || name.includes('toad') || 
        name.includes('salamander')) {
      return 'Amphibians';
    }
    
    // Default to Plants for plant-like names
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

  // Get image from iNaturalist for a species with fallback to silhouette
  async getSpeciesImage(inatId?: number, gbifId?: number, scientificName?: string): Promise<string | null> {
    try {
      const searchName = scientificName || (gbifId ? (await GBIF_API.getSpeciesById(gbifId))?.scientificName : null);

      if (inatId) {
        const taxon = await INATURALIST_API.getTaxonById(inatId);
        if (taxon) {
          const taxonMatches = this.isTaxonMatch(searchName, taxon);
          if (taxonMatches) {
            const photos = await INATURALIST_API.getTaxonPhotos(inatId);
            if (photos.length > 0) {
              console.log(`[WildTrackAPI] Using iNaturalist photos for matched taxon id=${inatId}, species='${searchName}'`, {
                taxon: taxon.name,
                commonName: taxon.preferred_common_name,
                imageUrl: photos[0],
              });
              return photos[0];
            }
          } else {
            console.log(`[WildTrackAPI] iNaturalist taxon id mismatch for '${searchName}'`, {
              requestedId: inatId,
              taxonName: taxon.name,
              commonName: taxon.preferred_common_name,
            });
          }
        }
      }

      if (searchName) {
        const inatResults = await INATURALIST_API.searchTaxa(searchName, 20);
        console.log(`[WildTrackAPI] iNaturalist search for '${searchName}' returned ${inatResults.length} results`);

        const exactMatch = inatResults.find((taxon: any) => this.isTaxonMatch(searchName, taxon));
        if (exactMatch && exactMatch.default_photo) {
          const imageUrl = exactMatch.default_photo.medium_url || exactMatch.default_photo.url;
          console.log(`[WildTrackAPI] Exact iNaturalist match for '${searchName}' -> taxon='${exactMatch.name}' common='${exactMatch.preferred_common_name}'`, imageUrl);
          return imageUrl;
        }

        const fallback = inatResults.find((taxon: any) => taxon.default_photo && this.isTaxonMatch(searchName, taxon));
        if (fallback) {
          const imageUrl = fallback.default_photo.medium_url || fallback.default_photo.url;
          console.log(`[WildTrackAPI] Fallback iNaturalist match for '${searchName}' -> taxon='${fallback.name}' common='${fallback.preferred_common_name}'`, imageUrl);
          return imageUrl;
        }

        console.log(`[WildTrackAPI] No satisfactory iNaturalist image match for '${searchName}'`);
      }

      return null;
    } catch (error) {
      console.error('Error getting species image:', error);
      return null;
    }
  },

  // Get default silhouette image based on category
  getDefaultSilhouette(category: string): string {
    const categoryLower = category?.toLowerCase() || '';
    
    // Return the local default image
    return require('../../assets/images/wildtrackdefaultimg.png');
  },
};
