// locationService.js - Comprehensive location tracking service for hiking safety
// Handles permissions, foreground/background tracking, local storage, and Supabase uploads

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Background task name for continuous location tracking
const BACKGROUND_LOCATION_TASK_NAME = 'HIKING_SAFETY_BACKGROUND_LOCATION_TASK';

// Storage keys for persisting location data
const LAST_LOCATION_KEY = 'HIKING_LAST_LOCATION';
const LOCATION_HISTORY_KEY = 'HIKING_LOCATION_HISTORY';
const LOCATION_UPLOAD_QUEUE_KEY = 'HIKING_LOCATION_UPLOAD_QUEUE';
const LOCATION_ACTIVITY_STATE_KEY = 'HIKING_LOCATION_ACTIVITY_STATE';
const STATIONARY_RADIUS_METERS = 20;
const STATIONARY_SAMPLE_COUNT = 3;
const STATIONARY_DURATION_MS = 10 * 60 * 1000;

function getDistanceMeters(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(second.latitude - first.latitude);
  const longitudeDifference = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * 6371000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getLocationUploadErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const fields = ['message', 'code', 'details', 'hint', 'status', 'statusCode'];
    const details = {};
    for (const field of fields) {
      if (error[field] !== undefined && error[field] !== null) {
        details[field] = error[field];
      }
    }
    if (Object.keys(details).length > 0) return JSON.stringify(details);
    try {
      return JSON.stringify(error);
    } catch {
      return 'An unknown upload error occurred.';
    }
  }
  return String(error);
}

/**
 * LocationService - Manages all aspects of location tracking
 * Provides foreground and background location updates with offline support
 */
class LocationService {
  constructor() {
    this.locationUpdates = [];
    this.isTrackingForeground = false;
    this.isTrackingBackground = false;
    this.trackingSubscription = null;
    this.trackingCallback = null;
    this.foregroundTrackingMode = null;
    this.foregroundModeChange = null;
    this.uploadQueue = [];
    this.uploadQueueLoaded = false;
    this.uploadQueueLoad = null;
    this.uploadQueueProcessing = null;
    this.activityState = null;
    this.activityStateLoad = null;
    this.isOnline = true;
  }

  async _loadActivityState() {
    if (this.activityState) return this.activityState;
    if (!this.activityStateLoad) {
      this.activityStateLoad = (async () => {
        try {
          const storedState = await AsyncStorage.getItem(LOCATION_ACTIVITY_STATE_KEY);
          this.activityState = storedState
            ? JSON.parse(storedState)
            : { anchor: null, sampleCount: 0, stationarySince: null, stationary: false };
        } catch (error) {
          console.error('[Location] Failed to load stationary-tracking state:', error);
          this.activityState = {
            anchor: null,
            sampleCount: 0,
            stationarySince: null,
            stationary: false,
          };
        } finally {
          this.activityStateLoad = null;
        }
      })();
    }
    await this.activityStateLoad;
    return this.activityState;
  }

  async _updateActivityState(locationData) {
    const state = await this._loadActivityState();
    const previousStationary = state.stationary;
    const currentPoint = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    };
    const timestamp = Date.parse(locationData.timestamp);

    if (!state.anchor || getDistanceMeters(state.anchor, currentPoint) > STATIONARY_RADIUS_METERS) {
      this.activityState = {
        anchor: currentPoint,
        sampleCount: 1,
        stationarySince: timestamp,
        stationary: false,
      };
    } else {
      state.sampleCount += 1;
      if (state.sampleCount >= STATIONARY_SAMPLE_COUNT &&
          timestamp - state.stationarySince >= STATIONARY_DURATION_MS) {
        state.stationary = true;
      }
      this.activityState = state;
    }

    try {
      await AsyncStorage.setItem(
        LOCATION_ACTIVITY_STATE_KEY,
        JSON.stringify(this.activityState)
      );
    } catch (error) {
      console.error('[Location] Failed to save stationary-tracking state:', error);
    }

