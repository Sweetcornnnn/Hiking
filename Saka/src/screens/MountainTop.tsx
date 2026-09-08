import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { mountainService, Mountain } from '../services/mountainService';
import { buildTrailCoordinates, Viewpoint } from '../utils/geoUtils';

// Helper to format elevation
const formatElevation = (meters: number): string => `${meters.toLocaleString()} m`;

export default function MountainTopScreen() {
  const { mountainId } = useLocalSearchParams<{ mountainId: string }>();
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  useEffect(() => {
    if (mountainId) {
      const load = async () => {
        try {
          const data = await mountainService.fetchMountainById(mountainId);
          if (data) {
            setMountain(data);
          } else {
            setError('Mountain not found');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load mountain');
        } finally {
          setLoading(false);
        }
      };
      load();
    } else {
      setError('No mountain ID provided');
      setLoading(false);
    }
  }, [mountainId]);

  // Auto-fit map to viewpoints or center on mountain
  useEffect(() => {
    if (mountain && mapRef.current) {
      const viewpoints = mountain.viewpoints || [];
      if (viewpoints.length >= 2) {
        // Fit to all viewpoints
        const coordinates = viewpoints.map((vp) => ({
          latitude: vp.latitude,
          longitude: vp.longitude,
        }));
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        });
      } else {
        // Single marker fallback: center on mountain
        mapRef.current.animateToRegion(
          {
            latitude: mountain.latitude,
            longitude: mountain.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          1000
        );
      }
    }
  }, [mountain]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C9A96E" />
      </View>
    );
  }

  if (error || !mountain) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Mountain not found'}</Text>
      </View>
    );
  }

  const viewpoints = mountain.viewpoints || [];
  const hasTrail = viewpoints.length >= 2;
  const trailCoords = hasTrail ? buildTrailCoordinates(viewpoints, 100) : [];

  // For fallback: show a single marker at mountain center
  const centerCoord = {
    latitude: mountain.latitude,
    longitude: mountain.longitude,
  };

  return (
    <View style={styles.container}>
      {/* Floating Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        </TouchableOpacity>
        <View style={styles.header}>
          <Ionicons name="location-outline" size={18} color="#C9A96E" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {mountain.name}
          </Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{mountain.difficulty}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="satellite" // Hill-shading for 3D effect
        pitchEnabled={true}
        rotateEnabled={true}
        showsCompass={true}
        showsUserLocation={true}
        initialRegion={{
          latitude: centerCoord.latitude,
          longitude: centerCoord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        // Apply the 55° pitch once the map is ready
        onMapReady={() => {
          // This ensures the pitch is applied after initial render
          if (mapRef.current) {
            setTimeout(() => {
              mapRef.current?.animateCamera?.(
                {
                  pitch: 55, // 3D tilt angle
                },
                { duration: 800 }
              );
            }, 300);
          }
        }}
      >
        {/* If we have viewpoints, draw them */}
        {viewpoints.map((vp: Viewpoint) => (
          <Marker
            key={vp.id}
            coordinate={{
              latitude: vp.latitude,
              longitude: vp.longitude,
            }}
            title={vp.name}
            description={vp.notes || `Elevation: ${vp.elevation || 'N/A'}`}
          >
            <View style={styles.markerDot}>
              <View style={styles.markerInner} />
            </View>
          </Marker>
        ))}

        {/* Fallback marker if no viewpoints */}
        {!hasTrail && (
          <Marker
            coordinate={centerCoord}
            title={mountain.name}
            description={mountain.description}
          />
        )}

        {/* Trail line (only if ≥2 viewpoints) */}
        {hasTrail && trailCoords.length > 0 && (
          <Polyline
            coordinates={trailCoords}
            strokeColor="#C9A96E"
            strokeWidth={3}
            lineDashPattern={[0, 0]} // solid line
          />
        )}
      </MapView>

      {/* Fallback message (no trail data) */}
      {!hasTrail && (
        <View style={styles.fallbackMessage}>
          <Ionicons name="map-outline" size={20} color="rgba(255,255,255,0.4)" />
          <Text style={styles.fallbackText}>No trail data yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1520',
  },
  map: {
    flex: 1,
  },
  // Floating Header
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10,16,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
    backdropFilter: 'blur(10px)',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
  },
  headerBadgeText: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(10,16,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  // Marker style
  markerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201,169,110,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C9A96E',
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C9A96E',
  },
  // Fallback
  fallbackMessage: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    margin: 20,
  },
});