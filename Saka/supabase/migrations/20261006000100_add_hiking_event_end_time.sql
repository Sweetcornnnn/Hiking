alter table public.hiking_events
  add column if not exists end_time time;

update public.hiking_events
set end_time = (
  (start_time + make_interval(hours => floor(duration_hours)::integer,
                              mins => round((duration_hours - floor(duration_hours)) * 60)::integer))::time
)
where end_time is null
  and duration_hours is not null
  and duration_hours > 0;