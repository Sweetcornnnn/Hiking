grant select on public.mountains to authenticated;
grant select on public.mountains to service_role;

grant select on public.wildtrack_species to service_role;
grant select on public.wildtrack_mountain_species to service_role;
grant select on public.wildtrack_mountain_biodiversity to service_role;
grant select, insert, delete on public.wildtrack_discoveries to service_role;
