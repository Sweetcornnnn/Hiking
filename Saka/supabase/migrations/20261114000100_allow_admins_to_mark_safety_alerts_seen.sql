alter table public.admin_alert_seen enable row level security;

drop policy if exists "Admins read own seen safety alerts"
  on public.admin_alert_seen;
create policy "Admins read own seen safety alerts"
  on public.admin_alert_seen
  for select
  to authenticated
  using (admin_user_id = auth.uid() and public.is_saka_admin());

drop policy if exists "Admins mark own safety alerts seen"
  on public.admin_alert_seen;
create policy "Admins mark own safety alerts seen"
  on public.admin_alert_seen
  for insert
  to authenticated
  with check (admin_user_id = auth.uid() and public.is_saka_admin());

drop policy if exists "Admins update own seen safety alerts"
  on public.admin_alert_seen;
create policy "Admins update own seen safety alerts"
  on public.admin_alert_seen
  for update
  to authenticated
  using (admin_user_id = auth.uid() and public.is_saka_admin())
  with check (admin_user_id = auth.uid() and public.is_saka_admin());

grant select, insert, update on public.admin_alert_seen to authenticated;
