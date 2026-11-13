alter table public.event_safety_checks enable row level security;

grant select, insert, update, delete
  on public.event_safety_checks
  to authenticated;

drop policy if exists "Hikers manage safety checks for their own event RSVPs"
  on public.event_safety_checks;

create policy "Hikers manage safety checks for their own event RSVPs"
  on public.event_safety_checks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.event_rsvps as r
      where r.id = event_safety_checks.rsvp_id
        and r.event_id = event_safety_checks.event_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.event_rsvps as r
      where r.id = event_safety_checks.rsvp_id
        and r.event_id = event_safety_checks.event_id
        and r.user_id = auth.uid()
    )
  );
