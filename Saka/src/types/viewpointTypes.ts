/**
 * viewpointTypes.ts
 *
 * All TypeScript types for the Viewpoint feature.
 * Kept separate so tests, components, and the state machine
 * can all import without circular dependencies.
 */

import type { ReactNode } from 'react';

// ─── Viewpoint data (mirrors MountainTop.tsx waypoint shape) ──────────────
export interface Viewpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: string;
  notes?: string;
}

// ─── Viewpoint detail data (matches viewpointsData.ts shape) ──────────────
export interface ViewpointFeature {
  icon: string;
  text: string;
  safe: boolean;
}

export interface ViewpointDetail {
  imageKey: string;
  accentColor: string;
  name: string;
  subtitle: string;
  elevation: string;
  distanceFromStart: string;
  estimatedHike: string;
  bestTime: string;
  tags: string[];
  description: string;
  features: ViewpointFeature[];
}

// ─── Captured viewport snapshot ───────────────────────────────────────────
/**
 * A serialisable snapshot of the TrailMap viewport state
 * taken at the moment a marker is pressed.
 *
 * We deliberately do NOT capture React nodes (not serialisable).
 * Instead we capture the data needed to re-render the viewport
 * in the modal header, plus a fallback screenshot URI.
 */
export interface ViewportSnapshot {
  /** Camera centre at time of capture */
  centerCoord: { latitude: number; longitude: number };
  /** Which viewpoint was active (if any) before this tap */
  previousSelectedId: string | null;
  /** The tapped viewpoint */
  selectedViewpoint: Viewpoint;
  /** base64 PNG from html2canvas fallback — null if not taken */
  screenshotUri: string | null;
  /** Timestamp for cancellation bookkeeping */
  capturedAt: number;
}

// ─── Modal props ──────────────────────────────────────────────────────────
export interface ViewpointModalProps {
  visible: boolean;
  snapshot: ViewportSnapshot | null;
  detail: ViewpointDetail | null;
  onDismiss: () => void;
  mountainId: string;
}

// ─── State machine ────────────────────────────────────────────────────────
/**
 * Five-state machine for the zoom→reveal→modal flow.
 *
 *  idle → zooming → image_revealing → modal_pending → modal_open
 *                                                   ↘ dismissed → idle
 * Any state can transition to idle via cancel().
 */
export type ViewpointFlowState =
  | { phase: 'idle' }
  | { phase: 'zooming';          viewpoint: Viewpoint; snapshot: ViewportSnapshot }
  | { phase: 'image_revealing';  viewpoint: Viewpoint; snapshot: ViewportSnapshot }
  | { phase: 'modal_pending';    viewpoint: Viewpoint; snapshot: ViewportSnapshot }
  | { phase: 'modal_open';       viewpoint: Viewpoint; snapshot: ViewportSnapshot; detail: ViewpointDetail | null }
  | { phase: 'dismissed' };

export type ViewpointFlowAction =
  | { type: 'TAP';      viewpoint: Viewpoint; snapshot: ViewportSnapshot }
  | { type: 'ZOOM_DONE' }
  | { type: 'IMAGE_READY' }
  | { type: 'MODAL_OPEN'; detail: ViewpointDetail | null }
  | { type: 'DISMISS' }
  | { type: 'CANCEL' };