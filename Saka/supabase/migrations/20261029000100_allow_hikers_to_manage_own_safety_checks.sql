alter table public.hike_safety_checks enable row level security;

grant select, insert, update, delete
  on public.hike_safety_checks
  to authenticated;

drop policy if exists "Hikers manage safety checks for their own hikes"
  on public.hike_safety_checks;

create policy "Hikers manage safety checks for their own hikes"
  on public.hike_safety_checks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.hikes as h
      where h.id = hike_id
        and h.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.hikes as h
      where h.id = hike_id
        and h.user_id = auth.uid()
    )
  );
