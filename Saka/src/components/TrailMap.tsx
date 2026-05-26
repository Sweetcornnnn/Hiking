import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface TrailViewpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: string;
  notes?: string;
}

interface TrailMapProps {
  mountainId: string;
  mountainName: string;
  centerCoord: Coordinate;
  viewpoints: TrailViewpoint[];
  trailCoordinates?: Coordinate[];
  zoomLevel?: number;
  trailColor?: string;
  trailWidth?: number;
  showTrailLine?: boolean;
}

export default function TrailMap({
  mountainId,
  mountainName,
  centerCoord,
  viewpoints,
  trailCoordinates: customTrailCoordinates,
  zoomLevel = 13,
  trailColor = '#76FF03',
  trailWidth = 4,
  showTrailLine = true,
}: TrailMapProps) {
  const mapRef = useRef(null);
  const router = useRouter();
  const [selectedMarker, setSelectedMarker] = useState<TrailViewpoint | null>(null);

  const trailCoordinates = customTrailCoordinates || [
    centerCoord,
    ...viewpoints.map(v => ({ latitude: v.latitude, longitude: v.longitude })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#142016" />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialCamera={{
          center: centerCoord,
          heading: 0,
          pitch: 45,
          altitude: 0,
          zoom: zoomLevel,
        }}
        mapType="satellite"
        showsUserLocation={false}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        zoomControlEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {/* Trail polyline layers */}
        {showTrailLine && (
          <>
            <Polyline
              coordinates={trailCoordinates}
              strokeColor="rgba(118,255,3,0.12)"
              strokeWidth={trailWidth * 4}
              geodesic={true}
              zIndex={0}
            />
            <Polyline
              coordinates={trailCoordinates}
              strokeColor="rgba(118,255,3,0.28)"
              strokeWidth={trailWidth * 2.5}
              geodesic={true}
              zIndex={1}
            />
            <Polyline
              coordinates={trailCoordinates}
              strokeColor={trailColor}
              strokeWidth={trailWidth}
              lineDashPattern={[10, 5]}
              geodesic={true}
              zIndex={2}
            />
            <Polyline
              coordinates={trailCoordinates}
              strokeColor="rgba(255,255,255,0.55)"
              strokeWidth={trailWidth * 0.4}
              geodesic={true}
              zIndex={3}
            />
          </>
        )}

        {/* Center / mountain marker
            — No pinColor prop (causes Android "?" bug).
            — Simple flat circle, no glow/shadow (elevation on inner
              views inside Marker is unreliable on Android). */}
        <Marker
          coordinate={centerCoord}
          title={mountainName}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.centerMarker}>
            <Ionicons name="location-sharp" size={20} color="#FFF" />
          </View>
        </Marker>

        {/* Viewpoint markers
            Design rules for Android-safe custom markers:
            - Everything lives inside a fixed-size container. No overflow.
            - No position:absolute children (clips on Android).
            - No elevation on inner views.
            - anchor y:1 = triangle tip touches the coordinate. */}
        {viewpoints.map((viewpoint, index) => {
          const isSummit = viewpoint.name.toLowerCase().includes('summit');
          const isCamp   = viewpoint.name.toLowerCase().includes('camp');

          const bg        = isSummit ? '#FFD700' : isCamp ? '#FF9800' : '#76FF03';
          const iconName  = isSummit ? 'flag'    : isCamp ? 'bonfire' : 'location';
          const iconColor = isSummit ? '#000'    : isCamp ? '#FFF'    : '#000';
          const textColor = isSummit ? '#000'    : '#FFF';

          return (
            <Marker
              key={viewpoint.id}
              coordinate={{ latitude: viewpoint.latitude, longitude: viewpoint.longitude }}
              onPress={() => setSelectedMarker(viewpoint)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              {/* Container: 44 wide × 54 tall.
                  Circle (40×40) + triangle (8px) = 48px — fits cleanly. */}
              <View style={styles.pinWrap}>
                {/* Circle with icon + number stacked */}
                <View style={[styles.pinCircle, { backgroundColor: bg }]}>
                  <Ionicons name={iconName} size={14} color={iconColor} />
                  <Text style={[styles.pinNumber, { color: textColor }]}>
                    {index + 1}
                  </Text>
                </View>
                {/* Triangle pointer — same color as circle, sits flush below */}
                <View style={[styles.pinTip, { borderTopColor: bg }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#76FF03', label: 'Waypoint' },
          { color: '#FF9800', label: 'Camp' },
          { color: '#FFD700', label: 'Summit' },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      

      {/* Tap outside modal to close */}
      {selectedMarker && (
        <TouchableWithoutFeedback onPress={() => setSelectedMarker(null)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Details modal */}
      {selectedMarker && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedMarker.name}</Text>

          {selectedMarker.elevation && (
            <View style={styles.cardRow}>
              <Ionicons name="arrow-up" size={13} color="#4caf50" />
              <Text style={styles.cardText}>{selectedMarker.elevation}</Text>
            </View>
          )}
          {selectedMarker.notes && (
            <View style={styles.cardRow}>
              <Ionicons name="map" size={13} color="#4caf50" />
              <Text style={styles.cardText}>{selectedMarker.notes}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => {
              setSelectedMarker(null);
              router.push({
                pathname: '/viewpoint',
                params: {
                  viewpointId: selectedMarker.id,
                  mountainId,
                  viewpointName: selectedMarker.name,
                },
              });
            }}
          >
            <Text style={styles.cardBtnText}>View details</Text>
            <Ionicons name="chevron-forward" size={14} color="#000" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f1f0f' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1f0f' },
  map:            { flex: 1 },

  // Center marker — flat circle, no inner elevation
  centerMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B6B',
    borderWidth: 2.5,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pin wrapper — fixed 44×54, no overflow needed
  pinWrap: {
    width: 44,
    height: 54,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Circle: 40×40, rounded, holds icon + number vertically
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  pinNumber: {
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  // Triangle tip — 8px tall, 14px wide, flush under circle
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: 0,
  },

  // Back button
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15,31,15,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(118,255,3,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 100,
  },

  // Legend
  legend: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(118,255,3,0.4)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  logoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 140,
    height: 60,
    backgroundColor: '#0f1f0f',
    pointerEvents: 'box-none',
    zIndex: 101,
  },

  // Modal overlay for dismissing modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 50,
  },

  // Details modal card — smaller, compact
  card: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 240,
    backgroundColor: 'rgba(15,31,15,0.95)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(118,255,3,0.6)',
    elevation: 12,
    zIndex: 51,
  },
  cardTitle: {
    color: '#76FF03',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  cardText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  cardBtn: {
    marginTop: 8,
    backgroundColor: '#76FF03',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
});