import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import {
  hikeSafetyService,
  type AdminSafetyRow,
  type PendingCheck,
} from '../services/hikeSafetyService';
import {
  attachResponseListener,
  cancelCheck,
  getLastResponse,
  installNotificationHandler,
  reconcileSchedules,
  scheduleCheck,
  type ResponseEvent,
  type SafetyKind,
} from '../services/hikeSafetyNotifications';

interface PromptState {
  checkId: string;
  kind: SafetyKind;
  title: string;
}

interface HikeSafetyState {
  prompt: PromptState | null;
  busy: boolean;
  adminHikes: AdminSafetyRow[];
  adminEvents: AdminSafetyRow[];
  adminLoading: boolean;
  adminError: string | null;
  bootstrapped: boolean;

  bootstrap: () => Promise<void>;
  dismissPrompt: () => void;
  respondToPrompt: (status: 'got_home' | 'not_home_yet') => Promise<void>;
  handleResponseEvent: (e: ResponseEvent) => Promise<void>;
  reconcile: () => Promise<void>;
  loadAdminSafety: () => Promise<void>;
  markAdminAlertSeen: (alertId: string) => Promise<void>;
}

let listenerAttached = false;
let appStateAttached = false;

export const useHikeSafetyStore = create<HikeSafetyState>((set, get) => ({
  prompt: null,
  busy: false,
  adminHikes: [],
  adminEvents: [],
  adminLoading: false,
  adminError: null,
  bootstrapped: false,

  bootstrap: async () => {
    if (get().bootstrapped) return;
    installNotificationHandler();

    // If the app was launched by a notification action, handle it first.
    const last = await getLastResponse();
    if (last) await get().handleResponseEvent(last);

    if (!listenerAttached) {
      attachResponseListener((e) => get().handleResponseEvent(e));
      listenerAttached = true;
    }

    if (!appStateAttached) {
      AppState.addEventListener('change', (s: AppStateStatus) => {
        if (s === 'active') {
          get().reconcile();
          hikeSafetyService.flushQueue();
        }
      });
      appStateAttached = true;
    }

    await get().reconcile();
    await hikeSafetyService.flushQueue();
    set({ bootstrapped: true });
  },

  dismissPrompt: () => set({ prompt: null }),

  respondToPrompt: async (status) => {
    const prompt = get().prompt;
    if (!prompt) return;
    set({ busy: true });
    await get().handleResponseEvent({
      checkId: prompt.checkId,
      kind: prompt.kind,
      action: status,
    });
    set({ busy: false, prompt: null });
  },

  handleResponseEvent: async (e) => {
    const { ok, queued } = await hikeSafetyService.respond({
      checkId: e.checkId,
      kind: e.kind,
      status: e.action,
    });
    // Always cancel the local notification for this check.
    await cancelCheck(e.checkId);
    if (ok || queued) {
      set((s) => ({ prompt: s.prompt?.checkId === e.checkId ? null : s.prompt }));
    }
  },

  reconcile: async () => {
    const pending: PendingCheck[] = await hikeSafetyService.getMyPendingChecks();

    await reconcileSchedules(
      pending.map((p) => ({
        checkId: p.check_id,
        kind: p.kind,
        plannedFinishAt: new Date(p.planned_finish_at),
      })),
    );

    // Surface the *first* check whose planned finish has passed and still
    // has no response — that's the foreground prompt.
    const now = Date.now();
    const overdue = pending.find((p) => new Date(p.planned_finish_at).getTime() <= now);
    const upcoming = pending.find((p) => new Date(p.planned_finish_at).getTime() <= now + 60_000);
    const target = overdue ?? upcoming ?? null;

    if (target && !get().prompt) {
      set({
        prompt: {
          checkId: target.check_id,
          kind: target.kind,
          title: target.title,
        },
      });
    }
  },

  loadAdminSafety: async () => {
    set({ adminLoading: true, adminError: null });
    const { hikes, events, error } = await hikeSafetyService.getAdminSafetyList();
    set({
      adminHikes: hikes,
      adminEvents: events,
      adminLoading: false,
      adminError: error,
    });
  },

  markAdminAlertSeen: async (alertId) => {
    const { error } = await hikeSafetyService.markAlertSeen(alertId);
    if (error) return;
    set((s) => ({
      adminHikes: s.adminHikes.map((r) =>
        r.active_alert_id === alertId ? { ...r, seen: true } : r,
      ),
      adminEvents: s.adminEvents.map((r) =>
        r.active_alert_id === alertId ? { ...r, seen: true } : r,
      ),
    }));
  },
}));