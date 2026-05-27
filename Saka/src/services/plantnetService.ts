import { SpeciesSearchResult } from '../types/wildtrack';

const BASE_URL = 'https://my-api.plantnet.org/v2';

export const PlantNetService = {
  async searchPlants(query: string, limit: number = 10): Promise<SpeciesSearchResult[]> {
    try {
      return [];
    } catch (error) {
      console.error('[PlantNetService] searchPlants error', error);
      return [];
    }
  },

  async identifyPlantImage(imageBase64: string): Promise<SpeciesSearchResult | null> {
    try {
      return null;
    } catch (error) {
      console.error('[PlantNetService] identifyPlantImage error', error);
      return null;
    }
  },
};
