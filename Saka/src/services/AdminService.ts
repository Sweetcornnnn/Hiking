// services/adminService.ts
// Centralized admin queries. Keeps Admin.tsx free of ad-hoc Supabase calls.

import { supabase } from '../lib/supabase';
import { getSOSAlerts } from '../config/locationApi';

/* ───────────────────────── types ───────────────────────── */

export interface GlobalStats {
  totalHikes: number;
  totalUsers: number;
  totalOrgs: number;
  verifiedOrgs: number;
  pendingOrgs: number;
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  cancelledEvents: number;
  upcomingEvents: number;
  totalRsvps: number;
  confirmedRsvps: number;
  waitlistRsvps: number;
  pendingSafetyChecks: number;
  activeAlerts: number;
  sosCount: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  contact_number: string | null;
  is_admin: boolean;
  role: 'hiker' | 'organization' | 'admin' | null;
  organization_id: string | null;
  is_verified: boolean;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'away' | null;
  last_seen: string | null;
  created_at: string;
}

export interface AdminEventRow {
  id: string;
  title: string;
  organization_id: string;
  organization_name: string | null;
  organization_verified: boolean | null;
  mountain_id: string;
  event_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  meeting_point: string;
  difficulty: string;
  capacity: number | null;
  is_public: boolean;
  allow_walkins: boolean;
  status: string;
  description: string | null;
  safety_notes: string | null;
  required_gear: string | null;
  created_by: string;
  created_at: string;
  rsvp_confirmed: number;
  rsvp_waitlist: number;
  rsvp_total: number;
}

export interface AdminOrgRow {
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
  member_count: number;
  event_count: number;
}

export interface AdminJournalRow {
  id: string;
  user_id: string;
  author_name: string | null;
  author_email: string | null;
  mountain_id: string | null;
  viewpoint_id: string | null;
  title: string;
  content: string;
  images: string[];
  rating: number | null;
  is_public: boolean;
  like_count: number;
  created_at: string;
}

export interface AdminSosRow {
  id: number | string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  timestamp: string;
  user_id?: string | null;
}

export interface AdminEmergencyContactRow {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  contacts: {
    id: string;
    name: string;
    relationship: string;
    phone: string;
  }[];
  updated_at: string;
}

export interface AdminDiscoveryRow {
  id: number;
  user_id: string;
  species_id: number;
  species_name: string | null;
  species_scientific: string | null;
  mountain_id: string;
  discovered_at: string;
}

/* ───────────────────────── helpers ───────────────────────── */

const countOf = (res: { count: number | null }) => res.count ?? 0;

async function safeCount(
  build: () => PromiseLike<{ count: number | null; error: any }>,
): Promise<number> {
  try {
    const res = await build();
    if (res.error) {
      console.warn('[AdminService] count error:', res.error.message);
      return 0;
    }
    return countOf(res);
  } catch (e: any) {
    console.warn('[AdminService] count exception:', e?.message);
    return 0;
  }
}

/* ───────────────────────── global stats ───────────────────────── */

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    totalHikes,
    totalUsers,
    totalOrgs,
    verifiedOrgs,
    pendingOrgs,
    totalEvents,
    publishedEvents,
    draftEvents,
    cancelledEvents,
    upcomingEvents,
    confirmedRsvps,
    waitlistRsvps,
    pendingHikeChecks,
    pendingEventChecks,
    sosRows,
  ] = await Promise.all([
    safeCount(() => supabase.from('hikes').select('*', { count: 'exact', head: true })),
    safeCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true })),
    safeCount(() => supabase.from('organizations').select('*', { count: 'exact', head: true })),
    safeCount(() =>
      supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    ),
    safeCount(() =>
      supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_verified', false),
    ),
    safeCount(() => supabase.from('hiking_events').select('*', { count: 'exact', head: true })),
    safeCount(() =>
      supabase.from('hiking_events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ),
    safeCount(() =>
      supabase.from('hiking_events').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    ),
    safeCount(() =>
      supabase.from('hiking_events').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    ),
    safeCount(() =>
      supabase
        .from('hiking_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('event_date', today),
    ),
    safeCount(() =>
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ),
    safeCount(() =>
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('status', 'waitlist'),
    ),
    safeCount(() =>
      supabase
        .from('hike_safety_checks')
        .select('*', { count: 'exact', head: true })
        .eq('response_status', 'pending'),
    ),
    safeCount(() =>
      supabase
        .from('event_safety_checks')
        .select('*', { count: 'exact', head: true })
        .eq('response_status', 'pending'),
    ),
    getSOSAlerts().catch(() => []),
  ]);

  // Active alerts = checks that have an active_alert_id and are not yet seen by this admin.
  const activeAlerts = await (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const [{ data: hikeAlerts }, { data: eventAlerts }, { data: seen }] = await Promise.all([
        supabase.from('hike_safety_checks').select('id').not('active_alert_id', 'is', null),
        supabase.from('event_safety_checks').select('id').not('active_alert_id', 'is', null),
        supabase.from('admin_alert_seen').select('alert_id').eq('admin_user_id', user.id),
      ]);
      const seenSet = new Set((seen ?? []).map((r: any) => r.alert_id));
      const total = (hikeAlerts?.length ?? 0) + (eventAlerts?.length ?? 0);
      const unseen = [...(hikeAlerts ?? []), ...(eventAlerts ?? [])].filter(
        (r: any) => r.id && !seenSet.has(r.id),
      ).length;
      return unseen || total; // prefer unseen; fall back to total
    } catch {
      return 0;
    }
  })();

  return {
    totalHikes,
    totalUsers,
    totalOrgs,
    verifiedOrgs,
    pendingOrgs,
    totalEvents,
    publishedEvents,
    draftEvents,
    cancelledEvents,
    upcomingEvents,
    totalRsvps: confirmedRsvps + waitlistRsvps,
    confirmedRsvps,
    waitlistRsvps,
    pendingSafetyChecks: pendingHikeChecks + pendingEventChecks,
    activeAlerts,
    sosCount: sosRows.length,
  };
}

