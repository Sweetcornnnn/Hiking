import { useCallback, useState } from 'react';
import { GBIFService } from '../services/gbifService';
import { INaturalistService } from '../services/inaturalistService';
import { OccurrenceRecord } from '../types/wildtrack';

export const useOccurrenceData = () => {
  const [records, setRecords] = useState<OccurrenceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOccurrenceData = useCallback(async (gbifId?: number, inatId?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const [gbifRecords, inatRecords] = await Promise.all([
        gbifId ? GBIFService.getSpeciesOccurrences(gbifId, 18) : Promise.resolve([]),
        inatId ? INaturalistService.getObservations(inatId, 18) : Promise.resolve([]),
      ]);
      const combined = [...gbifRecords, ...inatRecords].slice(0, 24);
      setRecords(combined);
      return combined;
    } catch (loadError) {
      console.error('[useOccurrenceData] loadOccurrenceData error', loadError);
      setError('Unable to load occurrence records.');
      setRecords([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recentSummary = useCallback(() => {
    const sorted = [...records].sort((a, b) => {
      return new Date(b.recordedAt || '').getTime() - new Date(a.recordedAt || '').getTime();
    });
    return {
      total: records.length,
      latest: sorted[0]?.recordedAt,
      firstLocation: sorted[0]?.locality || sorted[0]?.country,
      philippinePoints: records.filter((record) => record.country?.toLowerCase().includes('philippines')).length,
    };
  }, [records]);

  return {
    records,
    isLoading,
    error,
    loadOccurrenceData,
    recentSummary: recentSummary(),
  };
};
