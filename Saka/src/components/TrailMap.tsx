/**
 * TrailMap.tsx
 * Design tokens from ProfileCard.tsx throughout.
 * Fixes:
 *   - Styles defined BEFORE components that use them (Android marker crash)
 *   - tracksViewChanges left as default (true) on first render for Android
 *   - back button + legend use top: 16 (no assumed status bar offset)
 *   - edges={[]} on SafeAreaView for true fullscreen
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { useViewpointFlow } from '../hooks/useViewpointFlow';
import ViewpointModal from './ViewpointModal';
import { isModalVisible, isAnimating, activeSnapshot } from '../store/viewpointStateMachine';
import { VIEWPOINTS_DATA } from '../data/viewpointsData';
import type { ViewpointDetail } from '../types/viewpointTypes';

// ── Images ────────────────────────────────────────────────────────────────
const PLACEHOLDER = require('../../assets/viewpoints/placeholder.png');
const IMAGE_MAP: Record<string, any> = {
  trailhead:     require('../../assets/images/TrailHead.jpg'),
  bantang_river: require('../../assets/images/BantangRiverWide.jpg'),
  camp1:         require('../../assets/images/Camp1.jpg'),
  waterfall:     require('../../assets/images/WaterfallsWide.jpg'),
  mossy_forest:  require('../../assets/images/MossyForestWide.jpg'),
  camp2:         require('../../assets/images/Camp2$3.jpg'),
  camp3:         require('../../assets/images/Camp2$3.jpg'),
  crown_shyness: require('../../assets/images/CrownShines.jpg'),
  summit_ridge:  require('../../assets/images/MadjaasRidgeWide.jpg'),
  summit:        require('../../assets/images/MadjaasSummit.jpg'),
};

// ─── ProfileCard design tokens ────────────────────────────────────────────
const PC = {
  bgCard:       '#0E1520',
  bgPanel:      '#111927',
  bgAvatar:     '#1E2D42',
  border:       'rgba(255,255,255,0.07)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  gold:         '#C9A96E',
  goldBorder:   'rgba(201,169,110,0.4)',
  textSecondary:'rgba(255,255,255,0.7)',
  textMuted:    '#8A9BB0',
  textFaint:    'rgba(255,255,255,0.38)',
  radius:       16,
  radiusBtn:    8,
};

// ─── Props ────────────────────────────────────────────────────────────────
interface Coordinate { latitude: number; longitude: number; }
interface TrailViewpoint {
  id: string; name: string;
  latitude: number; longitude: number;
  elevation?: string; notes?: string;
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

// ─── Styles defined FIRST so components below can reference them ──────────
const pinStyles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 46,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  num: {
    fontSize: 8,
    fontWeight: '900' as const,
    lineHeight: 9,
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

const centerStyles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 46,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PC.bgPanel,
    borderWidth: 1.5,
    borderColor: PC.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PC.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: PC.bgPanel,
  },
});

// ─── Marker components — defined AFTER their styles ───────────────────────
interface PinProps { isSummit: boolean; isCamp: boolean; index: number; }

function TrailPin({ isSummit, isCamp, index }: PinProps) {
  const bg        = isSummit ? PC.gold       : isCamp ? PC.bgAvatar  : PC.bgPanel;
  const border    = isSummit ? PC.goldBorder : isCamp ? PC.border     : PC.borderSubtle;
  const iconName  = isSummit ? 'flag'        : isCamp ? 'bonfire'     : 'location-outline';
  const iconColor = isSummit ? PC.bgCard     : isCamp ? PC.gold       : PC.textMuted;
  const numColor  = isSummit ? PC.bgCard     : PC.textFaint;

  return (
    <View style={pinStyles.wrap}>
      <View style={[pinStyles.circle, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={iconName as any} size={11} color={iconColor} />
        <Text style={[pinStyles.num, { color: numColor }]}>{index + 1}</Text>
      </View>
      <View style={[pinStyles.tip, { borderTopColor: bg }]} />
    </View>
  );
}

function CenterPin() {
  return (
    <View style={centerStyles.wrap}>
      <View style={centerStyles.circle}>
        <Ionicons name="location-sharp" size={16} color={PC.gold} />
      </View>
      <View style={centerStyles.tip} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function TrailMap({
  mountainId,
  mountainName,
  centerCoord,
  viewpoints,
  trailCoordinates: customTrailCoordinates,
  zoomLevel = 13,
  trailColor = PC.gold,
  trailWidth = 2.5,
  showTrailLine = true,
}: TrailMapProps) {
  const mapRef       = useRef<MapView>(null);
  const router       = useRouter();
  const photoOpacity = useRef(new Animated.Value(0)).current;

  // tracksViewChanges: true on mount so Android renders custom markers,
  // then flip to false after a short delay to stop re-renders.
  const [tracksViews, setTracksViews] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracksViews(false), 500);
    return () => clearTimeout(t);
  }, []);

  const fetchDetail = useCallback(
    async (id: string): Promise<ViewpointDetail | null> =>
      (VIEWPOINTS_DATA as any)[id] ?? null,
    [],
  );

  const { state, onMarkerPress, onDismiss, showPhoto, activeViewpoint } =
    useViewpointFlow({
      mapRef: mapRef as React.RefObject<MapView>,
      overviewCoord: centerCoord,
      overviewZoom:  zoomLevel,
      mountainId,
      fetchDetail,
    });

  useEffect(() => {
    Animated.timing(photoOpacity, {
      toValue:         showPhoto ? 1 : 0,
      duration:        400,
      useNativeDriver: true,
    }).start();
  }, [showPhoto, photoOpacity]);

  const modalVisible = isModalVisible(state);
  const flowActive   = isAnimating(state) || modalVisible;
  const snapshot     = activeSnapshot(state);
  const detail       = state.phase === 'modal_open' ? state.detail : null;

  const activeDetail = activeViewpoint
    ? (VIEWPOINTS_DATA as any)[activeViewpoint.id] : null;
  const activeImage  = activeDetail ? IMAGE_MAP[activeDetail.imageKey] : null;

  const trailCoordinates = customTrailCoordinates || [
    centerCoord,
    ...viewpoints.map(v => ({ latitude: v.latitude, longitude: v.longitude })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialCamera={{ center: centerCoord, heading: 0, pitch: 45, altitude: 0, zoom: zoomLevel }}
        mapType="satellite"
        showsUserLocation={false}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        zoomControlEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {showTrailLine && (
          <>
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(201,169,110,0.08)" strokeWidth={trailWidth * 5} geodesic zIndex={0} />
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(201,169,110,0.22)" strokeWidth={trailWidth * 2.5} geodesic zIndex={1} />
            <Polyline coordinates={trailCoordinates} strokeColor={trailColor} strokeWidth={trailWidth} lineDashPattern={[10, 5]} geodesic zIndex={2} />
            <Polyline coordinates={trailCoordinates} strokeColor="rgba(255,245,220,0.35)" strokeWidth={trailWidth * 0.35} geodesic zIndex={3} />
          </>
        )}

        <Marker
          coordinate={centerCoord}
          title={mountainName}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={tracksViews}
        >
          <CenterPin />
        </Marker>

        {viewpoints.map((viewpoint, index) => {
          const isSummit = viewpoint.name.toLowerCase().includes('summit');
          const isCamp   = viewpoint.name.toLowerCase().includes('camp');
          return (
            <Marker
              key={viewpoint.id}
              coordinate={{ latitude: viewpoint.latitude, longitude: viewpoint.longitude }}
              onPress={() => onMarkerPress(viewpoint)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={tracksViews}
            >
              <TrailPin isSummit={isSummit} isCamp={isCamp} index={index} />
            </Marker>
          );
        })}
      </MapView>

      {/* Full-screen photo overlay */}
      <Animated.View style={[styles.photoOverlay, { opacity: photoOpacity }]} pointerEvents="none">
        {activeImage && (
          <Image source={activeImage} style={styles.photoFill} resizeMode="cover" />
        )}
      </Animated.View>

      {/* Back button — top: 16, no assumed status bar height */}
      {!flowActive && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={PC.textSecondary} />
        </TouchableOpacity>
      )}

      {!flowActive && (
        <View style={styles.legend}>
        {([
          { label: 'Summit', icon: 'flag',             color: PC.gold },
          { label: 'Camp',   icon: 'bonfire',           color: PC.gold },
          { label: 'Stop',   icon: 'location-outline',  color: PC.textMuted },
        ] as { label: string; icon: string; color: string }[]).map(({ label, icon, color }) => (
          <View key={label} style={styles.legendItem}>
            <Ionicons name={icon as any} size={10} color={color} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
      )}

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

// ─── Screen styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PC.bgCard },
  map:       { flex: 1 },

  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: PC.bgCard,
  },
  photoFill: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  // top: 16 — sits just below the very top edge, no status bar assumption
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: PC.radiusBtn,
    backgroundColor: PC.bgPanel,
    borderWidth: 1,
    borderColor: PC.border,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },

  legend: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: PC.bgPanel,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: PC.radiusBtn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: PC.border,
    elevation: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: {
    fontSize: 9,
    fontWeight: '600',
    color: PC.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});