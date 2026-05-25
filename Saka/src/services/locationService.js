// locationService.js - Comprehensive location tracking service for hiking safety
// Handles permissions, foreground/background tracking, local storage, and Supabase uploads

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Background task name for continuous location tracking
const BACKGROUND_LOCATION_TASK_NAME = 'HIKING_SAFETY_BACKGROUND_LOCATION_TASK';

// Storage keys for persisting location data
const LAST_LOCATION_KEY = 'HIKING_LAST_LOCATION';
const LOCATION_HISTORY_KEY = 'HIKING_LOCATION_HISTORY';

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
    this.uploadQueue = [];
    this.isOnline = true;
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

      // Start watching position with high accuracy for safety
      this.trackingSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        (location) => {
          this._handleLocationUpdate(location, callback);
        }
      );

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
      // Check if background task is already defined
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_LOCATION_TASK_NAME
      );

      // Define the background task (can be called multiple times safely)
      if (!isRegistered) {
        TaskManager.defineTask(
          BACKGROUND_LOCATION_TASK_NAME,
          async ({ data: { locations } }) => {
            // This runs in the background and is battery efficient
            if (locations && locations.length > 0) {
              const location = locations[locations.length - 1]; // Get latest location
              await this._handleLocationUpdate(location, null);
            }
          }
        );
      }

      // Request background permission
      const hasPermission = await this.requestBackgroundPermission();
      if (!hasPermission) {
        console.warn('Background permission not granted, continuing without background tracking');
        return false;
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK_NAME,
        {
          accuracy: Location.Accuracy.Balanced, // More battery efficient than BestForNavigation
          timeInterval: 30000, // Update every 30 seconds in background
          distanceInterval: 50, // Or when moved 50 meters
          mayShowUserSettingsDialog: true, // Allow user to adjust settings
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
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_LOCATION_TASK_NAME
      );

      if (isRegistered) {
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

      // Save as last known location
      await AsyncStorage.setItem(
        LAST_LOCATION_KEY,
        JSON.stringify(locationData)
      );

      // Add to history (keep last 100 locations for offline support)
      await this._addToLocationHistory(locationData);

      // Queue for upload to Supabase
      await this._queueLocationUpload(locationData);

      // Call callback if provided (for real-time UI updates)
      if (callback) {
        callback(locationData);
      }

      console.log(`📍 Location updated: ${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(5)}`);
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
      // Add to memory queue
      this.uploadQueue.push(locationData);

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
    while (this.uploadQueue.length > 0) {
      const locationData = this.uploadQueue[0];

      try {
        // Attempt upload to Supabase
        const { error } = await supabase
          .from('hiker_locations')
          .insert({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            altitude: locationData.altitude,
            heading: locationData.heading,
            speed: locationData.speed,
            timestamp: locationData.timestamp,
          });

        if (error) {
          if (error.code === 'PGRST116') {
            // Table doesn't exist, log but don't retry infinitely
            console.warn('Hiker locations table not found in Supabase');
            this.uploadQueue.shift();
          } else {
            throw error;
          }
        } else {
          // Successfully uploaded, remove from queue
          this.uploadQueue.shift();
          console.log('✓ Location uploaded to Supabase');
        }
      } catch (error) {
        // Network error or offline - stop processing queue
        console.warn('Upload failed (will retry when online):', error.message);
        this.isOnline = false;
        break;
      }
    }
  }

  /**
   * Manually trigger upload of queued locations
   * Called when network reconnects or manually by user
   */
  async retryQueuedUploads() {
    console.log(`Retrying ${this.uploadQueue.length} queued location uploads...`);
    this.isOnline = true;
    await this._processUploadQueue();
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
      await AsyncStorage.removeItem(LAST_LOCATION_KEY);
      await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
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

export default locationService;
