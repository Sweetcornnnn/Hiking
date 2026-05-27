/**
 * TrailMap.tsx — UPDATED
 *
 * Tap a marker:
 *   1. Camera zooms to the viewpoint (800ms)
 *   2. The viewpoint's photo fades in full-screen
 *   3. After 3 seconds the modal opens and the photo fades out
 *   4. Dismiss modal → camera zooms back to overview
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { useViewpointFlow } from '../hooks/useViewpointFlow';
import ViewpointModal from './ViewpointModal';
import { isModalVisible, activeSnapshot } from '../store/viewpointStateMachine';
import { VIEWPOINTS_DATA } from '../data/viewpointsData';
import type { ViewpointDetail } from '../types/viewpointTypes';

// ── Put your actual images here — key must match imageKey in viewpointsData ──
const PLACEHOLDER = require('../../assets/viewpoints/placeholder.png');
const IMAGE_MAP: Record<string, any> = {
  trailhead:     require('../../assets/images/Mt. Guiting-Guiting.jpg'),
  bantang_river: PLACEHOLDER,
  camp1:         PLACEHOLDER,
  waterfall:     PLACEHOLDER,
  mossy_forest:  PLACEHOLDER,
  camp2:         PLACEHOLDER,
  camp3:         PLACEHOLDER,
  crown_shyness: PLACEHOLDER,
  summit_ridge:  PLACEHOLDER,
  summit:        PLACEHOLDER,
};

// ─── Props ────────────────────────────────────────────────────────────────
interface Coordinate { latitude: number; longitude: number; }

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

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Component ────────────────────────────────────────────────────────────
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
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  // Animated value for the full-screen photo fade
  const photoOpacity = useRef(new Animated.Value(0)).current;

  // ── Detail fetcher — reads existing data, no network call ────────────
  const fetchDetail = useCallback(
    async (id: string): Promise<ViewpointDetail | null> =>
      (VIEWPOINTS_DATA as any)[id] ?? null,
    [],
  );

  // ── Flow hook ─────────────────────────────────────────────────────────
  const { state, onMarkerPress, onDismiss, showPhoto, activeViewpoint } =
    useViewpointFlow({
      mapRef: mapRef as React.RefObject<MapView>,
      overviewCoord: centerCoord,
      overviewZoom:  zoomLevel,
      mountainId,
      fetchDetail,
    });

  // ── Animate photo in/out ──────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(photoOpacity, {
      toValue:         showPhoto ? 1 : 0,
      duration:        400,
      useNativeDriver: true,
    }).start();
  }, [showPhoto, photoOpacity]);

  // ── Derived ───────────────────────────────────────────────────────────
  const modalVisible = isModalVisible(state);
  const snapshot     = activeSnapshot(state);
  const detail       = state.phase === 'modal_open' ? state.detail : null;

  // Pick the photo for the currently active viewpoint
  const activeDetail  = activeViewpoint
    ? (VIEWPOINTS_DATA as any)[activeViewpoint.id]
    : null;
  const activeImage   = activeDetail ? IMAGE_MAP[activeDetail.imageKey] : null;

  const trailCoordinates = customTrailCoordinates || [
    centerCoord,
    ...viewpoints.map(v => ({ latitude: v.latitude, longitude: v.longitude })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#142016" />

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialCamera={{
          center: centerCoord, heading: 0, pitch: 45, altitude: 0, zoom: zoomLevel,
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
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(118,255,3,0.12)" strokeWidth={trailWidth * 4} geodesic zIndex={0} />
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(118,255,3,0.28)" strokeWidth={trailWidth * 2.5} geodesic zIndex={1} />
            <Polyline coordinates={trailCoordinates} strokeColor={trailColor} strokeWidth={trailWidth} lineDashPattern={[10, 5]} geodesic zIndex={2} />
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(255,255,255,0.55)" strokeWidth={trailWidth * 0.4} geodesic zIndex={3} />
          </>
        )}

        {/* Center marker */}
        <Marker coordinate={centerCoord} title={mountainName} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.centerMarker}>
            <Ionicons name="location-sharp" size={20} color="#FFF" />
          </View>
        </Marker>

        {/* Viewpoint markers */}
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
              onPress={() => onMarkerPress(viewpoint)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pinCircle, { backgroundColor: bg }]}>
                  <Ionicons name={iconName as any} size={14} color={iconColor} />
                  <Text style={[styles.pinNumber, { color: textColor }]}>{index + 1}</Text>
                </View>
                <View style={[styles.pinTip, { borderTopColor: bg }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── FULL-SCREEN PHOTO OVERLAY ──────────────────────────────────────
          Fades in after zoom completes. Shows for 3s then modal opens.
          Sits above the map, below the back button.                      */}
      <Animated.View
        style={[styles.photoOverlay, { opacity: photoOpacity }]}
        pointerEvents={showPhoto ? 'none' : 'none'}
      >
        {activeImage && (
          <Image
            source={activeImage}
            style={styles.photoFill}
            resizeMode="cover"
          />
        )}
      </Animated.View>

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

      {/* ── MODAL — opens after 3s photo hold ── */}
      <ViewpointModal
        visible={modalVisible}
        snapshot={snapshot}
        detail={detail}
        onDismiss={onDismiss}
        mountainId={mountainId}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f0f' },
  map:       { flex: 1 },

  // Full-screen photo overlay
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          20,
    backgroundColor: '#000',
  },
  photoFill: {
    width:  '100%',
    height: '100%',
    position: 'absolute',
  },
  photoGradient: {
    position:        'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    height:           '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoLabel: {
    position: 'absolute',
    bottom:    48,
    left:      24,
    right:     24,
  },
  photoSubtitle: {
    fontSize:      11,
    color:         'rgba(255,255,255,0.65)',
    fontWeight:   '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:   4,
  },
  photoTitle: {
    fontSize:    28,
    fontWeight: '800',
    color:       '#FFF',
    lineHeight:   34,
    marginBottom: 6,
  },
  photoElevRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            5,
    marginBottom:  12,
  },
  photoElev: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  photoHint: {
    fontSize:   11,
    color:      'rgba(255,255,255,0.4)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Markers (unchanged from original)
  centerMarker: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FF6B6B', borderWidth: 2.5, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  pinWrap:   { width: 44, height: 54, alignItems: 'center', justifyContent: 'flex-start' },
  pinCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  pinNumber: { fontSize: 9, fontWeight: '900', lineHeight: 10 },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  // Back button
  backBtn: {
    position: 'absolute', top: 16, left: 16,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(15,31,15,0.9)',
    borderWidth: 1.5, borderColor: 'rgba(118,255,3,0.4)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 8, zIndex: 100,
  },

  // Legend
  legend: {
    position: 'absolute', top: 20, right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(118,255,3,0.4)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
});