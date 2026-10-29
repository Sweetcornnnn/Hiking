create table if not exists public.hiker_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  altitude double precision,
  heading double precision,
  speed double precision,
  timestamp timestamptz not null,
  is_sos boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hiker_locations_user_timestamp_idx
  on public.hiker_locations (user_id, timestamp desc);

create index if not exists hiker_locations_sos_timestamp_idx
  on public.hiker_locations (timestamp desc)
  where is_sos = true;

alter table public.hiker_locations enable row level security;

drop policy if exists "Users can view their own locations"
  on public.hiker_locations;
create policy "Users can view their own locations"
  on public.hiker_locations
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own locations"
  on public.hiker_locations;
create policy "Users can insert their own locations"
  on public.hiker_locations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can view SOS locations"
  on public.hiker_locations;
create policy "Admins can view SOS locations"
  on public.hiker_locations
  for select
  to authenticated
  using (is_sos = true and public.is_admin());

grant select, insert on public.hiker_locations to authenticated;
