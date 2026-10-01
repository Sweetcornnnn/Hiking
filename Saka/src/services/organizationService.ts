import { supabase } from '../lib/supabase';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface HikingEvent {
  id: string;
  organization_id: string;
  mountain_id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  meeting_point: string;
  difficulty: string;
  duration_hours: number | null;
  capacity: number | null;
  is_public: boolean;
  allow_walkins: boolean;
  status: EventStatus;              
  safety_notes: string | null;      
  required_gear: string | null;     
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventAttendee {
  rsvp_id: string;
  user_id: string;
  status: string;
  guest_count: number;
  checked_in: boolean;
  created_at: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
}

export interface DashboardStats {
  upcomingCount: number;
  totalAttendees: number;
  waitlistCount: number;
  draftCount: number;
  publishedCount: number;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  logo_url?: string;
}

export interface CreateEventInput {
  organization_id: string;
  mountain_id: string;
  title: string;
  description?: string;
  event_date: string;      // YYYY-MM-DD
  start_time: string;      // HH:MM (24h)
  meeting_point: string;
  difficulty: string;
  duration_hours?: number | null;
  capacity?: number | null;
  is_public: boolean;
  allow_walkins: boolean;
  status: EventStatus;     // 'draft' or 'published'
  safety_notes?: string;
  required_gear?: string;
}

export type EventStatus = 'draft' | 'published' | 'full' | 'cancelled' | 'completed';

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export const organizationService = {
  slugify,

  async getMyOrganization(): Promise<Organization | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[OrgService] getMyOrganization error:', error);
      return null;
    }

    // Supabase types the nested row loosely; cast through unknown.
    const row = data as unknown as { organizations: Organization | null } | null;
    return row?.organizations ?? null;
  },

  async createOrganization(
    input: CreateOrganizationInput
  ): Promise<{ organizationId: string | null; error: string | null }> {
    const { data, error } = await supabase.rpc('create_organization_with_owner', {
      p_name: input.name,
      p_slug: input.slug,
      p_description: input.description ?? null,
      p_contact_email: input.contact_email ?? null,
      p_contact_phone: input.contact_phone ?? null,
      p_website: input.website ?? null,
      p_logo_url: input.logo_url ?? null,
    });

    if (error) {
      console.error('[OrgService] createOrganization error:', error);
      return { organizationId: null, error: error.message };
    }

    const organizationId = typeof data === 'string' ? data : null;
    if (!organizationId) {
      return { organizationId: null, error: 'Organization created but no id returned' };
    }
    return { organizationId, error: null };
  },

  async getOrganizationById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[OrgService] getOrganizationById error:', error);
      return null;
    }
    return data as Organization;
  },

  async updateOrganization(
    id: string,
    patch: Partial<CreateOrganizationInput>
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from('organizations').update(patch).eq('id', id);
    return { error: error?.message ?? null };
  },

    async getMyEvents(organizationId: string): Promise<HikingEvent[]> {
    const { data, error } = await supabase
      .from('hiking_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrgService] getMyEvents error:', error);
      return [];
    }
    return (data ?? []) as HikingEvent[];
  },

    async createEvent(
    input: CreateEventInput
  ): Promise<{ eventId: string | null; error: string | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { eventId: null, error: 'You must be signed in' };
    }

    const { data, error } = await supabase
      .from('hiking_events')
      .insert({
        ...input,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[OrgService] createEvent error:', error);
      // Surface the DB trigger's verification rule clearly
      if (error.message?.includes('verified')) {
        return { eventId: null, error: 'Your organization must be verified to publish.' };
      }
      return { eventId: null, error: error.message };
    }

    return { eventId: (data as { id: string }).id, error: null };
  },

  async updateEventStatus(
    eventId: string,
    status: EventStatus
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('hiking_events')
      .update({ status })
      .eq('id', eventId);

    if (error) {
      if (error.message?.includes('verified')) {
        return { error: 'Your organization must be verified to publish.' };
      }
      return { error: error.message };
    }
    return { error: null };
  },

  async getEventById(eventId: string): Promise<HikingEvent | null> {
    const { data, error } = await supabase
      .from('hiking_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('[OrgService] getEventById error:', error);
      return null;
    }
    return data as HikingEvent;
  },

    async deleteEvent(eventId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('hiking_events').delete().eq('id', eventId);
    return { error: error?.message ?? null };
  },

  async getEventAttendees(eventId: string): Promise<EventAttendee[]> {
    const { data: rsvps, error: rsvpErr } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (rsvpErr || !rsvps) {
      console.error('[OrgService] getEventAttendees rsvp error:', rsvpErr);
      return [];
    }

    const userIds = Array.from(new Set(rsvps.map((r: any) => r.user_id)));
    let profileRows: Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      contact_number: string | null;
    }> = [];

    if (userIds.length > 0) {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, contact_number')
        .in('id', userIds);

      if (profileErr) {
        console.warn('[OrgService] getEventAttendees profile lookup failed:', profileErr.message);
      } else {
        profileRows = (data ?? []) as typeof profileRows;
      }
    }

    const profileMap = new Map(profileRows.map((p) => [p.id, p]));

    return rsvps.map((r: any) => {
      const profile = profileMap.get(r.user_id);
      return {
        rsvp_id: r.id,
        user_id: r.user_id,
        status: r.status,
        guest_count: r.guest_count ?? 1,
        checked_in: r.checked_in ?? false,
        created_at: r.created_at,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        contact_number: profile?.contact_number ?? null,
      };
    });
  },

  async getEventRsvpCounts(
    eventIds: string[]
  ): Promise<Record<string, { confirmed: number; waitlist: number; total: number }>> {
    const empty: Record<string, { confirmed: number; waitlist: number; total: number }> = {};
    if (eventIds.length === 0) return empty;

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('event_id, status, guest_count')
      .in('event_id', eventIds);

    if (error || !data) {
      console.error('[OrgService] getEventRsvpCounts error:', error);
      return empty;
    }

    const result: Record<string, { confirmed: number; waitlist: number; total: number }> = {};
    for (const id of eventIds) result[id] = { confirmed: 0, waitlist: 0, total: 0 };

    for (const row of data as Array<{ event_id: string; status: string; guest_count: number }>) {
      const bucket = result[row.event_id];
      if (!bucket) continue;
      const guests = row.guest_count ?? 1;
      if (row.status === 'confirmed' || row.status === 'pending') {
        bucket.confirmed += guests;
      } else if (row.status === 'waitlist') {
        bucket.waitlist += guests;
      }
      bucket.total += guests;
    }

    return result;
  },

  async updateRsvpStatus(
    rsvpId: string,
    status: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from('event_rsvps').update({ status }).eq('id', rsvpId);
    return { error: error?.message ?? null };
  },

  async toggleRsvpCheckIn(
    rsvpId: string,
    checkedIn: boolean
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('event_rsvps')
      .update({ checked_in: checkedIn })
      .eq('id', rsvpId);
    return { error: error?.message ?? null };
  },

  async getDashboardStats(organizationId: string): Promise<DashboardStats> {
    const events = await this.getMyEvents(organizationId);
    const today = new Date().toISOString().slice(0, 10);

    const upcomingCount = events.filter(
      (e) => e.event_date >= today && e.status === 'published'
    ).length;
    const draftCount = events.filter((e) => e.status === 'draft').length;
    const publishedCount = events.filter((e) => e.status === 'published').length;

    const eventIds = events.map((e) => e.id);
    let totalAttendees = 0;
    let waitlistCount = 0;

    if (eventIds.length > 0) {
      const { data: rsvps, error } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .in('event_id', eventIds);

      if (!error && rsvps) {
        totalAttendees = rsvps.filter(
          (r) => r.status === 'confirmed' || r.status === 'pending'
        ).length;
        waitlistCount = rsvps.filter((r) => r.status === 'waitlist').length;
      }
    }

    return { upcomingCount, totalAttendees, waitlistCount, draftCount, publishedCount };
  },

    async adminListOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrgService] adminListOrganizations error:', error);
      return [];
    }
    return (data ?? []) as Organization[];
  },

  async adminSetVerified(
    orgId: string,
    verified: boolean
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('organizations')
      .update({ is_verified: verified })
      .eq('id', orgId);
    return { error: error?.message ?? null };
  },

    async adminListEvents(): Promise<
    Array<HikingEvent & { organizations: { name: string } | null }>
  > {
    const { data, error } = await supabase
      .from('hiking_events')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrgService] adminListEvents error:', error);
      return [];
    }
    return (data ?? []) as unknown as Array<
      HikingEvent & { organizations: { name: string } | null }
    >;
  },

  async adminCancelEvent(eventId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('hiking_events')
      .update({ status: 'cancelled' })
      .eq('id', eventId);
    return { error: error?.message ?? null };
  },

  async adminReinstateEvent(eventId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('hiking_events')
      .update({ status: 'published' })
      .eq('id', eventId);
    return { error: error?.message ?? null };
  },
};