import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { SafetyKind, SafetyResponse } from './hikeSafetyNotifications';

/* ------------------------------------------------------------------ types */

export interface PendingCheck {
  check_id: string;
  kind: SafetyKind;
  planned_finish_at: string; // ISO
  title: string;             // hike destination or event title
}

export interface AdminSafetyRow {
  check_id: string;
  kind: SafetyKind;
  subject_user_id: string;
  subject_name: string | null;
  subject_email: string | null;
  title: string;
  planned_finish_at: string;
  response_status: 'pending' | 'got_home' | 'not_home_yet';
  responded_at: string | null;
  // Alert state, from the viewer-admin's perspective
  active_alert_id: string | null;
  active_alert_type: 'not_home_yet' | 'timeout' | null;
  active_alert_triggered_at: string | null;
  seen: boolean;
  // Only present for events
  event_id?: string | null;
  event_duration_hours?: number | null;
  needs_duration?: boolean;
}

/* -------------------------------------------------------- offline queue */

const QUEUE_KEY = 'saka.safety.respQueue.v1';

interface QueuedResponse {
  check_id: string;
  kind: SafetyKind;
  status: SafetyResponse;
  queued_at: number;
}

async function readQueue(): Promise<QueuedResponse[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedResponse[]) : [];
  } catch { return []; }
}

async function writeQueue(items: QueuedResponse[]): Promise<void> {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch {}
}

async function enqueue(entry: QueuedResponse): Promise<void> {
  const q = await readQueue();
  // De-dupe: latest response for a given check wins.
  const filtered = q.filter((x) => x.check_id !== entry.check_id);
  filtered.push(entry);
  await writeQueue(filtered);
}

/* ------------------------------------------------------------------ writes */

