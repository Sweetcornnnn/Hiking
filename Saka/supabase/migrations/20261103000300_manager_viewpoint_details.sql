revoke update on public.viewpoints from authenticated;
grant update (
  name,
  subtitle,
  description,
  elevation,
  distance_from_start,
  estimated_hike,
  best_time,
  difficulty,
  trail_status,
  crowd_level,
  tags,
  features,
  trail_notes
) on public.viewpoints to authenticated;
