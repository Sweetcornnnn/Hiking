grant select on public.wildtrack_species to authenticated;
grant select on public.wildtrack_mountain_species to authenticated;
grant select on public.wildtrack_mountain_biodiversity to authenticated;
grant select, insert, delete on public.wildtrack_discoveries to authenticated;

grant usage, select on all sequences in schema public to authenticated;
