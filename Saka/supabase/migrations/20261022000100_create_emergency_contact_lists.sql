create table if not exists public.emergency_contact_lists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  contacts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(contacts) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.emergency_contact_lists enable row level security;

grant select, insert, update, delete
  on public.emergency_contact_lists
  to authenticated;

drop policy if exists "Users manage their own emergency contacts"
  on public.emergency_contact_lists;

create policy "Users manage their own emergency contacts"
  on public.emergency_contact_lists
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
