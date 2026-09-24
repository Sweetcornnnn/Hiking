import { supabase } from '../lib/supabase';
import type { HikingEvent } from './organizationService';

export interface EventOrganizationSummary {
  id: string;
  name: string;
  logo_url: string | null;
  is_verified: boolean;
}

export interface PublicEvent extends HikingEvent {
  organizations: EventOrganizationSummary | null;
}

export interface PublicEventFilters {
  mountainId?: string;
  difficulty?: string;
  dateFrom?: string; // YYYY-MM-DD
}

export interface EventRsvpCounts {
  confirmed: number;
  waitlist: number;
  total: number;
}

export interface MyRsvp {
  id: string;
  event_id: string;
  status: string;
  guest_count: number;
  checked_in: boolean;
  created_at: string;
}

export const eventService = {
  async getPublicEvents(filters?: PublicEventFilters): Promise<PublicEvent[]> {
    let query = supabase
      .from('hiking_events')
      .select('*, organizations(id, name, logo_url, is_verified)')
      .eq('is_public', true)
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (filters?.mountainId) query = query.eq('mountain_id', filters.mountainId);
    if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);
    if (filters?.dateFrom)   query = query.gte('event_date', filters.dateFrom);

    const { data, error } = await query;
    if (error) {
      console.error('[EventService] getPublicEvents error:', error);
      return [];
    }
    return (data ?? []) as unknown as PublicEvent[];
  },

  async getEventById(eventId: string): Promise<PublicEvent | null> {
    const { data, error } = await supabase
      .from('hiking_events')
      .select('*, organizations(id, name, logo_url, is_verified)')
      .eq('id', eventId)
      .maybeSingle();

    if (error) {
      console.error('[EventService] getEventById error:', error);
      return null;
    }
    return (data as unknown as PublicEvent) ?? null;
  },

  async getRsvpCounts(eventIds: string[]): Promise<Record<string, EventRsvpCounts>> {
    const out: Record<string, EventRsvpCounts> = {};
    if (eventIds.length === 0) return out;
    for (const id of eventIds) out[id] = { confirmed: 0, waitlist: 0, total: 0 };

    const { data, error } = await supabase.rpc('get_event_rsvp_counts', {
      p_event_ids: eventIds,
    });

    if (error || !data) {
      console.error('[EventService] getRsvpCounts error:', error);
      return out;
    }

    for (const row of data as Array<{
      event_id: string;
      confirmed: number;
      waitlist: number;
      total: number;
    }>) {
      if (!out[row.event_id]) continue;
      out[row.event_id] = {
        confirmed: row.confirmed ?? 0,
        waitlist: row.waitlist ?? 0,
        total: row.total ?? 0,
      };
    }
    return out;
  },

  async getMyRsvpForEvent(eventId: string): Promise<MyRsvp | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('id, event_id, status, guest_count, checked_in, created_at')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[EventService] getMyRsvpForEvent error:', error);
      return null;
    }
    return (data as MyRsvp) ?? null;
  },

  async getMyRsvps(): Promise<MyRsvp[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('id, event_id, status, guest_count, checked_in, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EventService] getMyRsvps error:', error);
      return [];
    }
    return (data ?? []) as MyRsvp[];
  },

  async rsvpToEvent(
    eventId: string,
    guestCount = 1
  ): Promise<{ status: string | null; error: string | null }> {
    const { data, error } = await supabase.rpc('rsvp_to_event', {
      p_event_id: eventId,
      p_guest_count: guestCount,
    });

    if (error) {
      console.error('[EventService] rsvpToEvent error:', error);
      return { status: null, error: error.message };
    }

    const row = data as { status?: string } | null;
    return { status: row?.status ?? null, error: null };
  },

  async cancelMyRsvp(rsvpId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('cancel_my_rsvp', { p_rsvp_id: rsvpId });
    if (error) {
      console.error('[EventService] cancelMyRsvp error:', error);
      return { error: error.message };
    }
    return { error: null };
  },
};