/* ───────────────────────── users ───────────────────────── */

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, username, contact_number, is_admin, role, organization_id, is_verified, avatar_url, status, last_seen, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[AdminService] fetchAdminUsers error:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    email: row.email ?? '',
    name: row.full_name,
    username: row.username ?? null,
    contact_number: row.contact_number,
    is_admin: !!row.is_admin,
    role: row.role ?? (row.is_admin ? 'admin' : 'hiker'),
    organization_id: row.organization_id ?? null,
    is_verified: !!row.is_verified,
    avatar_url: row.avatar_url ?? null,
    status: row.status ?? null,
    last_seen: row.last_seen ?? null,
    created_at: row.created_at,
  }));
}

/* ───────────────────────── orgs ───────────────────────── */

export async function fetchAdminOrgs(): Promise<AdminOrgRow[]> {
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[AdminService] fetchAdminOrgs error:', error.message);
    return [];
  }

  const orgIds = (orgs ?? []).map((o: any) => o.id);
  const [memberCounts, eventCounts] = await Promise.all([
    orgIds.length
      ? supabase.from('organization_members').select('organization_id').in('organization_id', orgIds)
      : Promise.resolve({ data: [], error: null } as any),
    orgIds.length
      ? supabase.from('hiking_events').select('organization_id').in('organization_id', orgIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const memberMap = new Map<string, number>();
  for (const m of memberCounts.data ?? []) {
    const id = (m as any).organization_id;
    memberMap.set(id, (memberMap.get(id) ?? 0) + 1);
  }
  const eventMap = new Map<string, number>();
  for (const e of eventCounts.data ?? []) {
    const id = (e as any).organization_id;
    eventMap.set(id, (eventMap.get(id) ?? 0) + 1);
  }

  return (orgs ?? []).map((o: any) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    description: o.description,
    logo_url: o.logo_url,
    website: o.website,
    contact_email: o.contact_email,
    contact_phone: o.contact_phone,
    is_verified: !!o.is_verified,
    created_at: o.created_at,
    updated_at: o.updated_at,
    member_count: memberMap.get(o.id) ?? 0,
    event_count: eventMap.get(o.id) ?? 0,
  }));
}

/* ───────────────────────── events ───────────────────────── */

export async function fetchAdminEvents(): Promise<AdminEventRow[]> {
  const { data, error } = await supabase
    .from('hiking_events')
    .select('*, organizations(id, name, is_verified)')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[AdminService] fetchAdminEvents error:', error.message);
    return [];
  }

  const rows = (data ?? []) as any[];
  const eventIds = rows.map((r) => r.id);

  let rsvps: any[] = [];
  if (eventIds.length > 0) {
    const { data: rsvpRows } = await supabase
      .from('event_rsvps')
      .select('event_id, status, guest_count')
      .in('event_id', eventIds);
    rsvps = rsvpRows ?? [];
  }

  const countMap = new Map<string, { confirmed: number; waitlist: number; total: number }>();
  for (const r of rsvps) {
    const bucket = countMap.get(r.event_id) ?? { confirmed: 0, waitlist: 0, total: 0 };
    const guests = r.guest_count ?? 1;
    if (r.status === 'confirmed' || r.status === 'pending') bucket.confirmed += guests;
    else if (r.status === 'waitlist') bucket.waitlist += guests;
    bucket.total += guests;
    countMap.set(r.event_id, bucket);
  }

  return rows.map((r) => {
    const c = countMap.get(r.id) ?? { confirmed: 0, waitlist: 0, total: 0 };
    const org = r.organizations ?? null;
    return {
      id: r.id,
      title: r.title,
      organization_id: r.organization_id,
      organization_name: org?.name ?? null,
      organization_verified: org?.is_verified ?? null,
      mountain_id: r.mountain_id,
      event_date: r.event_date,
      end_date: r.end_date ?? null,
      start_time: r.start_time,
      end_time: r.end_time ?? null,
      duration_hours: r.duration_hours ?? null,
      meeting_point: r.meeting_point,
      difficulty: r.difficulty,
      capacity: r.capacity,
      is_public: !!r.is_public,
      allow_walkins: !!r.allow_walkins,
      status: r.status,
      description: r.description,
      safety_notes: r.safety_notes,
      required_gear: r.required_gear,
      created_by: r.created_by,
      created_at: r.created_at,
      rsvp_confirmed: c.confirmed,
      rsvp_waitlist: c.waitlist,
      rsvp_total: c.total,
    };
  });
}

