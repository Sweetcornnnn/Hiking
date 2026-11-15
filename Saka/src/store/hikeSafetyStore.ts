import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import {
  hikeSafetyService,
  type AdminSafetyRow,
  type PendingCheck,
} from '../services/hikeSafetyService';
import {
  attachNotificationReceivedListener,
  attachResponseListener,
  cancelFollowUp,
  cancelCheck,
  clearLastResponse,
  getCompletedCheckIds,
  getFollowUpChecks,
  getLastResponse,
  installNotificationHandler,
  reconcileSchedules,
  scheduleCheck,
  scheduleFollowUp,
  isCheckCompleted,
  type FollowUpCheck,
  type ResponseEvent,
  type SafetyKind,
} from '../services/hikeSafetyNotifications';

interface PromptState {
  checkId: string;
  kind: SafetyKind;
  title: string;
  mountain: string | null;
  activityDate: string | null;
  plannedFinishAt: string;
  isFollowUp: boolean;
}

interface PromptResponseResult {
  saved: boolean;
  reminderScheduled: boolean;
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
  respondToPrompt: (status: 'got_home' | 'not_home_yet') => Promise<PromptResponseResult>;
  handleResponseEvent: (e: ResponseEvent) => Promise<void>;
  reconcile: () => Promise<void>;
  loadAdminSafety: () => Promise<void>;
  markAdminAlertSeen: (alertId: string) => Promise<string | null>;
}

let listenerAttached = false;
let notificationListenerAttached = false;
let appStateAttached = false;

async function submitSafetyResponse(
  e: ResponseEvent & { action: 'got_home' | 'not_home_yet' },
): Promise<boolean> {
  const { ok, queued } = await hikeSafetyService.respond({
    checkId: e.checkId,
    kind: e.kind,
    status: e.action,
  });
  await cancelCheck(e.checkId);
  if (e.action === 'got_home') await cancelFollowUp(e.checkId);
  return ok || queued;
}

function makeFollowUpPrompt(event: ResponseEvent, pending?: PendingCheck): FollowUpCheck {
  return {
    checkId: event.checkId,
    kind: event.kind,
    title: pending?.title ?? event.title ?? (event.kind === 'hike' ? 'Hike' : 'Event'),
    mountain: pending?.mountain ?? event.mountain ?? null,
    activityDate: pending?.activity_date ?? event.activityDate ?? null,
    plannedFinishAt:
      pending?.planned_finish_at ?? event.plannedFinishAt ?? new Date().toISOString(),
  };
}

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
    if (last) {
      await get().handleResponseEvent(last);
      await clearLastResponse();
    }

    if (!listenerAttached) {
      attachResponseListener((e) => get().handleResponseEvent(e));
      listenerAttached = true;
    }

    if (!notificationListenerAttached) {
      attachNotificationReceivedListener(() => get().reconcile());
      notificationListenerAttached = true;
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

  respondToPrompt: async (status) => {
    const prompt = get().prompt;
    if (!prompt) return { saved: false, reminderScheduled: false };
    set({ busy: true });
    try {
      let saved: boolean;
      let reminderScheduled = false;
      if (status === 'not_home_yet' && prompt.isFollowUp) {
        reminderScheduled = await scheduleFollowUp(prompt);
        saved = true;
      } else {
        saved = await submitSafetyResponse({
          checkId: prompt.checkId,
          kind: prompt.kind,
          action: status,
        });
        if (saved && status === 'not_home_yet') {
          reminderScheduled = await scheduleFollowUp(prompt);
        }
      }

      if (saved) {
        set((s) => ({ prompt: s.prompt?.checkId === prompt.checkId ? null : s.prompt }));
      }
      return { saved, reminderScheduled };
    } finally {
      set({ busy: false });
    }
  },

  handleResponseEvent: async (e) => {
    if (await isCheckCompleted(e.checkId)) return;

    if (e.action === 'opened') {
      await get().reconcile();
      return;
    }

    if (e.action === 'not_home_yet' && e.followUp) {
      const current = (await getFollowUpChecks()).find((item) => item.checkId === e.checkId);
      await scheduleFollowUp(current ?? makeFollowUpPrompt(e));
      set((s) => ({ prompt: s.prompt?.checkId === e.checkId ? null : s.prompt }));
      return;
    }

    if (e.action === 'not_home_yet') {
      const followUp = makeFollowUpPrompt(e);
      const saved = await submitSafetyResponse(e);
      if (saved) await scheduleFollowUp(followUp);
      if (saved) {
        set((s) => ({ prompt: s.prompt?.checkId === e.checkId ? null : s.prompt }));
      }
      return;
    }

    const saved = await submitSafetyResponse(e);
    if (saved) {
      set((s) => ({ prompt: s.prompt?.checkId === e.checkId ? null : s.prompt }));
    }
  },

  reconcile: async () => {
    const pending: PendingCheck[] = await hikeSafetyService.getMyPendingChecks();
    const followUps = await getFollowUpChecks();
    const followUpIds = new Set(followUps.map((item) => item.checkId));
    const completedIds = await getCompletedCheckIds();
    const activePending = pending.filter(
      (item) => !followUpIds.has(item.check_id) && !completedIds.has(item.check_id),
    );

    await reconcileSchedules(
      activePending.map((p) => ({
        checkId: p.check_id,
        kind: p.kind,
        plannedFinishAt: new Date(p.planned_finish_at),
        title: p.title,
        mountain: p.mountain,
        activityDate: p.activity_date,
      })),
    );

    // Surface the *first* check whose planned finish has passed and still
    // has no response — that's the foreground prompt.
    const now = Date.now();
    const dueFollowUp = followUps.find(
      (item) => new Date(item.nextReminderAt).getTime() <= now,
    );
    const overdue = activePending.find((p) => new Date(p.planned_finish_at).getTime() <= now);
    const upcoming = activePending.find((p) => new Date(p.planned_finish_at).getTime() <= now + 60_000);
    const target = dueFollowUp ?? overdue ?? upcoming ?? null;

    if (target && !get().prompt) {
      set({
        prompt: {
          checkId: 'checkId' in target ? target.checkId : target.check_id,
          kind: target.kind,
          title: target.title,
          mountain: target.mountain,
          activityDate: 'activityDate' in target ? target.activityDate : target.activity_date,
          plannedFinishAt:
            'plannedFinishAt' in target ? target.plannedFinishAt : target.planned_finish_at,
          isFollowUp: 'nextReminderAt' in target,
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
    if (error) return error;
    set((s) => ({
      adminHikes: s.adminHikes.map((r) =>
        r.active_alert_id === alertId ? { ...r, seen: true } : r,
      ),
      adminEvents: s.adminEvents.map((r) =>
        r.active_alert_id === alertId ? { ...r, seen: true } : r,
      ),
    }));
    return null;
  },
}));