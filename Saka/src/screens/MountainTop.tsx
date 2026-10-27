import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { mountainService, Mountain } from '../services/mountainService';
import { supabase } from '../lib/supabase';
import ResponsiveMapImage, { MapPoint } from '../components/ResponsiveMapImage';
import { getMountainMap } from '../data/mountainMaps';
import LoadingScreen from './Loading';
import ZoomableView from '../components/ZoomableView';
import OfflineStatusIndicator from '../components/OfflineStatusIndicator';

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
const VIEWPOINTS_CACHE_PREFIX = 'SAKA_VIEWPOINTS_CACHE:';
const VIEWPOINTS_CACHE_UPDATED_PREFIX = 'SAKA_VIEWPOINTS_CACHE_UPDATED:';

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
    if (!mountainId) {
      setError('No mountain ID provided');
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const data = await mountainService.fetchMountainById(mountainId);
        if (active && data) {
          setMountain(data);
        }
        else if (active && !data) setError('Mountain not found');
      } catch (err: any) {
        if (active) setError(err?.message || 'Failed to load mountain');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
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
      const cacheKey = `${VIEWPOINTS_CACHE_PREFIX}${mountainId}`;
      const updatedAtKey = `${VIEWPOINTS_CACHE_UPDATED_PREFIX}${mountainId}`;
      let hasCachedViewpoints = false;

      try {
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as TableViewpoint[];
          if (Array.isArray(cached)) {
            hasCachedViewpoints = true;
            if (active) {
              setViewpointList(cached);
              setViewpointsLoading(false);
            }
          }
        }
      } catch (cacheError) {
        console.warn('[MountainTop] Failed to read cached viewpoints:', cacheError);
      }

      try {
        const { data, error: qError } = await supabase
          .from('viewpoints')
          .select('id, name, sort_order, map_x, map_y')
          .eq('mountain_id', mountainId)
          .not('sort_order', 'is', null)
          .order('sort_order');

        if (!active) return;

        if (qError) {
          console.error('[MountainTop] viewpoints fetch failed:', qError);
          if (!hasCachedViewpoints) {
            setViewpointsError(qError.message);
            setViewpointList([]);
          }
        } else {
          const viewpoints = (data ?? []) as TableViewpoint[];
          setViewpointList(viewpoints);
          const updatedAt = new Date().toISOString();
          void Promise.all([
            AsyncStorage.setItem(cacheKey, JSON.stringify(viewpoints)),
            AsyncStorage.setItem(updatedAtKey, updatedAt),
          ]).catch(cacheError => {
            console.warn('[MountainTop] Failed to persist viewpoints:', cacheError);
          });
        }
      } catch (queryError) {
        if (!active) return;
        console.warn('[MountainTop] Unable to refresh viewpoints:', queryError);
        if (!hasCachedViewpoints) {
          setViewpointsError(
            queryError instanceof Error ? queryError.message : 'Unable to load trail data.'
          );
          setViewpointList([]);
        }
      } finally {
        if (active) setViewpointsLoading(false);
      }
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
          {/* Pinch / drag / double-tap to zoom. Off in placement mode so tap
              coordinates stay exact while calibrating. */}
          <ZoomableView enabled={!PLACEMENT_MODE}>
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
                const viewpointNumber = viewpointList.findIndex(
                  (viewpoint) => viewpoint.id === p.id
                ) + 1;
                router.push({
                  pathname: '/Viewpoint',
                  params: {
                    viewpointId: p.id,
                    mountainId,
                    mountainName: mountain.name,
                    viewpointNumber: String(viewpointNumber),
                  },
                });
              }}
            />
          </ZoomableView>

          {imageError && loadingScreenComplete && (
            <View style={styles.mapError} pointerEvents="none">
              <Text style={styles.errorText}>The map image could not be loaded.</Text>
            </View>
          )}

          {/* Floating header: two small pills instead of a full-width bar, so the map stays the focus */}
          <SafeAreaView
            edges={['top', 'left', 'right']}
            style={styles.headerSafeArea}
            pointerEvents="box-none"
          >
            <View style={styles.header} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.titlePill}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {mountain.name}
                </Text>
                {mountain.difficulty ? (
                  <>
                    <View style={styles.titleDivider} />
                    <Text style={styles.difficultyText} numberOfLines={1}>
                      {mountain.difficulty}
                    </Text>
                  </>
                ) : null}
              </View>
              <OfflineStatusIndicator />
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
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 21, 32, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titlePill: {
    flexShrink: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(14, 21, 32, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleDivider: {
    width: 1,
    height: 12,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  difficultyText: { color: '#C9A96E', fontSize: 11, fontWeight: '600' },
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