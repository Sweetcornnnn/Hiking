create extension if not exists pgcrypto;

create table if not exists public.hiking_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mountain_id uuid references public.mountains(id) on delete set null,
  hike_id uuid,
  title text not null,
  content text not null default '',
  images text[] not null default '{}',
  rating integer check (rating between 1 and 5),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hiking_journals_user_id_idx on public.hiking_journals (user_id);
create index if not exists hiking_journals_public_idx on public.hiking_journals (is_public, created_at desc);
create index if not exists hiking_journals_mountain_id_idx on public.hiking_journals (mountain_id);

alter table public.hiking_journals enable row level security;

create policy "Users can view their own journal entries"
  on public.hiking_journals
  for select to authenticated
  using (user_id = auth.uid());

create policy "Public can view published journal entries"
  on public.hiking_journals
  for select to anon, authenticated
  using (is_public = true);

create policy "Users can insert their own journal entries"
  on public.hiking_journals
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own journal entries"
  on public.hiking_journals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own journal entries"
  on public.hiking_journals
  for delete to authenticated
  using (user_id = auth.uid());

grant select on public.hiking_journals to anon;
grant select, insert, update, delete on public.hiking_journals to authenticated;
