create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  logo_url text,
  website text,
  contact_email text,
  contact_phone text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.hiking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mountain_id uuid not null references public.mountains(id) on delete restrict,
  title text not null,
  description text,
  event_date date not null,
  start_time time not null,
  meeting_point text not null,
  difficulty text not null default 'Moderate',
  duration_hours numeric,
  capacity integer,
  is_public boolean not null default true,
  allow_walkins boolean not null default false,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.hiking_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  guest_count integer not null default 1,
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists organizations_slug_idx on public.organizations (slug);
create index if not exists organization_members_user_id_idx on public.organization_members (user_id);
create index if not exists hiking_events_mountain_id_idx on public.hiking_events (mountain_id);
create index if not exists hiking_events_org_idx on public.hiking_events (organization_id, event_date);
create index if not exists event_rsvps_event_id_idx on public.event_rsvps (event_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.hiking_events enable row level security;
alter table public.event_rsvps enable row level security;

-- Public read access for organizations and public events
create policy "Public can read organizations" on public.organizations
  for select to anon, authenticated using (true);

create policy "Public can read published hiking events" on public.hiking_events
  for select to anon, authenticated using (is_public = true);

-- Members can manage their own organization records
create policy "Organization members can update their organization" on public.organizations
  for update to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = public.organizations.id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Organization members can create events for their organization" on public.hiking_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = public.hiking_events.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Organization members can update their organization events" on public.hiking_events
  for update to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = public.hiking_events.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Users can create rsvps for public or visible events" on public.event_rsvps
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their own rsvps" on public.event_rsvps
  for select to authenticated using (user_id = auth.uid());

create policy "Users can update their own rsvps" on public.event_rsvps
  for update to authenticated using (user_id = auth.uid());

-- Grants
grant select on public.organizations to anon;
grant select on public.organizations to authenticated;
grant insert, update on public.organizations to authenticated;

grant select on public.hiking_events to anon;
grant select on public.hiking_events to authenticated;
grant insert, update on public.hiking_events to authenticated;

grant select, insert, update on public.event_rsvps to authenticated;

grant select, insert, update on public.organization_members to authenticated;
