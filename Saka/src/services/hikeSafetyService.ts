import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { SafetyKind, SafetyResponse } from './hikeSafetyNotifications';

export interface PendingCheck {
  check_id: string;
  kind: SafetyKind;
  planned_finish_at: string;
  title: string;
  mountain: string | null;
  activity_date: string | null;
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
  active_alert_id: string | null;
  active_alert_type: 'not_home_yet' | 'timeout' | null;
  active_alert_triggered_at: string | null;
  seen: boolean;
  event_id?: string | null;
  event_duration_hours?: number | null;
  needs_duration?: boolean;
}

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
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedResponse[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('[HikeSafety] Unable to persist response queue:', error);
  }
}

async function enqueue(entry: QueuedResponse): Promise<void> {
  const queue = await readQueue();
  const filtered = queue.filter((item) => item.check_id !== entry.check_id);
  filtered.push(entry);
  await writeQueue(filtered);
}

export const hikeSafetyService = {
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
          response_status: 'pending',
          responded_at: null,
        },
        { onConflict: 'hike_id' },
      )
      .select('id')
      .single();
    if (error) return { checkId: null, error: error.message };
    return { checkId: data.id, error: null };
  },

  async deleteHikeCheck(hikeId: string): Promise<void> {
    const { error } = await supabase.from('hike_safety_checks').delete().eq('hike_id', hikeId);
    if (error) console.warn('[HikeSafety] Unable to delete hike check:', error.message);
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
    return { checkId: data.id, error: null };
  },

  async deleteEventCheck(rsvpId: string): Promise<void> {
    const { error } = await supabase.from('event_safety_checks').delete().eq('rsvp_id', rsvpId);
    if (error) console.warn('[HikeSafety] Unable to delete event check:', error.message);
  },

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send safety response.';
      await enqueue({
        check_id: args.checkId,
        kind: args.kind,
        status: args.status,
        queued_at: Date.now(),
      });
      return { ok: false, queued: true, error: message };
    }
  },

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
        remaining.push(entry);
      } else {
        sent += 1;
      }
    }
    await writeQueue(remaining);
    return sent;
  },

  async getMyPendingChecks(): Promise<PendingCheck[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const [hikeRes, eventRes] = await Promise.all([
      supabase
        .from('hike_safety_checks')
        .select('id, planned_finish_at, response_status, hikes(mountain_name, mountain_id, date)')
        .eq('user_id', user.id)
        .eq('response_status', 'pending'),
      supabase
        .from('event_safety_checks')
        .select('id, planned_finish_at, response_status, hiking_events(title, event_date, mountain_id)')
        .eq('user_id', user.id)
        .eq('response_status', 'pending'),
    ]);

    const hikeRows = (hikeRes.data ?? []) as any[];
    const eventRows = (eventRes.data ?? []) as any[];
    const mountainIds = Array.from(new Set([
      ...hikeRows.map((row) => {
        const hike = Array.isArray(row.hikes) ? row.hikes[0] : row.hikes;
        return typeof hike?.mountain_id === 'string' ? hike.mountain_id : null;
      }),
      ...eventRows.map((row) => {
        const event = Array.isArray(row.hiking_events) ? row.hiking_events[0] : row.hiking_events;
        return typeof event?.mountain_id === 'string' ? event.mountain_id : null;
      }),
    ].filter((id): id is string => id !== null)));
    const mountainNames = new Map<string, string>();
    if (mountainIds.length > 0) {
      const { data: mountains, error: mountainError } = await supabase
        .from('mountains')
        .select('id, name, location')
        .in('id', mountainIds);
      if (mountainError) {
        console.warn('[HikeSafety] Could not load mountain names:', mountainError.message);
      } else {
        for (const mountain of mountains ?? []) {
          mountainNames.set(
            mountain.id,
            [mountain.name, mountain.location].filter(Boolean).join(' · '),
          );
        }
      }
    }

    const checks: PendingCheck[] = [];
    for (const row of hikeRows) {
      const hike = Array.isArray(row.hikes) ? row.hikes[0] : row.hikes;
      checks.push({
        check_id: row.id,
        kind: 'hike',
        planned_finish_at: row.planned_finish_at,
        title: hike?.mountain_name ?? hike?.date ?? 'Hike',
        mountain: hike?.mountain_name
          ?? (hike?.mountain_id ? mountainNames.get(hike.mountain_id) ?? null : null),
        activity_date: hike?.date ?? null,
      });
    }
    for (const row of eventRows) {
      const event = Array.isArray(row.hiking_events) ? row.hiking_events[0] : row.hiking_events;
      checks.push({
        check_id: row.id,
        kind: 'event',
        planned_finish_at: row.planned_finish_at,
        title: event?.title ?? 'Event',
        mountain: event?.mountain_id ? mountainNames.get(event.mountain_id) ?? null : null,
        activity_date: event?.event_date ?? null,
      });
    }
    return checks;
  },

  async getAdminSafetyList(): Promise<{
    hikes: AdminSafetyRow[];
    events: AdminSafetyRow[];
    error: string | null;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { hikes: [], events: [], error: 'not signed in' };

    const [hikeResult, eventResult, seenResult] = await Promise.all([
      supabase.rpc('admin_list_hike_checks'),
      supabase.rpc('admin_list_event_checks'),
      supabase.from('admin_alert_seen').select('alert_id').eq('admin_user_id', user.id),
    ]);
    if (hikeResult.error || eventResult.error) {
      return {
        hikes: [],
        events: [],
        error: (hikeResult.error ?? eventResult.error)?.message ?? 'Unable to load safety checks.',
      };
    }

    const seen = new Set((seenResult.data ?? []).map((row) => row.alert_id));
    const shapeRows = (rows: any[]): AdminSafetyRow[] =>
      rows.map((row) => ({
        check_id: row.check_id,
        kind: row.kind,
        subject_user_id: row.subject_user_id,
        subject_name: row.subject_name,
        subject_email: row.subject_email,
        title: row.title,
        planned_finish_at: row.planned_finish_at,
        response_status: row.response_status,
        responded_at: row.responded_at,
        active_alert_id: row.active_alert_id,
        active_alert_type: row.active_alert_type,
        active_alert_triggered_at: row.active_alert_triggered_at,
        seen: row.active_alert_id ? seen.has(row.active_alert_id) : true,
        event_id: row.event_id ?? null,
        event_duration_hours: row.event_duration_hours ?? null,
        needs_duration: row.needs_duration ?? false,
      }));

    return {
      hikes: shapeRows(hikeResult.data ?? []),
      events: shapeRows(eventResult.data ?? []),
      error: seenResult.error?.message ?? null,
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

  async setEventDuration(args: {
    eventId: string;
    durationHours: number;
  }): Promise<{ error: string | null }> {
    if (!Number.isFinite(args.durationHours) || args.durationHours <= 0) {
      return { error: 'Duration must be a positive number.' };
    }

    const { data: event, error: eventError } = await supabase
      .from('hiking_events')
      .select('id, event_date, start_time')
      .eq('id', args.eventId)
      .maybeSingle();
    if (eventError || !event) return { error: eventError?.message ?? 'Event not found.' };

    const start = new Date(`${event.event_date}T${event.start_time}`);
    if (Number.isNaN(start.getTime())) return { error: 'Invalid event start time.' };
    const finish = new Date(start.getTime() + args.durationHours * 3_600_000);

    const { error: checkError } = await supabase
      .from('event_safety_checks')
      .update({ planned_finish_at: finish.toISOString() })
      .eq('event_id', args.eventId);
    if (checkError) return { error: checkError.message };

    const { error: updateError } = await supabase
      .from('hiking_events')
      .update({ duration_hours: args.durationHours, end_time: null })
      .eq('id', args.eventId);
    if (updateError) return { error: updateError.message };

    return { error: null };
  },
};
