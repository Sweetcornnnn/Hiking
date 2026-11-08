-- Managers are scoped to explicitly assigned mountains. No assignment means no edit access.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('hiker', 'organization', 'admin', 'manager'));

create or replace function public.is_saka_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin is true or p.role = 'admin')
  );
$$;

create table if not exists public.mountain_manager_assignments (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  mountain_id uuid not null references public.mountains(id) on delete cascade,
  assigned_by uuid not null default auth.uid() references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (manager_id, mountain_id)
);

alter table public.mountain_manager_assignments enable row level security;
drop policy if exists "Admins manage mountain assignments" on public.mountain_manager_assignments;
create policy "Admins manage mountain assignments"
  on public.mountain_manager_assignments for all to authenticated
  using (public.is_saka_admin())
  with check (public.is_saka_admin());
drop policy if exists "Managers view own mountain assignments" on public.mountain_manager_assignments;
create policy "Managers view own mountain assignments"
  on public.mountain_manager_assignments for select to authenticated
  using (manager_id = auth.uid());
grant select, insert, update, delete on public.mountain_manager_assignments to authenticated;

create or replace function public.manages_mountain(p_mountain_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.mountain_manager_assignments a
    where a.manager_id = auth.uid()
      and a.mountain_id = p_mountain_id
  );
$$;

create or replace function public.manages_mountain(p_mountain_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.mountain_manager_assignments a
    where a.manager_id = auth.uid()
      and a.mountain_id::text = p_mountain_id
  );
$$;

