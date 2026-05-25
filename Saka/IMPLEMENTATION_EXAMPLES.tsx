// IMPLEMENTATION_EXAMPLES.tsx
// Complete examples of how to integrate hiking safety into your app

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import SafetyScreen from '../src/screens/SafetyScreen';
import { useLocationTracking } from '../src/hooks/useLocationTracking';
import locationService from '../src/services/locationService';
import {
  calculateDistance,
  formatLocation,
  getAccuracyLevel,
} from '../src/config/locationApi';

// ============================================================================
// EXAMPLE 1: Add SafetyScreen to Drawer Navigation
// ============================================================================
/*
In your drawer navigation file (e.g., app/drawer/_layout.tsx):

import { Drawer } from 'expo-router/drawer';
import SafetyScreen from '../src/screens/SafetyScreen';
import { Ionicons } from '@expo/vector-icons';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FF6B6B' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{
          title: 'Home',
          drawerLabel: 'Home',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="safety"
        component={SafetyScreen}
        options={{
          title: 'Hiking Safety',
          drawerLabel: '🚨 Safety - IMPORTANT',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
          headerStyle: { backgroundColor: '#FF6B6B' },
        }}
      />
    </Drawer>
  );
}
*/

// ============================================================================
// EXAMPLE 2: Minimal Integration Component
// ============================================================================

/**
 * Simple hiking safety widget to add to home screen
 * Shows quick access to start tracking and SOS
 */
export function HikingSafetyWidget() {
  const { trackingStatus, startTracking, getSOS, isLoading } =
    useLocationTracking();

  const handleQuickStart = async () => {
    const success = await startTracking();
    if (success) {
      Alert.alert('Success', 'Hiking safety tracking started!');
    } else {
      Alert.alert(
        'Permission Needed',
        'Please grant location permission in Settings'
      );
    }
  };

  const handleQuickSOS = async () => {
    Alert.alert(
      '🚨 SOS Emergency',
      'Send emergency alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          onPress: getSOS,
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>Safety Status</Text>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: trackingStatus.isTracking
                ? '#4CAF50'
                : '#999',
            },
          ]}
        />
      </View>

      <Text style={styles.widgetStatus}>
        {trackingStatus.isTracking ? 'Tracking Active' : 'Tracking Inactive'}
      </Text>

      <View style={styles.widgetButtons}>
        <TouchableOpacity
          style={[styles.widgetBtn, styles.startBtn]}
          onPress={handleQuickStart}
          disabled={isLoading}
        >
          <Text style={styles.widgetBtnText}>
            {trackingStatus.isTracking ? 'Already On' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.widgetBtn, styles.sosBtn]}
          onPress={handleQuickSOS}
          disabled={isLoading}
        >
          <Text style={styles.widgetBtnText}>🚨 SOS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// EXAMPLE 3: Advanced Tracking Monitor Component
// ============================================================================

/**
 * Advanced component showing detailed tracking information
 * Useful for debugging or detailed status display
 */
