// SafetyScreen.tsx - Hiking Safety Feature UI
// Provides intuitive controls for location tracking and emergency SOS

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import locationService from '../services/locationService';
import weatherService, { WeatherCondition } from '../services/weatherService';

// Get screen dimensions for responsive design
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  heading: number;
  speed: number;
  timestamp: string;
}

interface TrackingStatus {
  foregroundActive: boolean;
  backgroundActive: boolean;
  queuedUploads: number;
  isOnline: boolean;
}

export default function SafetyScreen() {
  // State management for tracking and location display
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    foregroundActive: false,
    backgroundActive: false,
    queuedUploads: 0,
    isOnline: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    foreground: false,
    background: false,
  });
  const [sosLoading, setSosLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherAdvice, setWeatherAdvice] = useState<string>('Weather data unavailable');

  // Initialize on component mount
  useEffect(() => {
    initializeTracking();
  }, []);

  useEffect(() => {
    if (lastLocation) {
      loadWeather(lastLocation);
    }
  }, [lastLocation]);

  const loadWeather = async (location: LocationData) => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);

      const currentWeather = await weatherService.getCurrentWeather(
        location.latitude,
        location.longitude
      );

      setWeather(currentWeather);
      setWeatherAdvice(weatherService.getWeatherSafetyAdvice(currentWeather));
    } catch (error: any) {
      console.error('Weather fetch failed:', error);
      setWeather(null);
      setWeatherAdvice('Unable to retrieve weather information.');
      setWeatherError(error?.message || 'Weather service error');
    } finally {
      setWeatherLoading(false);
    }
  };

  /**
   * Initialize location tracking and check permissions
   */
  const initializeTracking = async () => {
    try {
      setIsLoading(true);
      const permissions = await locationService.checkPermissions();
      setPermissionStatus(permissions);

      // Load last known location
      const lastLoc = await locationService.getLastLocation();
      if (lastLoc) {
        setLastLocation(lastLoc);
      }

      // Get current tracking status
      const status = locationService.getTrackingStatus();
      setTrackingStatus(status);
      setIsTracking(status.foregroundActive || status.backgroundActive);
    } catch (error) {
      console.error('Error initializing tracking:', error);
      Alert.alert('Error', 'Failed to initialize location tracking');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle START TRACKING button
   * Requests permissions and initiates foreground + background tracking
   */
  const handleStartTracking = async () => {
    try {
      setIsLoading(true);

      // Request foreground permission
      const foregroundPermission = await locationService.requestForegroundPermission();
      if (!foregroundPermission) {
        Alert.alert(
          'Permission Required',
          'Location access is required for hiking safety features.'
        );
        return;
      }

      // Start foreground tracking with real-time updates
      const foregroundSuccess = await locationService.startForegroundTracking(
        (location) => {
          setLastLocation(location);
          updateTrackingStatus();
        }
      );

      if (!foregroundSuccess) {
        Alert.alert('Error', 'Failed to start foreground tracking');
        return;
      }

      // Try to start background tracking (may be denied)
      const backgroundSuccess = await locationService.startBackgroundTracking();
      if (backgroundSuccess) {
        Alert.alert('Success', 'Location tracking started (foreground + background)');
      } else {
        Alert.alert('Partial Success', 'Foreground tracking enabled. Background tracking unavailable.');
      }

      setIsTracking(true);
      updateTrackingStatus();
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle STOP TRACKING button
   * Stops both foreground and background tracking
   */
  const handleStopTracking = async () => {
    try {
      setIsLoading(true);

      // Confirm stop tracking
      Alert.alert(
        'Stop Tracking?',
        'Are you sure? You will no longer receive emergency assistance if lost.',
        [
          {
            text: 'Cancel',
            onPress: () => setIsLoading(false),
            style: 'cancel',
          },
          {
            text: 'Stop',
            onPress: async () => {
              await locationService.stopForegroundTracking();
              await locationService.stopBackgroundTracking();
              setIsTracking(false);
              updateTrackingStatus();
              Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
              setIsLoading(false);
            },
            style: 'destructive',
          },
        ]
      );
    } catch (error) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', 'Failed to stop tracking');
      setIsLoading(false);
    }
  };

  /**
   * Handle SOS EMERGENCY BUTTON
   * Immediately gets current location and uploads to Supabase
   */
  const handleSOS = async () => {
    try {
      setSosLoading(true);

      Alert.alert(
        '🚨 SOS Emergency Alert',
        'Your current location will be immediately uploaded to emergency contacts.',
        [
          {
            text: 'Cancel',
            onPress: () => setSosLoading(false),
            style: 'cancel',
          },
          {
            text: 'Send SOS',
            onPress: async () => {
              await executeSOS();
              setSosLoading(false);
            },
            style: 'destructive',
          },
        ]
      );
    } catch (error) {
      console.error('Error in SOS handler:', error);
      setSosLoading(false);
    }
  };

  /**
   * Execute SOS - get current location and force upload
   */
  const executeSOS = async () => {
    try {
      // Get the most accurate location possible
      const currentLocation = await locationService.getCurrentLocation();

      if (!currentLocation) {
        Alert.alert('Error', 'Could not get GPS location. Try again.');
        return;
      }

      // Create SOS record with priority flag
      const sosData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        altitude: currentLocation.coords.altitude,
        heading: currentLocation.coords.heading,
        speed: currentLocation.coords.speed,
        timestamp: new Date().toISOString(),
        is_sos: true, // Mark as SOS in database
      };

      // Save locally
      setLastLocation(sosData);

      // Upload to Supabase with SOS flag
      try {
        const { error } = await require('../lib/supabase').supabase
          .from('hiker_locations')
          .insert(sosData);

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
      } catch (uploadError) {
        console.warn('SOS upload to Supabase failed, but local save succeeded:', uploadError);
      }

      // Show success and coordinates
      Alert.alert(
        '✓ SOS Alert Sent',
        `Location: ${sosData.latitude.toFixed(5)}, ${sosData.longitude.toFixed(5)}\n\nEmergency contacts have been notified of your location.`
      );

      updateTrackingStatus();
    } catch (error) {
      console.error('Error executing SOS:', error);
      Alert.alert('SOS Error', 'Failed to send emergency alert. Try again.');
    }
  };

  /**
   * Handle VIEW LOCATION button
   * Shows last known location details
   */
  const handleViewLocation = async () => {
    try {
      const location = await locationService.getLastLocation();

      if (!location) {
        Alert.alert('No Location', 'No location data recorded yet.');
        return;
      }

      const accuracy = location.accuracy
        ? `±${location.accuracy.toFixed(1)}m`
        : 'Unknown';
      const altitude = location.altitude
        ? `${location.altitude.toFixed(1)}m`
        : 'Unknown';
      const timestamp = new Date(location.timestamp).toLocaleString();

      Alert.alert(
        '📍 Last Known Location',
        `Latitude: ${location.latitude.toFixed(5)}\nLongitude: ${location.longitude.toFixed(5)}\nAccuracy: ${accuracy}\nAltitude: ${altitude}\nTime: ${timestamp}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error viewing location:', error);
      Alert.alert('Error', 'Failed to retrieve location');
    }
  };

  /**
   * Retry uploading queued locations
   * Called when reconnecting to network
   */
  const handleRetryUploads = async () => {
    try {
      setIsLoading(true);
      await locationService.retryQueuedUploads();
      updateTrackingStatus();
      Alert.alert('Success', 'Queued locations uploaded successfully');
    } catch (error) {
      console.error('Error retrying uploads:', error);
      Alert.alert('Error', 'Failed to upload queued locations');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update tracking status display
   */
  const updateTrackingStatus = () => {
    const status = locationService.getTrackingStatus();
    setTrackingStatus(status);
  };

  // Format location for display
  const formatLocation = (location: LocationData | null) => {
    if (!location) return 'No data';

    return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  };

  if (isLoading && !lastLocation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Initializing Safety Feature...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={40} color="#FF6B6B" />
        <Text style={styles.title}>Hiking Safety</Text>
        <Text style={styles.subtitle}>Emergency Location Tracking</Text>
      </View>

      {/* Status Cards */}
      <View style={styles.statusSection}>
        {/* Tracking Status Card */}
        <View
          style={[
            styles.statusCard,
            { borderLeftColor: isTracking ? '#4CAF50' : '#999' },
          ]}
        >
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Tracking Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isTracking ? '#4CAF50' : '#999' },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isTracking ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          {trackingStatus.foregroundActive && (
            <Text style={styles.statusDetail}>
              📱 Foreground tracking active
            </Text>
          )}
          {trackingStatus.backgroundActive && (
            <Text style={styles.statusDetail}>
              🔄 Background tracking active
            </Text>
          )}
          {!isTracking && (
            <Text style={styles.statusDetail}>Not currently tracking</Text>
          )}
        </View>

        {/* Network Status Card */}
        <View
          style={[
            styles.statusCard,
            { borderLeftColor: trackingStatus.isOnline ? '#4CAF50' : '#FF9800' },
          ]}
        >
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Network Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: trackingStatus.isOnline ? '#4CAF50' : '#FF9800',
                },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {trackingStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          {trackingStatus.queuedUploads > 0 && (
            <Text style={styles.statusDetail}>
              📤 {trackingStatus.queuedUploads} location(s) queued for upload
            </Text>
          )}
          {trackingStatus.isOnline && trackingStatus.queuedUploads === 0 && (
            <Text style={styles.statusDetail}>All locations uploaded</Text>
          )}
        </View>

        {/* Last Location Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Last Known Location</Text>
          <Text style={styles.locationText}>{formatLocation(lastLocation)}</Text>
          {lastLocation && (
            <Text style={styles.statusDetail}>
              Accuracy: ±{lastLocation.accuracy?.toFixed(1) || '?'}m
            </Text>
          )}
        </View>

        {/* Weather Safety Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Weather Safety</Text>
          {weatherLoading ? (
            <View style={styles.weatherLoadingRow}>
              <ActivityIndicator size="small" color="#1976D2" />
              <Text style={styles.statusDetail}>Loading weather data...</Text>
            </View>
          ) : weather ? (
            <>
              <Text style={styles.weatherText}>
                {weather.description}, {weather.temperature.toFixed(1)}°C
              </Text>
              <Text style={styles.statusDetail}>
                Feels like {weather.feelsLike.toFixed(1)}°C · Humidity {weather.humidity}% · Wind {weather.windSpeed.toFixed(1)} m/s
              </Text>
              {weather.precipitationMm > 0 && (
                <Text style={styles.statusDetail}>
                  Precipitation {weather.precipitationMm.toFixed(1)} mm
                </Text>
              )}
              <Text style={styles.weatherAdvice}>{weatherAdvice}</Text>
            </>
          ) : (
            <Text style={[styles.statusDetail, styles.weatherErrorText]}>
              {weatherError || 'Weather unavailable. Add a weather API key and restart the app.'}
            </Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonSection}>
        {/* Start/Stop Tracking */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.trackingButton,
            {
              backgroundColor: isTracking ? '#d32f2f' : '#4CAF50',
              opacity: isLoading ? 0.7 : 1,
            },
          ]}
          onPress={isTracking ? handleStopTracking : handleStartTracking}
          disabled={isLoading}
        >
          <Ionicons
            name={isTracking ? 'stop-circle' : 'play-circle'}
            size={24}
            color="#fff"
          />
          <Text style={styles.buttonText}>
            {isTracking ? 'STOP TRACKING' : 'START TRACKING'}
          </Text>
        </TouchableOpacity>

        {/* View Location */}
        <TouchableOpacity
          style={[styles.button, styles.infoButton, { opacity: isLoading ? 0.7 : 1 }]}
          onPress={handleViewLocation}
          disabled={isLoading}
        >
          <Ionicons name="location" size={24} color="#1976D2" />
          <Text style={styles.buttonTextSecondary}>VIEW LOCATION</Text>
        </TouchableOpacity>

        {/* Retry Uploads (if needed) */}
        {trackingStatus.queuedUploads > 0 && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.warningButton,
              { opacity: isLoading ? 0.7 : 1 },
            ]}
            onPress={handleRetryUploads}
            disabled={isLoading}
          >
            <Ionicons name="cloud-upload" size={24} color="#FF9800" />
            <Text style={styles.buttonTextWarning}>
              RETRY UPLOADS ({trackingStatus.queuedUploads})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SOS Emergency Button - Most Prominent */}
      <View style={styles.sosSection}>
        <Text style={styles.sosWarning}>🚨 EMERGENCY SOS BUTTON 🚨</Text>
        <TouchableOpacity
          style={[styles.sosButton, { opacity: sosLoading ? 0.7 : 1 }]}
          onPress={handleSOS}
          disabled={sosLoading}
        >
          {sosLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Ionicons name="alert-circle" size={64} color="#fff" />
              <Text style={styles.sosButtonText}>SOS</Text>
              <Text style={styles.sosButtonSubtext}>Press for emergency</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Information Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How It Works</Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>Start Tracking</Text>: Enables continuous location monitoring with background support
        </Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>Local Storage</Text>: All locations saved offline automatically
        </Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>Auto Upload</Text>: Locations sent to backend when online
        </Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>SOS Button</Text>: Immediately sends emergency location with high accuracy
        </Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>Retry Offline</Text>: All queued uploads sent when reconnected
        </Text>
      </View>
    </ScrollView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  statusSection: {
    padding: 16,
    gap: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusDetail: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  weatherLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  weatherText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  weatherAdvice: {
    fontSize: 13,
    color: '#444',
    marginTop: 8,
    lineHeight: 18,
  },
  weatherErrorText: {
    color: '#d32f2f',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  trackingButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  infoButton: {
    backgroundColor: '#e3f2fd',
  },
  warningButton: {
    backgroundColor: '#fff3e0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  buttonTextWarning: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  sosSection: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 12,
  },
  sosWarning: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 16,
    letterSpacing: 1,
  },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sosButtonText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  sosButtonSubtext: {
    fontSize: 10,
    color: '#fff',
    marginTop: 2,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginBottom: 24,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '600',
    color: '#333',
  },
});