create table if not exists public.mountain_manager_content (
  mountain_id uuid primary key references public.mountains(id) on delete cascade,
  transport_info text not null default '',
  permit_info text not null default '',
  operating_hours text not null default '',
  preparation_info text[] not null default '{}',
  safety_info text[] not null default '{}',
  trail_tips text[] not null default '{}',
  etiquette_info text[] not null default '{}',
  announcements text[] not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.mountain_manager_content
  add column if not exists preparation_info text[] not null default '{}',
  add column if not exists safety_info text[] not null default '{}',
  add column if not exists trail_tips text[] not null default '{}',
  add column if not exists etiquette_info text[] not null default '{}';
alter table public.mountain_manager_content enable row level security;
drop policy if exists "Anyone can read mountain manager content" on public.mountain_manager_content;
create policy "Anyone can read mountain manager content"
  on public.mountain_manager_content for select to anon, authenticated using (true);
drop policy if exists "Managers update assigned mountain content" on public.mountain_manager_content;
create policy "Managers update assigned mountain content"
  on public.mountain_manager_content for all to authenticated
  using (public.is_saka_admin() or public.manages_mountain(mountain_id))
  with check (public.is_saka_admin() or public.manages_mountain(mountain_id));
grant select on public.mountain_manager_content to anon;
grant select, insert, update, delete on public.mountain_manager_content to authenticated;

create or replace function public.touch_mountain_manager_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists mountain_manager_content_updated_at on public.mountain_manager_content;
create trigger mountain_manager_content_updated_at
  before insert or update on public.mountain_manager_content
  for each row execute function public.touch_mountain_manager_content();

alter table public.viewpoints enable row level security;
drop policy if exists "Viewpoint update candidates" on public.viewpoints;
create policy "Viewpoint update candidates"
  on public.viewpoints for update to authenticated
  using (true) with check (true);
drop policy if exists "Only admins and assigned managers update viewpoints" on public.viewpoints;
create policy "Only admins and assigned managers update viewpoints"
  on public.viewpoints as restrictive for update to authenticated
  using (
    public.is_saka_admin()
    or exists (
      select 1
      from public.mountain_manager_assignments a
      where a.manager_id = auth.uid()
        and a.mountain_id::text = viewpoints.mountain_id
    )
  )
  with check (
    public.is_saka_admin()
    or exists (
      select 1
      from public.mountain_manager_assignments a
      where a.manager_id = auth.uid()
        and a.mountain_id::text = viewpoints.mountain_id
    )
  );
revoke update on public.viewpoints from authenticated;
grant update (name, subtitle, description, elevation, distance_from_start, estimated_hike, best_time, difficulty, trail_status) on public.viewpoints to authenticated;

alter table public.mountains enable row level security;
grant select on public.mountains to anon, authenticated;
drop policy if exists "Anyone can read mountains" on public.mountains;
create policy "Anyone can read mountains"
  on public.mountains for select to anon, authenticated using (true);
drop policy if exists "Mountain update candidates" on public.mountains;
create policy "Mountain update candidates"
  on public.mountains for update to authenticated
  using (true) with check (true);
drop policy if exists "Only admins and assigned managers update mountains" on public.mountains;
create policy "Only admins and assigned managers update mountains"
  on public.mountains as restrictive for update to authenticated
  using (public.is_saka_admin() or public.manages_mountain(id))
  with check (public.is_saka_admin() or public.manages_mountain(id));
revoke update on public.mountains from authenticated;
grant update (name, location, description, difficulty, elevation) on public.mountains to authenticated;

create table if not exists public.manager_change_notifications (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references public.profiles(id) on delete set null,
  mountain_id uuid references public.mountains(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.manager_change_notifications enable row level security;
drop policy if exists "Admins read manager change notifications" on public.manager_change_notifications;
create policy "Admins read manager change notifications"
  on public.manager_change_notifications for select to authenticated
  using (public.is_saka_admin());
drop policy if exists "Managers create assigned mountain notifications" on public.manager_change_notifications;
create policy "Managers create assigned mountain notifications"
  on public.manager_change_notifications for insert to authenticated
  with check (
    manager_id = auth.uid()
    and (mountain_id is null or public.manages_mountain(mountain_id))
  );
drop policy if exists "Admins mark manager changes read" on public.manager_change_notifications;
create policy "Admins mark manager changes read"
  on public.manager_change_notifications for update to authenticated
  using (public.is_saka_admin())
  with check (public.is_saka_admin());
grant select, insert, update on public.manager_change_notifications to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'manager_change_notifications'
  ) then
    alter publication supabase_realtime add table public.manager_change_notifications;
  end if;
end;
$$;

create or replace function public.notify_manager_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_mountain_id uuid;
  v_entity_id text;
  v_action text;
begin
  if tg_table_name = 'mountains' then
    v_mountain_id := coalesce(new.id, old.id);
    v_entity_id := v_mountain_id::text;
  elsif tg_table_name = 'viewpoints' then
    if coalesce(new.mountain_id, old.mountain_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_mountain_id := coalesce(new.mountain_id, old.mountain_id)::uuid;
    end if;
    v_entity_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'mountain_manager_content' then
    v_mountain_id := coalesce(new.mountain_id, old.mountain_id);
    v_entity_id := v_mountain_id::text;
  elsif tg_table_name = 'hiking_journals' then
    v_mountain_id := coalesce(new.mountain_id, old.mountain_id);
    v_entity_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'chat_messages' then
    v_mountain_id := coalesce(new.mountain_id, old.mountain_id);
    v_entity_id := coalesce(new.id, old.id)::text;
  end if;

  if not public.is_saka_admin()
     and auth.uid() is not null
     and v_mountain_id is not null
     and public.manages_mountain(v_mountain_id) then
    v_action := case when tg_op = 'DELETE' then 'delete' when tg_op = 'INSERT' then 'create' else 'update' end;
    insert into public.manager_change_notifications (manager_id, mountain_id, action, entity, entity_id, summary)
    values (
      auth.uid(),
      v_mountain_id,
      v_action,
      tg_table_name,
      v_entity_id,
      format('Manager %s %s (%s)', v_action, tg_table_name, v_entity_id)
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists manager_notify_mountains on public.mountains;
create trigger manager_notify_mountains after update on public.mountains
  for each row execute function public.notify_manager_change();
drop trigger if exists manager_notify_viewpoints on public.viewpoints;
create trigger manager_notify_viewpoints after update on public.viewpoints
  for each row execute function public.notify_manager_change();
drop trigger if exists manager_notify_content on public.mountain_manager_content;
create trigger manager_notify_content after insert or update on public.mountain_manager_content
  for each row execute function public.notify_manager_change();

alter table public.hiking_journals enable row level security;
drop policy if exists "Journal update candidates" on public.hiking_journals;
create policy "Journal update candidates"
  on public.hiking_journals for update to authenticated
  using (true) with check (true);
drop policy if exists "Journal owner/admin update restriction" on public.hiking_journals;
create policy "Journal owner/admin update restriction"
  on public.hiking_journals as restrictive for update to authenticated
  using (user_id = auth.uid() or public.is_saka_admin())
  with check (user_id = auth.uid() or public.is_saka_admin());
drop policy if exists "Journal delete candidates" on public.hiking_journals;
create policy "Journal delete candidates"
  on public.hiking_journals for delete to authenticated
  using (true);
drop policy if exists "Only owners admins or assigned managers delete Sakagram posts" on public.hiking_journals;
create policy "Only owners admins or assigned managers delete Sakagram posts"
  on public.hiking_journals as restrictive for delete to authenticated
  using (
    user_id = auth.uid()
    or
    public.is_saka_admin()
    or (mountain_id is not null and public.manages_mountain(mountain_id))
  );
grant delete on public.hiking_journals to authenticated;

alter table public.chat_messages
  add column if not exists mountain_id uuid references public.mountains(id) on delete cascade;
alter table public.chat_messages enable row level security;
drop policy if exists "Chat message delete candidates" on public.chat_messages;
create policy "Chat message delete candidates"
  on public.chat_messages for delete to authenticated using (true);
drop policy if exists "Only admins or assigned managers remove mountain chat messages" on public.chat_messages;
create policy "Only admins or assigned managers remove mountain chat messages"
  on public.chat_messages as restrictive for delete to authenticated
  using (
    public.is_saka_admin()
    or (mountain_id is not null and public.manages_mountain(mountain_id))
  );
grant delete on public.chat_messages to authenticated;

drop trigger if exists manager_notify_journals on public.hiking_journals;
create trigger manager_notify_journals after update or delete on public.hiking_journals
  for each row execute function public.notify_manager_change();
drop trigger if exists manager_notify_chat on public.chat_messages;
create trigger manager_notify_chat after delete on public.chat_messages
  for each row execute function public.notify_manager_change();

create or replace function public.guard_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is not null and not public.is_saka_admin() then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.role := 'hiker';
    elsif new.role is distinct from old.role or new.is_admin is distinct from old.is_admin then
      raise exception 'Only administrators can change account roles';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_role_changes on public.profiles;
create trigger profiles_guard_role_changes
  before insert or update of role, is_admin on public.profiles
  for each row execute function public.guard_profile_role_changes();

create or replace function public.set_mountain_manager(
  p_manager_id uuid,
  p_mountain_ids uuid[],
  p_make_manager boolean
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_org_id uuid;
begin
  if not public.is_saka_admin() then
    raise exception 'Only administrators can assign mountain managers';
  end if;

  select organization_id into v_org_id
  from public.profiles
  where id = p_manager_id and is_admin is not true;
  if not found then
    raise exception 'The selected account does not exist or is an administrator';
  end if;

  update public.profiles
  set role = case
        when p_make_manager then 'manager'
        when v_org_id is not null then 'organization'
        else 'hiker'
      end,
      is_admin = false,
      updated_at = now()
  where id = p_manager_id;

  delete from public.mountain_manager_assignments
  where manager_id = p_manager_id;

  if p_make_manager and coalesce(cardinality(p_mountain_ids), 0) > 0 then
    insert into public.mountain_manager_assignments (manager_id, mountain_id, assigned_by)
    select p_manager_id, requested.mountain_id, auth.uid()
    from unnest(p_mountain_ids) as requested(mountain_id)
    on conflict (manager_id, mountain_id) do nothing;
  end if;
end;
$$;
grant execute on function public.set_mountain_manager(uuid, uuid[], boolean) to authenticated;
