import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { mountainService, Mountain } from '../services/mountainService';
import { supabase } from '../lib/supabase';
import ResponsiveMapImage, { MapPoint } from '../components/ResponsiveMapImage';
import { getMountainMap } from '../data/mountainMaps';
import LoadingScreen from './Loading';

type TableViewpoint = {
  id: string;
  name: string;
  sort_order: number;
  map_x: number | null;
  map_y: number | null;
};

// ─── PLACEMENT MODE ──────────────────────────────────────────────────────
// Flip to `true` temporarily when calibrating a NEW mountain's viewpoints.
// Tap each spot in order → copy the SQL from the console → run in Supabase
// → set back to `false`. Production builds always run with placement off.
const PLACEMENT_MODE = false;

export default function MountainTopScreen() {
  const { mountainId } = useLocalSearchParams<{ mountainId: string }>();
  const cachedMountain = mountainId
    ? mountainService.getCachedMountainById(mountainId)
    : null;
  const [mountain, setMountain] = useState<Mountain | null>(cachedMountain);
  const [loading, setLoading] = useState(!cachedMountain);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loadingScreenComplete, setLoadingScreenComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([]);
  const [viewpointList, setViewpointList] = useState<TableViewpoint[]>([]);
  // NEW: viewpoints have their own loading lifecycle. The map is the feature,
  // and its dots/trail come from this query, so `ready` must wait for it.
  const [viewpointsLoading, setViewpointsLoading] = useState(true);
  const [viewpointsError, setViewpointsError] = useState<string | null>(null);
  const router = useRouter();

  // ─── Load mountain data ────────────────────────────────────────────────
  useEffect(() => {
    if (cachedMountain) return;

    if (!mountainId) {
      setError('No mountain ID provided');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await mountainService.fetchMountainById(mountainId);
        if (data) setMountain(data);
        else setError('Mountain not found');
      } catch (err: any) {
        setError(err?.message || 'Failed to load mountain');
      } finally {
        setLoading(false);
      }
    })();
  }, [cachedMountain, mountainId]);

  const mapInfo = getMountainMap(mountainId, mountain?.name);

  // ─── Load viewpoints from Supabase ─────────────────────────────────────
  useEffect(() => {
    if (!mountainId) {
      setViewpointsLoading(false);
      return;
    }

    let active = true;
    setViewpointsLoading(true);
    setViewpointsError(null);

    (async () => {
      const { data, error: qError } = await supabase
        .from('viewpoints')
        .select('id, name, sort_order, map_x, map_y')
        .eq('mountain_id', mountainId)
        .not('sort_order', 'is', null)
        .order('sort_order');

      if (!active) return;

      if (qError) {
        console.error('[MountainTop] viewpoints fetch failed:', qError);
        setViewpointsError(qError.message);
        setViewpointList([]);
      } else {
        setViewpointList((data ?? []) as TableViewpoint[]);
      }
      setViewpointsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [mountainId]);

  // ─── Map points (draft in placement mode, saved coords otherwise) ──────
  const points: MapPoint[] = useMemo(() => {
    if (PLACEMENT_MODE) {
      return draft.map((d, i) => ({
        id: viewpointList[i]?.id ?? String(i),
        x: d.x,
        y: d.y,
      }));
    }
    return viewpointList
      .filter(v => typeof v.map_x === 'number' && typeof v.map_y === 'number')
      .map(v => ({ id: v.id, x: v.map_x as number, y: v.map_y as number }));
  }, [viewpointList, draft]);

  // Trail runs through the viewpoints in sort_order.
  const trail = useMemo(() => points.map(p => ({ x: p.x, y: p.y })), [points]);

  // ─── Placement-mode tap handler ────────────────────────────────────────
  const handleImagePress = useCallback(
    (x: number, y: number) => {
      if (!PLACEMENT_MODE) return;
      setDraft(prev =>
        prev.length >= viewpointList.length ? prev : [...prev, { x, y }]
      );
    },
    [viewpointList.length]
  );

  // ─── Dump SQL for Supabase when all points are placed ──────────────────
  useEffect(() => {
    if (!PLACEMENT_MODE) return;
    if (viewpointList.length === 0 || draft.length !== viewpointList.length) return;
    const sql = viewpointList
      .map(
        (v, i) =>
          `update viewpoints set map_x=${draft[i].x.toFixed(3)}, map_y=${draft[i].y.toFixed(3)} where id='${v.id}';`
      )
      .join('\n');
    console.log(
      `[MountainTop] RUN THIS in the Supabase SQL editor for ${mountain?.name}:\n${sql}`
    );
  }, [draft, viewpointList, mountain?.name]);

  const handleLoadingComplete = useCallback(() => setLoadingScreenComplete(true), []);

  // ─── Error / empty states ──────────────────────────────────────────────
  if (!loading && (error || !mountain)) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Mountain not found'}</Text>
      </View>
    );
  }

  if (!loading && mountain && !mapInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No map image for this mountain yet</Text>
      </View>
    );
  }

  // NEW: viewpoints must be done loading (success OR error) before we reveal
  // the map, because the dots/trail are the feature. An error still flips
  // this to `false` so the user is not trapped; the "No trail data yet"
  // message surfaces it once the map is visible.
  const loadingReady =
    !loading &&
    mountain !== null &&
    (imageLoaded || imageError) &&
    !viewpointsLoading;

  const total = viewpointList.length;
  const nextViewpoint = viewpointList[draft.length];
  const allPlaced = total > 0 && draft.length >= total;

  return (
    <View style={styles.container}>
      {mountain && mapInfo && (
        <>
          <ResponsiveMapImage
            source={mapInfo.source}
            fit="cover"
            points={points}
            trail={trail}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.error(
                `[MountainTop] Failed to load map image for ${mountain.name}`
              );
              setImageError(true);
            }}
            // Only pass a press handler when placement is on — otherwise it
            // can steal taps from the viewpoint dots.
            onImagePress={PLACEMENT_MODE ? handleImagePress : undefined}
            onPointPress={p => {
              if (PLACEMENT_MODE || !mountainId) return;
              router.push({
                pathname: '/Viewpoint',
                params: { viewpointId: p.id, mountainId },
              });
            }}
          />

          {imageError && loadingScreenComplete && (
            <View style={styles.mapError} pointerEvents="none">
              <Text style={styles.errorText}>The map image could not be loaded.</Text>
            </View>
          )}

          {/* Floating Header */}
          <SafeAreaView style={styles.headerSafeArea} pointerEvents="box-none">
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

          {/* Placement helper (dev only) */}
          {PLACEMENT_MODE && (
            <View style={styles.placeBar} pointerEvents="box-none">
              <View style={styles.placeCard}>
                <Text style={styles.placeText} numberOfLines={2}>
                  {total === 0
                    ? 'This mountain has no viewpoints in the database'
                    : allPlaced
                    ? 'All placed. Copy the SQL from the console.'
                    : `Tap the spot for: ${nextViewpoint?.name ?? 'viewpoint'} (${
                        draft.length + 1
                      }/${total})`}
                </Text>
                <TouchableOpacity
                  style={styles.placeBtn}
                  onPress={() => setDraft(d => d.slice(0, -1))}
                >
                  <Text style={styles.placeBtnText}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.placeBtn} onPress={() => setDraft([])}>
                  <Text style={styles.placeBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!PLACEMENT_MODE && points.length < 2 && (
            <View style={styles.fallbackMessage} pointerEvents="none">
              <Ionicons name="map-outline" size={20} color="rgba(255,255,255,0.6)" />
              <Text style={styles.fallbackText}>
                {viewpointsError ? 'Trail data unavailable' : 'No trail data yet'}
              </Text>
            </View>
          )}
        </>
      )}

      {!loadingScreenComplete && (
        <View style={styles.loadingOverlay}>
          <LoadingScreen
            ready={loadingReady}
            loadingDuration={1000}
            onComplete={handleLoadingComplete}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1520' },
  loadingOverlay: { ...StyleSheet.absoluteFill, zIndex: 20 },
  mapError: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E1520',
  },

  headerSafeArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
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

  placeBar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 26, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.4)',
  },
  placeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', maxWidth: 320 },
  placeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 169, 110, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.3)',
  },
  placeBtnText: { color: '#C9A96E', fontSize: 12, fontWeight: '600' },

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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  errorText: { color: '#FFFFFF', textAlign: 'center', margin: 20 },
});