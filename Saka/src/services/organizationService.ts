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
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
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
      .order('event_date', { ascending: true });

    if (error) {
      console.error('[OrgService] getMyEvents error:', error);
      return [];
    }
    return (data ?? []) as HikingEvent[];
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
};