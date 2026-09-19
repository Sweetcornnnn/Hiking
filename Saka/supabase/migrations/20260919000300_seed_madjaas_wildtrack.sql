insert into public.wildtrack_species (
  id,
  scientific_name,
  common_name,
  category,
  conservation_status,
  gbif_id,
  inaturalist_id,
  description,
  habitat,
  fun_facts
) values
  (1, 'Rafflesia speciosa', 'Rafflesia', 'Plants', 'Endangered', 5361926, 120861,
   'A parasitic plant known for producing the largest individual flower on Earth. Found in the forests of Panay including Mt. Madjaas.',
   'Tropical rainforests', 'The flower emits a smell like rotting meat to attract flies for pollination.'),
  (2, 'Penelopides panini', 'Visayan Hornbill', 'Birds', 'Critically Endangered', 2495404, 5503,
   'A large hornbill species endemic to the Visayas islands. It plays a crucial role in seed dispersal in the forest ecosystem.',
   'Primary and secondary forests', 'Known locally as Talusi, it is one of the most endangered hornbill species.'),
  (3, 'Varanus mabitang', 'Panay Monitor Lizard', 'Reptiles', 'Endangered', 2447288, 39436,
   'A large arboreal monitor lizard endemic to Panay Island. One of the rarest monitor lizards in the world.',
   'Dipterocarp forests', 'It is a frugivorous lizard, primarily eating fruits unlike most monitor lizards.')
on conflict (id) do update set
  scientific_name = excluded.scientific_name,
  common_name = excluded.common_name,
  category = excluded.category,
  conservation_status = excluded.conservation_status,
  gbif_id = excluded.gbif_id,
  inaturalist_id = excluded.inaturalist_id,
  description = excluded.description,
  habitat = excluded.habitat,
  fun_facts = excluded.fun_facts;

insert into public.wildtrack_mountain_species (mountain_id, species_id, is_endemic)
values
  ('219d0ca0-dba5-41cd-b6cd-414c5d7e98e6', 1, true),
  ('219d0ca0-dba5-41cd-b6cd-414c5d7e98e6', 2, true),
  ('219d0ca0-dba5-41cd-b6cd-414c5d7e98e6', 3, true)
on conflict (mountain_id, species_id) do update set is_endemic = excluded.is_endemic;

insert into public.wildtrack_mountain_biodiversity (
  id,
  name,
  curated_species_count,
  description,
  endemic_species_count,
  key_species,
  ecosystem,
  conservation_status
)
values (
  '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6',
  'Mt. Madjaas',
  3,
  'Initial WildTrack curated species list for Mt. Madjaas. The checklist will expand after external biodiversity candidates are reviewed.',
  3,
  '["Rafflesia speciosa", "Penelopides panini", "Varanus mabitang"]'::jsonb,
  'Dipterocarp and mossy forests',
  'Protected landscape'
)
on conflict (id) do update set
  name = excluded.name,
  curated_species_count = excluded.curated_species_count,
  description = excluded.description,
  endemic_species_count = excluded.endemic_species_count,
  key_species = excluded.key_species,
  ecosystem = excluded.ecosystem,
  conservation_status = excluded.conservation_status;
