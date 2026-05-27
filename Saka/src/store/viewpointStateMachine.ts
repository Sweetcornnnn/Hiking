/**
 * viewpointStateMachine.ts
 *
 * Pure reducer — no side effects, no timers, no refs.
 * All async orchestration lives in useViewpointFlow.ts.
 * This file is 100% unit-testable.
 *
 * Transition table:
 *  idle          + TAP        → zooming
 *  zooming       + TAP        → zooming  (cancel old, start new)
 *  zooming       + ZOOM_DONE  → image_revealing
 *  zooming       + CANCEL     → idle
 *  image_revealing + IMAGE_READY → modal_pending
 *  image_revealing + CANCEL   → idle
 *  modal_pending   + MODAL_OPEN → modal_open
 *  modal_pending   + CANCEL   → idle
 *  modal_open      + DISMISS  → dismissed
 *  modal_open      + CANCEL   → idle
 *  dismissed       + *        → idle  (auto-reset)
 */

import type {
  ViewpointFlowState,
  ViewpointFlowAction,
} from '../types/viewpointTypes';

export function viewpointReducer(
  state: ViewpointFlowState,
  action: ViewpointFlowAction,
): ViewpointFlowState {
  // ── CANCEL is valid from any non-idle state ──────────────────────────
  if (action.type === 'CANCEL') {
    return { phase: 'idle' };
  }

  // ── Auto-reset from dismissed ────────────────────────────────────────
  if (state.phase === 'dismissed') {
    return { phase: 'idle' };
  }

  switch (state.phase) {
    // ── idle ────────────────────────────────────────────────────────────
    case 'idle': {
      if (action.type === 'TAP') {
        return {
          phase: 'zooming',
          viewpoint: action.viewpoint,
          snapshot:  action.snapshot,
        };
      }
      return state;
    }

    // ── zooming ─────────────────────────────────────────────────────────
    case 'zooming': {
      if (action.type === 'TAP') {
        // A second tap while zooming: cancel previous, restart
        return {
          phase: 'zooming',
          viewpoint: action.viewpoint,
          snapshot:  action.snapshot,
        };
      }
      if (action.type === 'ZOOM_DONE') {
        return {
          phase:     'image_revealing',
          viewpoint: state.viewpoint,
          snapshot:  state.snapshot,
        };
      }
      return state;
    }

    // ── image_revealing ─────────────────────────────────────────────────
    case 'image_revealing': {
      if (action.type === 'IMAGE_READY') {
        return {
          phase:     'modal_pending',
          viewpoint: state.viewpoint,
          snapshot:  state.snapshot,
        };
      }
      // New tap while revealing: restart from zooming
      if (action.type === 'TAP') {
        return {
          phase:     'zooming',
          viewpoint: action.viewpoint,
          snapshot:  action.snapshot,
        };
      }
      return state;
    }

    // ── modal_pending ────────────────────────────────────────────────────
    case 'modal_pending': {
      if (action.type === 'MODAL_OPEN') {
        return {
          phase:     'modal_open',
          viewpoint: state.viewpoint,
          snapshot:  state.snapshot,
          detail:    action.detail,
        };
      }
      if (action.type === 'TAP') {
        return {
          phase:     'zooming',
          viewpoint: action.viewpoint,
          snapshot:  action.snapshot,
        };
      }
      return state;
    }

    // ── modal_open ───────────────────────────────────────────────────────
    case 'modal_open': {
      if (action.type === 'DISMISS') {
        return { phase: 'dismissed' };
      }
      if (action.type === 'TAP') {
        // Tap while modal open: dismiss current, start new flow
        return {
          phase:     'zooming',
          viewpoint: action.viewpoint,
          snapshot:  action.snapshot,
        };
      }
      return state;
    }

    default:
      return state;
  }
}

/** Selector helpers — keep components clean */
export const isModalVisible = (s: ViewpointFlowState): boolean =>
  s.phase === 'modal_open';

export const isAnimating = (s: ViewpointFlowState): boolean =>
  s.phase === 'zooming' || s.phase === 'image_revealing' || s.phase === 'modal_pending';

export const activeViewpoint = (s: ViewpointFlowState) =>
  'viewpoint' in s ? s.viewpoint : null;

export const activeSnapshot = (s: ViewpointFlowState) =>
  'snapshot' in s ? s.snapshot : null;