export function AdvancedTrackingMonitor() {
  const { lastLocation, trackingStatus, retryUploads, isLoading } =
    useLocationTracking();
  const [statistics, setStatistics] = React.useState({
    totalLocations: 0,
    distanceTraveled: 0,
    timeTracking: '0:00',
  });

  React.useEffect(() => {
    updateStatistics();
    const interval = setInterval(updateStatistics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const updateStatistics = async () => {
    try {
      const history = await locationService.getLocationHistory();
      setStatistics((prev) => ({
        ...prev,
        totalLocations: history.length,
      }));

      // Calculate distance if enough points
      if (history.length > 1) {
        let distance = 0;
        for (let i = 1; i < history.length; i++) {
          distance += calculateDistance(
            history[i - 1].latitude,
            history[i - 1].longitude,
            history[i].latitude,
            history[i].longitude
          );
        }
        setStatistics((prev) => ({
          ...prev,
          distanceTraveled: distance,
        }));
      }
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  };

  return (
    <ScrollView style={styles.monitor}>
      <View style={styles.monitorSection}>
        <Text style={styles.monitorTitle}>Live Tracking Data</Text>

        {/* Current Location */}
        <View style={styles.dataCard}>
          <Text style={styles.dataLabel}>Current Location</Text>
          {lastLocation ? (
            <>
              <Text style={styles.dataValue}>
                {formatLocation(lastLocation)}
              </Text>
              <View style={styles.accuracyRow}>
                <Text style={styles.accuracyText}>
                  Accuracy: ±{lastLocation.accuracy?.toFixed(1) || '?'}m
                </Text>
                <Text
                  style={[
                    styles.accuracyLevel,
                    {
                      color:
                        getAccuracyLevel(lastLocation.accuracy) === 'Excellent'
                          ? '#4CAF50'
                          : getAccuracyLevel(lastLocation.accuracy) === 'Good'
                            ? '#8BC34A'
                            : '#FF9800',
                    },
                  ]}
                >
                  {getAccuracyLevel(lastLocation.accuracy)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noData}>No location data yet</Text>
          )}
        </View>

        {/* Tracking Statistics */}
        <View style={styles.dataCard}>
          <Text style={styles.dataLabel}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {statistics.totalLocations}
              </Text>
              <Text style={styles.statLabel}>Locations</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {statistics.distanceTraveled.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {trackingStatus.queuedUploads}
              </Text>
              <Text style={styles.statLabel}>Queued</Text>
            </View>
          </View>
        </View>

        {/* Status Indicators */}
        <View style={styles.dataCard}>
          <Text style={styles.dataLabel}>Status</Text>
          <View style={styles.statusGrid}>
            <StatusIndicator
              label="Foreground"
              active={trackingStatus.isForegroundActive}
            />
            <StatusIndicator
              label="Background"
              active={trackingStatus.isBackgroundActive}
            />
            <StatusIndicator
              label="Online"
              active={trackingStatus.isOnline}
            />
            <StatusIndicator
              label="Overall"
              active={trackingStatus.isTracking}
            />
          </View>
        </View>

        {/* Action Buttons */}
        {trackingStatus.queuedUploads > 0 && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={retryUploads}
            disabled={isLoading}
          >
            <Text style={styles.retryBtnText}>
              Retry {trackingStatus.queuedUploads} Queued Uploads
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Status indicator component used in monitor
 */
function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.statusIndicator}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: active ? '#4CAF50' : '#ccc' },
        ]}
      />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{active ? 'ON' : 'OFF'}</Text>
    </View>
  );
}

// ============================================================================
// EXAMPLE 4: Location History Viewer
// ============================================================================

/**
 * Display recent location history
 * Could be used for trail review or debugging
 */
export function LocationHistoryViewer() {
  const [history, setHistory] = React.useState<
    Array<{
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const locations = await locationService.getLocationHistory();
      setHistory(locations.slice(-10)); // Show last 10
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Recent Locations</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadHistory}
          disabled={isLoading}
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.historyList}>
        {history.length === 0 ? (
          <Text style={styles.noDataText}>No location history</Text>
        ) : (
          history.map((location, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyItemMain}>
                <Text style={styles.historyCoords}>
                  {formatLocation(location)}
                </Text>
                <Text style={styles.historyTime}>
                  {new Date(location.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.historyAccuracy}>
                ±{location.accuracy.toFixed(0)}m
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// EXAMPLE 5: Emergency Context Provider
// ============================================================================

/**
 * Advanced: Context provider for emergency features
 * Makes SOS and emergency data available to entire app
 */

import React, { createContext, useContext } from 'react';

interface EmergencyContextType {
  isSOSActive: boolean;
  sosLocation: LocationData | null;
  triggerSOS: () => Promise<void>;
  clearSOS: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(
  undefined
);

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const [isSOSActive, setIsSOSActive] = React.useState(false);
  const [sosLocation, setSosLocation] = React.useState<LocationData | null>(
    null
  );
  const { getSOS } = useLocationTracking();

  const triggerSOS = async () => {
    try {
      const location = await getSOS();
      if (location) {
        setSosLocation(location);
        setIsSOSActive(true);

        // Auto-clear after 5 minutes
        setTimeout(() => {
          setIsSOSActive(false);
        }, 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('Error triggering SOS:', error);
    }
  };

  const clearSOS = () => {
    setIsSOSActive(false);
    setSosLocation(null);
  };

  return (
    <EmergencyContext.Provider
      value={{ isSOSActive, sosLocation, triggerSOS, clearSOS }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error('useEmergency must be used within EmergencyProvider');
  }
  return context;
}

// Usage example:
/*
function App() {
  return (
    <EmergencyProvider>
      <YourApp />
    </EmergencyProvider>
  );
}

// In any component:
function EmergencyButton() {
  const { triggerSOS } = useEmergency();
  return <Button title="🚨 SOS" onPress={triggerSOS} />;
}
*/

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  widget: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  widgetStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  widgetButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  widgetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: '#4CAF50',
  },
  sosBtn: {
    backgroundColor: '#FF6B6B',
  },
  widgetBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },

  // Monitor styles
  monitor: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  monitorSection: {
    padding: 16,
    gap: 12,
  },
  monitorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  dataCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  accuracyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  accuracyText: {
    fontSize: 12,
    color: '#999',
  },
  accuracyLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  noData: {
    fontSize: 14,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusIndicator: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  retryBtn: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // History styles
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  refreshBtn: {
    padding: 8,
  },
  refreshBtnText: {
    fontSize: 16,
    color: '#1976D2',
  },
  historyList: {
    flex: 1,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyItemMain: {
    flex: 1,
  },
  historyCoords: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  historyTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  historyAccuracy: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});
