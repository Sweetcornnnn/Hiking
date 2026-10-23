drop policy if exists "Admins can view emergency contacts"
  on public.emergency_contact_lists;

create policy "Admins can view emergency contacts"
  on public.emergency_contact_lists
  for select
  to authenticated
  using (public.is_admin());
