alter table public.wildtrack_mountain_species
  alter column mountain_id type uuid using mountain_id::uuid;

alter table public.wildtrack_mountain_biodiversity
  alter column id type uuid using id::uuid;

alter table public.wildtrack_discoveries
  alter column mountain_id type uuid using mountain_id::uuid;

alter table public.wildtrack_mountain_species
  add constraint wildtrack_mountain_species_mountain_fk
  foreign key (mountain_id) references public.mountains(id) on delete cascade;

alter table public.wildtrack_mountain_biodiversity
  add constraint wildtrack_mountain_biodiversity_mountain_fk
  foreign key (id) references public.mountains(id) on delete cascade;

alter table public.wildtrack_discoveries
  add constraint wildtrack_discoveries_mountain_fk
  foreign key (mountain_id) references public.mountains(id) on delete cascade;