export const hikeSafetyService = {
  /**
   * Create or refresh the safety-check row for a hike.
   * `plannedFinishAt` is an absolute instant already resolved from the hike's
   * wall-clock end_time in the device's current timezone.
   */
  async upsertHikeCheck(args: {
    hikeId: string;
    userId: string;
    plannedFinishAt: Date;
  }): Promise<{ checkId: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from('hike_safety_checks')
      .upsert(
        {
          hike_id: args.hikeId,
          user_id: args.userId,
          planned_finish_at: args.plannedFinishAt.toISOString(),
          // If the finish time is being changed, reset the check.
          response_status: 'pending',
          responded_at: null,
        },
        { onConflict: 'hike_id' },
      )
      .select('id')
      .single();
    if (error) return { checkId: null, error: error.message };
    return { checkId: data.id as string, error: null };
  },

  async deleteHikeCheck(hikeId: string): Promise<void> {
    await supabase.from('hike_safety_checks').delete().eq('hike_id', hikeId);
  },

  async upsertEventCheck(args: {
    eventId: string;
    rsvpId: string;
    userId: string;
    plannedFinishAt: Date;
  }): Promise<{ checkId: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from('event_safety_checks')
      .upsert(
        {
          event_id: args.eventId,
          rsvp_id: args.rsvpId,
          user_id: args.userId,
          planned_finish_at: args.plannedFinishAt.toISOString(),
          response_status: 'pending',
          responded_at: null,
        },
        { onConflict: 'rsvp_id' },
      )
      .select('id')
      .single();
    if (error) return { checkId: null, error: error.message };
    return { checkId: data.id as string, error: null };
  },

  async deleteEventCheck(rsvpId: string): Promise<void> {
    await supabase.from('event_safety_checks').delete().eq('rsvp_id', rsvpId);
  },

  /**
   * Submit a response. If the network is down, queue it locally and report
   * `queued: true`. Alerts are only created once the request hits the server
   * (or the timeout processor fires), matching the brief.
   */
  async respond(args: {
    checkId: string;
    kind: SafetyKind;
    status: SafetyResponse;
  }): Promise<{ ok: boolean; queued: boolean; error: string | null }> {
    const rpc = args.kind === 'hike' ? 'respond_to_hike_check' : 'respond_to_event_check';
    try {
      const { error } = await supabase.rpc(rpc, {
        p_check_id: args.checkId,
        p_status: args.status,
      });
      if (error) throw error;
      return { ok: true, queued: false, error: null };
    } catch (e: any) {
      await enqueue({
        check_id: args.checkId,
        kind: args.kind,
        status: args.status,
        queued_at: Date.now(),
      });
      return { ok: false, queued: true, error: e?.message ?? 'offline' };
    }
  },

  /** Replay the offline queue. Returns the number of items successfully sent. */
  async flushQueue(): Promise<number> {
    const queue = await readQueue();
    if (queue.length === 0) return 0;

    let sent = 0;
    const remaining: QueuedResponse[] = [];
    for (const entry of queue) {
      const rpc = entry.kind === 'hike' ? 'respond_to_hike_check' : 'respond_to_event_check';
      const { error } = await supabase.rpc(rpc, {
        p_check_id: entry.check_id,
        p_status: entry.status,
      });
      if (error) {
        // If the server has already accepted a response, the RPC returns the
        // existing row without error, so a real error here is transient.
        remaining.push(entry);
      } else {
        sent += 1;
      }
    }
    await writeQueue(remaining);
    return sent;
  },

  /* ---------------------------------------------------------------- reads */

  /** All pending checks for the signed-in user, used for reconcile on start. */
  async getMyPendingChecks(): Promise<PendingCheck[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const [hikeRes, evtRes] = await Promise.all([
      supabase
        .from('hike_safety_checks')
        .select('id, planned_finish_at, response_status, hikes:mountain_name, hikes:date')
        .eq('user_id', user.id)
        .eq('response_status', 'pending'),
      supabase
        .from('event_safety_checks')
        .select('id, planned_finish_at, response_status, hiking_events:title')
        .eq('user_id', user.id)
        .eq('response_status', 'pending'),
    ]);

    const out: PendingCheck[] = [];
    for (const r of (hikeRes.data ?? []) as any[]) {
      out.push({
        check_id: r.id,
        kind: 'hike',
        planned_finish_at: r.planned_finish_at,
        title: r.mountain_name ?? r.date ?? 'Hike',
      });
    }
    for (const r of (evtRes.data ?? []) as any[]) {
      out.push({
        check_id: r.id,
        kind: 'event',
        planned_finish_at: r.planned_finish_at,
        title: r.title ?? 'Event',
      });
    }
    return out;
  },

  /**
   * Admin-only: the master safety list.
   * `seen` is scoped to the calling admin via admin_alert_seen.
   */
  async getAdminSafetyList(): Promise<{
    hikes: AdminSafetyRow[];
    events: AdminSafetyRow[];
    error: string | null;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { hikes: [], events: [], error: 'not signed in' };

    const [{ data: hikes, error: hErr }, { data: events, error: eErr }, { data: seenRows }] =
      await Promise.all([
        supabase.rpc('admin_list_hike_checks'),
        supabase.rpc('admin_list_event_checks'),
        supabase.from('admin_alert_seen').select('alert_id').eq('admin_user_id', user.id),
      ]);

    if (hErr || eErr) {
      return { hikes: [], events: [], error: (hErr ?? eErr)?.message ?? 'load failed' };
    }

    const seenSet = new Set((seenRows ?? []).map((r: any) => r.alert_id));
    const shape = (rows: any[]): AdminSafetyRow[] =>
      rows.map((r) => ({
        check_id: r.check_id,
        kind: r.kind,
        subject_user_id: r.subject_user_id,
        subject_name: r.subject_name,
        subject_email: r.subject_email,
        title: r.title,
        planned_finish_at: r.planned_finish_at,
        response_status: r.response_status,
        responded_at: r.responded_at,
        active_alert_id: r.active_alert_id,
        active_alert_type: r.active_alert_type,
        active_alert_triggered_at: r.active_alert_triggered_at,
        seen: r.active_alert_id ? seenSet.has(r.active_alert_id) : true,
        event_id: r.event_id ?? null,
        event_duration_hours: r.event_duration_hours ?? null,
        needs_duration: r.needs_duration ?? false,
      }));

    return {
      hikes: shape(hikes ?? []),
      events: shape(events ?? []),
      error: null,
    };
  },

  async markAlertSeen(alertId: string): Promise<{ error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'not signed in' };
    const { error } = await supabase
      .from('admin_alert_seen')
      .upsert(
        { alert_id: alertId, admin_user_id: user.id },
        { onConflict: 'alert_id,admin_user_id' },
      );
    return { error: error?.message ?? null };
  },
};