    return {
      stationary: this.activityState.stationary,
      becameStationary: !previousStationary && this.activityState.stationary,
      resumedMovement: previousStationary && !this.activityState.stationary,
    };
  }

  async _loadUploadQueue() {
    if (this.uploadQueueLoaded) return;
    if (!this.uploadQueueLoad) {
      this.uploadQueueLoad = (async () => {
        try {
          const queueJson = await AsyncStorage.getItem(LOCATION_UPLOAD_QUEUE_KEY);
          const queue = queueJson ? JSON.parse(queueJson) : [];
          this.uploadQueue = Array.isArray(queue) ? queue : [];
        } catch (error) {
          console.error('Error loading location upload queue:', error);
          this.uploadQueue = [];
        } finally {
          this.uploadQueueLoaded = true;
          this.uploadQueueLoad = null;
        }
      })();
    }
    await this.uploadQueueLoad;
  }

  async _persistUploadQueue() {
    try {
      await AsyncStorage.setItem(
        LOCATION_UPLOAD_QUEUE_KEY,
        JSON.stringify(this.uploadQueue)
      );
    } catch (error) {
      console.error('Error persisting location upload queue:', error);
    }
  }

  /**
   * Request foreground location permission
   * Called when user initiates location tracking
   * @returns {Promise<boolean>} - true if permission granted
   */
  async requestForegroundPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        console.log('✓ Foreground location permission granted');
        return true;
      } else {
        console.warn('✗ Foreground location permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting foreground permission:', error);
      return false;
    }
  }

  /**
   * Request background location permission
   * iOS requires Always permission; Android requires Background permission
   * @returns {Promise<boolean>} - true if permission granted
   */
  async requestBackgroundPermission() {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        console.log('✓ Background location permission granted');
        return true;
      } else {
        console.warn('✗ Background location permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting background permission:', error);
      return false;
    }
  }

  /**
   * Check current location permissions
   * @returns {Promise<Object>} - Object with foreground and background permission status
   */
  async checkPermissions() {
    try {
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();

      return {
        foreground: foregroundStatus?.status === 'granted',
        background: backgroundStatus?.status === 'granted',
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { foreground: false, background: false };
    }
  }

  /**
   * Start foreground location tracking
   * Updates location in real-time with high accuracy
   * @param {Function} callback - Called with each location update
   * @returns {Promise<boolean>} - true if tracking started successfully
   */
  async startForegroundTracking(callback) {
    try {
      // Verify we have permission
      const hasPermission = await this.requestForegroundPermission();
      if (!hasPermission) {
        throw new Error('Foreground location permission not granted');
      }

      // Stop any existing subscription
      if (this.trackingSubscription) {
        this.trackingSubscription.remove();
      }

      this.trackingCallback = callback;
      const activityState = await this._loadActivityState();
      const initialMode = activityState.stationary ? 'stationary' : 'active';
      this.foregroundTrackingMode = initialMode;
      this.trackingSubscription = await this._createForegroundSubscription(initialMode);
      this.isTrackingForeground = true;
      console.log('✓ Foreground location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting foreground tracking:', error);
      return false;
    }
  }

  /**
   * Stop foreground location tracking
   */
  async stopForegroundTracking() {
    try {
      if (this.trackingSubscription) {
        this.trackingSubscription.remove();
        this.trackingSubscription = null;
      }
      this.trackingCallback = null;
      this.foregroundTrackingMode = null;
      this.isTrackingForeground = false;
      console.log('✓ Foreground location tracking stopped');
    } catch (error) {
      console.error('Error stopping foreground tracking:', error);
    }
  }

  /**
   * Initialize background location tracking
   * Requires background permission and setup of background task
   * @returns {Promise<boolean>} - true if background tracking initialized
   */
  async startBackgroundTracking() {
    try {
      // Request background permission
      const hasPermission = await this.requestBackgroundPermission();
      if (!hasPermission) {
        console.warn('Background permission not granted, continuing without background tracking');
        return false;
      }

      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
      }

      await Location.startLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK_NAME,
        {
          accuracy: Location.Accuracy.Balanced, // More battery efficient than BestForNavigation
          timeInterval: 30000, // Update every 30 seconds in background
          distanceInterval: 50, // Or when moved 50 meters
          mayShowUserSettingsDialog: true, // Allow user to adjust settings
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'SAKA location tracking is active',
            notificationBody: 'Your hike location is being recorded for safety.',
            notificationColor: '#C9A96E',
            killServiceOnDestroy: false,
          },
        }
      );

      this.isTrackingBackground = true;
      console.log('✓ Background location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting background tracking:', error);
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopBackgroundTracking() {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
      }

      this.isTrackingBackground = false;
      console.log('✓ Background location tracking stopped');
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }

  /**
   * Get the user's current location immediately
   * Useful for SOS button and on-demand location requests
   * @returns {Promise<Object|null>} - Location object or null if error
   */
  async getCurrentLocation() {
    try {
      const hasPermission = await this.requestForegroundPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Get high accuracy location with timeout
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
        timeoutMillis: 10000, // 10 second timeout
      });

      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async _createForegroundSubscription(mode) {
    const options = mode === 'stationary'
      ? {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000,
          distanceInterval: 25,
        }
      : {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
        };

    return Location.watchPositionAsync(options, (location) => {
      void this._handleLocationUpdate(location, this.trackingCallback);
    });
  }

  async _setForegroundTrackingMode(mode) {
    if (!this.isTrackingForeground || this.foregroundTrackingMode === mode) return;
    if (this.foregroundModeChange) {
      await this.foregroundModeChange;
      if (!this.isTrackingForeground || this.foregroundTrackingMode === mode) return;
    }

    this.foregroundModeChange = (async () => {
      const previousMode = this.foregroundTrackingMode || 'active';
      this.trackingSubscription?.remove();
      this.trackingSubscription = null;
      try {
        this.trackingSubscription = await this._createForegroundSubscription(mode);
        this.foregroundTrackingMode = mode;
      } catch (error) {
        console.error(`[Location] Could not switch to ${mode} tracking mode:`, error);
        try {
          this.trackingSubscription = await this._createForegroundSubscription(previousMode);
          this.foregroundTrackingMode = previousMode;
        } catch (restoreError) {
          this.isTrackingForeground = false;
          console.error('[Location] Could not restore foreground tracking:', restoreError);
        }
      }
    })();

    try {
      await this.foregroundModeChange;
    } finally {
      this.foregroundModeChange = null;
    }
  }

  /**
   * Internal handler for location updates
   * Saves to local storage and queues for upload to Supabase
   * @private
   */
  async _handleLocationUpdate(location, callback) {
    try {
      // Extract location data with timestamp
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: new Date().toISOString(),
      };

      const activity = await this._updateActivityState(locationData);
      if (activity.becameStationary) {
        await this._setForegroundTrackingMode('stationary');
      } else if (activity.resumedMovement) {
        await this._setForegroundTrackingMode('active');
      }

      // Save as last known location
      await AsyncStorage.setItem(
        LAST_LOCATION_KEY,
        JSON.stringify(locationData)
      );

      if (!activity.stationary) {
        // Keep routine history and uploads focused on movement.
        await this._addToLocationHistory(locationData);
        await this._queueLocationUpload(locationData);
      }

      // Call callback if provided (for real-time UI updates)
      if (callback) {
        callback(locationData);
      }

      if (activity.becameStationary) {
        console.log('[Location] Stationary for 10 minutes; routine location history and uploads paused.');
      } else if (activity.resumedMovement) {
        console.log('[Location] Movement detected; routine location history and uploads resumed.');
      } else if (!activity.stationary) {
        console.log('📍 Location updated and saved to device.');
      }
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  /**
   * Add location to local history
   * Maintains offline record of all tracked locations
   * @private
   */
  async _addToLocationHistory(locationData) {
    try {
      const historyJson = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
      let history = historyJson ? JSON.parse(historyJson) : [];

      // Keep only last 100 locations to manage storage
      if (history.length >= 100) {
        history = history.slice(-99);
      }

      history.push(locationData);
      await AsyncStorage.setItem(
        LOCATION_HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch (error) {
      console.error('Error adding to location history:', error);
    }
  }

  /**
   * Queue location for upload to Supabase
   * Handles offline scenarios by persisting queue to AsyncStorage
   * @private
   */
  async _queueLocationUpload(locationData) {
    try {
      await this._loadUploadQueue();
      // Add to memory queue
      this.uploadQueue.push(locationData);
      await this._persistUploadQueue();

      // Immediately try to upload
      await this._processUploadQueue();
    } catch (error) {
      console.error('Error queuing location upload:', error);
    }
  }

  /**
   * Process upload queue - attempts to upload to Supabase
   * Retries if offline, maintains queue for later attempts
   * @private
   */
  async _processUploadQueue() {
    if (this.uploadQueueProcessing) return this.uploadQueueProcessing;

    const processing = (async () => {
      await this._loadUploadQueue();
      let uploaded = 0;

      if (this.uploadQueue.length === 0) {
        return { uploaded, remaining: 0, error: null };
      }

      let session;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        session = data.session;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[Location] Upload queue could not be synced:', message);
        this.isOnline = false;
        return { uploaded, remaining: this.uploadQueue.length, error: message };
      }
      if (!session?.user) {
        const message = 'Sign in to sync saved locations.';
        console.warn('[Location] Upload queue could not be synced:', message);
        this.isOnline = false;
        return { uploaded, remaining: this.uploadQueue.length, error: message };
      }

      while (this.uploadQueue.length > 0) {
        const locationData = this.uploadQueue[0];

        try {
          const { error } = await supabase
            .from('hiker_locations')
            .insert({
              user_id: locationData.user_id || session.user.id,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              altitude: locationData.altitude,
              heading: locationData.heading,
              speed: locationData.speed,
              timestamp: locationData.timestamp,
            });

          if (error) throw error;

          this.uploadQueue.shift();
          await this._persistUploadQueue();
          uploaded += 1;
        } catch (error) {
          const message = getLocationUploadErrorMessage(error);
          console.warn('[Location] Upload failed; keeping locations queued for retry:', message);
          this.isOnline = false;
          await this._persistUploadQueue();
          return { uploaded, remaining: this.uploadQueue.length, error: message };
        }
      }

      this.isOnline = true;
      return { uploaded, remaining: 0, error: null };
    })();

    this.uploadQueueProcessing = processing;
    try {
      return await processing;
    } finally {
      this.uploadQueueProcessing = null;
    }
  }

  async initializeTrackingState() {
    try {
      this.isTrackingBackground = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK_NAME
      );
    } catch (error) {
      console.error('[Location] Failed to restore background tracking status:', error);
      this.isTrackingBackground = false;
    }
    await this._loadUploadQueue();
  }

  /**
   * Manually trigger upload of queued locations
   * Called when network reconnects or manually by user
   */
  async retryQueuedUploads() {
    await this._loadUploadQueue();
    return this._processUploadQueue();
  }

  /**
   * Get last known location from storage
   * @returns {Promise<Object|null>} - Last location or null
   */
  async getLastLocation() {
    try {
      const locationJson = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      return locationJson ? JSON.parse(locationJson) : null;
    } catch (error) {
      console.error('Error retrieving last location:', error);
      return null;
    }
  }

  async saveLocationLocally(locationData) {
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(locationData));
    await this._addToLocationHistory(locationData);
  }

  /**
   * Get location history from storage
   * @returns {Promise<Array>} - Array of location objects
   */
  async getLocationHistory() {
    try {
      const historyJson = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Error retrieving location history:', error);
      return [];
    }
  }

  /**
   * Clear all location data from storage
   * Use with caution - deletes historical tracking data
   */
  async clearLocationData() {
    try {
      await this._loadUploadQueue();
      await AsyncStorage.removeItem(LAST_LOCATION_KEY);
      await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
      await AsyncStorage.removeItem(LOCATION_UPLOAD_QUEUE_KEY);
      this.uploadQueue = [];
      console.log('✓ Location data cleared');
    } catch (error) {
      console.error('Error clearing location data:', error);
    }
  }

  /**
   * Get current tracking status
   * @returns {Object} - Status object with tracking states
   */
  getTrackingStatus() {
    return {
      foregroundActive: this.isTrackingForeground,
      backgroundActive: this.isTrackingBackground,
      queuedUploads: this.uploadQueue.length,
      isOnline: this.isOnline,
    };
  }
}

// Export singleton instance
export const locationService = new LocationService();

TaskManager.defineTask(BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Location] Background task failed:', error);
    return;
  }

  const locations = data?.locations;
  if (!Array.isArray(locations) || locations.length === 0) return;

  // Foreground watchPositionAsync handles live UI updates while the app is open.
  if (AppState.currentState === 'active' && locationService.isTrackingForeground) return;

  await locationService._handleLocationUpdate(locations[locations.length - 1], null);
});

export default locationService;
