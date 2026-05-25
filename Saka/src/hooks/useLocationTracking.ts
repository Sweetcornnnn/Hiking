// useLocationTracking.ts - Custom React hook for location tracking
// Simplifies integration of location tracking into any component

import { useState, useEffect, useCallback } from 'react';
import locationService from '../services/locationService';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface TrackingStatus {
  isTracking: boolean;
  isForegroundActive: boolean;
  isBackgroundActive: boolean;
  queuedUploads: number;
  isOnline: boolean;
}

export interface UseLocationTrackingReturn {
  // State
  lastLocation: LocationData | null;
  trackingStatus: TrackingStatus;
  isLoading: boolean;
  permissions: { foreground: boolean; background: boolean };

  // Actions
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  startBackgroundTracking: () => Promise<boolean>;
  stopBackgroundTracking: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  getSOS: () => Promise<LocationData | null>;
  getLocationHistory: () => Promise<LocationData[]>;
  retryUploads: () => Promise<void>;
}

/**
 * Custom React hook for location tracking
 * 
 * Usage:
 * ```typescript
 * const {
 *   lastLocation,
 *   trackingStatus,
 *   startTracking,
 *   stopTracking,
 *   getSOS
 * } = useLocationTracking();
 * ```
 */
export function useLocationTracking(): UseLocationTrackingReturn {
  // State
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    isTracking: false,
    isForegroundActive: false,
    isBackgroundActive: false,
    queuedUploads: 0,
    isOnline: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [permissions, setPermissions] = useState({
    foreground: false,
    background: false,
  });

  // Initialize on mount
  useEffect(() => {
    initializeTracking();

    // Set up interval to refresh status
    const statusInterval = setInterval(refreshStatus, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  /**
   * Initialize tracking on component mount
   */
  const initializeTracking = useCallback(async () => {
    try {
      // Check current permissions
      const perms = await locationService.checkPermissions();
      setPermissions(perms);

      // Load last known location
      const lastLoc = await locationService.getLastLocation();
      if (lastLoc) {
        setLastLocation(lastLoc);
      }

      // Get tracking status
      refreshStatus();
    } catch (error) {
      console.error('Error initializing tracking:', error);
    }
  }, []);

  /**
   * Refresh tracking status display
   */
  const refreshStatus = useCallback(() => {
    const status = locationService.getTrackingStatus();
    setTrackingStatus({
      isTracking: status.foregroundActive || status.backgroundActive,
      isForegroundActive: status.foregroundActive,
      isBackgroundActive: status.backgroundActive,
      queuedUploads: status.queuedUploads,
      isOnline: status.isOnline,
    });
  }, []);

  /**
   * Start foreground location tracking
   */
  const startTracking = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      const success = await locationService.startForegroundTracking((location) => {
        setLastLocation(location);
        refreshStatus();
      });

      if (success) {
        refreshStatus();
      }

      return success;
    } catch (error) {
      console.error('Error starting tracking:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  /**
   * Stop foreground location tracking
   */
  const stopTracking = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await locationService.stopForegroundTracking();
      refreshStatus();
    } catch (error) {
      console.error('Error stopping tracking:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  /**
   * Start background location tracking
   */
  const startBackgroundTracking = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await locationService.startBackgroundTracking();
      if (success) {
        refreshStatus();
      }
      return success;
    } catch (error) {
      console.error('Error starting background tracking:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  /**
   * Stop background location tracking
   */
  const stopBackgroundTracking = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await locationService.stopBackgroundTracking();
      refreshStatus();
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  /**
   * Request location permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Request foreground first
      const foregroundPerm = await locationService.requestForegroundPermission();

      // Then background if foreground granted
      let backgroundPerm = false;
      if (foregroundPerm) {
        backgroundPerm = await locationService.requestBackgroundPermission();
      }

      const perms = { foreground: foregroundPerm, background: backgroundPerm };
      setPermissions(perms);

      return foregroundPerm;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get current location immediately (for SOS)
   */
  const getSOS = useCallback(async (): Promise<LocationData | null> => {
    try {
      setIsLoading(true);
      const location = await locationService.getCurrentLocation();

      if (location) {
        const sosData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: new Date().toISOString(),
        };

        setLastLocation(sosData);
        return sosData;
      }

      return null;
    } catch (error) {
      console.error('Error getting SOS location:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get location history
   */
  const getLocationHistory = useCallback(
    async (): Promise<LocationData[]> => {
      try {
        return await locationService.getLocationHistory();
      } catch (error) {
        console.error('Error getting location history:', error);
        return [];
      }
    },
    []
  );

  /**
   * Retry queued uploads
   */
  const retryUploads = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await locationService.retryQueuedUploads();
      refreshStatus();
    } catch (error) {
      console.error('Error retrying uploads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  return {
    // State
    lastLocation,
    trackingStatus,
    isLoading,
    permissions,

    // Actions
    startTracking,
    stopTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
    requestPermissions,
    getSOS,
    getLocationHistory,
    retryUploads,
  };
}

export default useLocationTracking;