/* ───────────────────────── journal ───────────────────────── */

export async function fetchAdminJournal(publicOnly = false): Promise<AdminJournalRow[]> {
  let query = supabase
    .from('hiking_journals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (publicOnly) query = query.eq('is_public', true);

  const { data, error } = await query;
  if (error) {
    console.warn('[AdminService] fetchAdminJournal error:', error.message);
    return [];
  }

  const rows = (data ?? []) as any[];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const entryIds = rows.map((r) => r.id);

  const [profilesRes, likesRes] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null } as any),
    entryIds.length
      ? supabase.from('journal_entry_likes').select('journal_entry_id').in('journal_entry_id', entryIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const profileMap = new Map<string, any>(
    (profilesRes.data ?? []).map((p: any) => [p.id, p]),
  );
  const likeMap = new Map<string, number>();
  for (const l of likesRes.data ?? []) {
    const id = (l as any).journal_entry_id;
    likeMap.set(id, (likeMap.get(id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const p = profileMap.get(r.user_id);
    return {
      id: r.id,
      user_id: r.user_id,
      author_name: p?.full_name ?? null,
      author_email: p?.email ?? null,
      mountain_id: r.mountain_id ?? null,
      viewpoint_id: r.viewpoint_id ?? null,
      title: r.title ?? '',
      content: r.content ?? '',
      images: Array.isArray(r.images) ? r.images : [],
      rating: r.rating ?? null,
      is_public: !!r.is_public,
      like_count: likeMap.get(r.id) ?? 0,
      created_at: r.created_at,
    };
  });
}

export async function deleteAdminJournal(id: string): Promise<{ error: string | null }> {
  // Best effort: remove any storage objects under this entry, then the row.
  try {
    const { data: row } = await supabase
      .from('hiking_journals')
      .select('images')
      .eq('id', id)
      .maybeSingle();
    const images: string[] = Array.isArray(row?.images) ? row!.images : [];
    const paths = images
      .map((url) => {
        const marker = '/storage/v1/object/public/journal-images/';
        const idx = url.indexOf(marker);
        return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
      })
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from('journal-images').remove(paths);
    }
    const { error } = await supabase.from('hiking_journals').delete().eq('id', id);
    return { error: error?.message ?? null };
  } catch (e: any) {
    return { error: e?.message ?? 'Delete failed' };
  }
}

/* ───────────────────────── SOS ───────────────────────── */

export async function fetchAdminSos(): Promise<AdminSosRow[]> {
  try {
    const rows = await getSOSAlerts();
    return rows.map((r: any, i: number) => ({
      id: r.id ?? `sos-${i}`,
      latitude: r.latitude,
      longitude: r.longitude,
      accuracy: r.accuracy,
      altitude: r.altitude ?? null,
      timestamp: r.timestamp,
      user_id: r.user_id ?? null,
    }));
  } catch (e: any) {
    console.warn('[AdminService] fetchAdminSos error:', e?.message);
    return [];
  }
}

export async function fetchAdminEmergencyContacts(): Promise<AdminEmergencyContactRow[]> {
  const { data, error } = await supabase
    .from('emergency_contact_lists')
    .select('user_id, contacts, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Unable to load emergency contacts: ${error.message}`);
  }

  const rows = data ?? [];
  const userIds = rows.map((row) => row.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [], error: null };

  if (profilesError) {
    throw new Error(`Unable to load contact owners: ${profilesError.message}`);
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const owner = profilesById.get(row.user_id);
    return {
      user_id: row.user_id,
      user_name: owner?.full_name ?? null,
      user_email: owner?.email ?? null,
      contacts: row.contacts ?? [],
      updated_at: row.updated_at,
    };
  });
}

/* ───────────────────────── discoveries (view-only) ───────────────────────── */

export async function fetchAdminDiscoveries(): Promise<AdminDiscoveryRow[]> {
  const { data, error } = await supabase
    .from('wildtrack_discoveries')
    .select('id, user_id, species_id, mountain_id, discovered_at, wildtrack_species(common_name, scientific_name)')
    .order('discovered_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[AdminService] fetchAdminDiscoveries error:', error.message);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: Number(r.id),
    user_id: r.user_id,
    species_id: Number(r.species_id),
    species_name: r.wildtrack_species?.common_name ?? null,
    species_scientific: r.wildtrack_species?.scientific_name ?? null,
    mountain_id: r.mountain_id,
    discovered_at: r.discovered_at,
  }));
}

export const adminService = {
  fetchGlobalStats,
  fetchAdminUsers,
  fetchAdminOrgs,
  fetchAdminEvents,
  fetchAdminJournal,
  deleteAdminJournal,
  fetchAdminSos,
  fetchAdminEmergencyContacts,
  fetchAdminDiscoveries,
};

export default adminService;