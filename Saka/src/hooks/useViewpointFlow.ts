/**
 * useViewpointFlow.ts
 *
 * Flow on marker tap:
 *   1. Camera zooms to viewpoint (800ms)
 *   2. Photo fades in full-screen immediately after zoom finishes
 *   3. After 3 seconds of showing the photo → modal opens
 *   4. On dismiss → photo hides, camera zooms back to overview
 *
 * A second tap or early dismiss cancels everything cleanly.
 */

import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type MapView from 'react-native-maps';

import { viewpointReducer } from '../store/viewpointStateMachine';
import type {
  Viewpoint,
  ViewportSnapshot,
  ViewpointDetail,
  ViewpointFlowState,
} from '../types/viewpointTypes';

const ZOOM_MS         = 800;   // camera zoom duration
const PHOTO_HOLD_MS   = 3000;  // how long photo shows before modal opens

interface UseViewpointFlowOptions {
  mapRef: React.RefObject<MapView | null>;
  overviewCoord: { latitude: number; longitude: number };
  overviewZoom: number;
  mountainId: string;
  fetchDetail: (viewpointId: string) => Promise<ViewpointDetail | null>;
}

interface UseViewpointFlowReturn {
  state: ViewpointFlowState;
  onMarkerPress: (viewpoint: Viewpoint) => void;
  onDismiss: () => void;
  /** True while the full-screen photo should be shown */
  showPhoto: boolean;
  /** The viewpoint currently being shown (for picking the right photo) */
  activeViewpoint: Viewpoint | null;
}

export function useViewpointFlow({
  mapRef,
  overviewCoord,
  overviewZoom,
  fetchDetail,
}: UseViewpointFlowOptions): UseViewpointFlowReturn {

  const [state, dispatch]   = useReducer(viewpointReducer, { phase: 'idle' });
  const [showPhoto, setShowPhoto] = useState(false);
  const [activeViewpoint, setActiveViewpoint] = useState<Viewpoint | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const aborted = useRef(false);

  // ── Clear all pending timers ─────────────────────────────────────────
  const cancelAll = useCallback(() => {
    aborted.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    aborted.current = false;
    setShowPhoto(false);
  }, []);

  const after = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (!aborted.current) fn();
    }, ms);
    timers.current.push(id);
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────
  const zoomTo = useCallback((viewpoint: Viewpoint) => {
    mapRef.current?.animateCamera(
      {
        center:  { latitude: viewpoint.latitude, longitude: viewpoint.longitude },
        zoom:    17,
        pitch:   55,
        heading: 0,
        altitude: 0,
      },
      { duration: ZOOM_MS },
    );
  }, [mapRef]);

  const zoomBack = useCallback(() => {
    mapRef.current?.animateCamera(
      {
        center:  overviewCoord,
        zoom:    overviewZoom,
        pitch:   45,
        heading: 0,
        altitude: 0,
      },
      { duration: ZOOM_MS },
    );
  }, [mapRef, overviewCoord, overviewZoom]);

  // ── Snapshot (lightweight — data only, no React nodes) ───────────────
  const makeSnapshot = useCallback((viewpoint: Viewpoint): ViewportSnapshot => ({
    centerCoord:        overviewCoord,
    previousSelectedId: null,
    selectedViewpoint:  viewpoint,
    screenshotUri:      null,
    capturedAt:         Date.now(),
  }), [overviewCoord]);

  // ── Main flow ────────────────────────────────────────────────────────
  const onMarkerPress = useCallback((viewpoint: Viewpoint) => {
    // Cancel any previous flow first
    cancelAll();

    setActiveViewpoint(viewpoint);
    const snapshot = makeSnapshot(viewpoint);
    dispatch({ type: 'TAP', viewpoint, snapshot });

    // Step 1 — zoom camera
    zoomTo(viewpoint);

    // Step 2 — after zoom finishes, show the photo full-screen
    after(() => {
      dispatch({ type: 'ZOOM_DONE' });
      setShowPhoto(true);
    }, ZOOM_MS);

    // Step 3 — after 3s of showing photo, fetch detail + open modal
    // Photo stays visible — it only hides when the user dismisses
    after(async () => {
      const detail = await fetchDetail(viewpoint.id).catch(() => null);
      dispatch({ type: 'IMAGE_READY' });   // → modal_pending
      dispatch({ type: 'MODAL_OPEN', detail });
      // showPhoto remains true — photo visible behind the modal card
    }, ZOOM_MS + PHOTO_HOLD_MS);           // 800 + 3000 = 3800ms total

  }, [cancelAll, makeSnapshot, zoomTo, after, fetchDetail]);

  // ── Dismiss ──────────────────────────────────────────────────────────
  const onDismiss = useCallback(() => {
    cancelAll();
    dispatch({ type: 'DISMISS' });
    setShowPhoto(false);
    setActiveViewpoint(null);
    zoomBack();
  }, [cancelAll, zoomBack]);

  // ── Auto-reset after dismissed ───────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'dismissed') dispatch({ type: 'CANCEL' });
  }, [state.phase]);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => () => cancelAll(), [cancelAll]);

  return { state, onMarkerPress, onDismiss, showPhoto, activeViewpoint };
}