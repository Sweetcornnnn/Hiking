import React, { useEffect, useState, useRef, useMemo } from 'react';
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

  // ─── Calculate initial camera values from viewpoints ────────────────
  const initialCamera = useMemo(() => {
    if (!mountain) return null;

    const viewpoints = mountain.viewpoints || [];

    if (viewpoints.length >= 2) {
      const lats = viewpoints.map(v => v.latitude);
      const lngs = viewpoints.map(v => v.longitude);
      const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      let deltaLat = (maxLat - minLat) * 1.4;
      let deltaLng = (maxLng - minLng) * 1.4;

      if (deltaLat < 0.01) deltaLat = 0.01;
      if (deltaLng < 0.01) deltaLng = 0.01;

      // Return as a region (for initialCamera)
      return {
        center: { latitude: avgLat, longitude: avgLng },
        heading: 0,
        pitch: 45,
        altitude: 0,
        zoom: 13.8, // Use a fixed zoom – or calculate from delta if you prefer
      };
    } else {
      return {
        center: { latitude: mountain.latitude, longitude: mountain.longitude },
        heading: 0,
        pitch: 45,
        altitude: 0,
        zoom: 13.8,
      };
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
  const centerCoord = {
    latitude: mountain.latitude,
    longitude: mountain.longitude,
  };

  return (
    <View style={styles.container}>
      {/* Floating Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Ionicons name="location-outline" size={18} color="#C9A96E" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {mountain.name}
          </Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{mountain.difficulty}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Map — uses initialCamera, no useEffect centering needed */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="satellite"
        pitchEnabled={true}
        rotateEnabled={true}
        showsCompass={true}
        showsUserLocation={true}
        initialCamera={initialCamera || {
          center: { latitude: 11.4050, longitude: 122.1350 },
          heading: 0,
          pitch: 45,
          altitude: 0,
          zoom: 13.8,
        }}
        onMapReady={() => {
          if (mapRef.current) {
            setTimeout(() => {
              mapRef.current?.animateCamera?.(
                {
                  pitch: 55,
                },
                { duration: 800 }
              );
            }, 300);
          }
        }}
      >
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

        {!hasTrail && (
          <Marker
            coordinate={centerCoord}
            title={mountain.name}
            description={mountain.description}
          />
        )}

        {hasTrail && trailCoords.length > 0 && (
          <Polyline
            coordinates={trailCoords}
            strokeColor="#C9A96E"
            strokeWidth={3}
            lineDashPattern={[0, 0]}
          />
        )}
      </MapView>

      {!hasTrail && (
        <View style={styles.fallbackMessage}>
          <Ionicons name="map-outline" size={20} color="rgba(255,255,255,0.4)" />
          <Text style={styles.fallbackText}>No trail data yet</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1520',
  },
  map: {
    flex: 1,
  },

  // ─── Header (Option A) ────────────────────────────────────────────────
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 26, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 169, 110, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.3)',
  },
  headerBadgeText: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // ─── Markers ──────────────────────────────────────────────────────────
  markerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201, 169, 110, 0.3)',
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