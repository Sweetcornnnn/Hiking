insert into public.wildtrack_species (
  id, scientific_name, common_name, category, inaturalist_id, image_url
) values
  (16, 'Saxicola caprata', 'Pied Bushchat', 'Birds', 12910, 'https://inaturalist-open-data.s3.amazonaws.com/photos/14006651/medium.jpg'),
  (17, 'Lonchura atricapilla', 'Chestnut Munia', 'Birds', 72989, 'https://inaturalist-open-data.s3.amazonaws.com/photos/313615542/medium.jpg'),
  (18, 'Cerbera manghas', 'Grey Milkwood', 'Plants', 336787, 'https://inaturalist-open-data.s3.amazonaws.com/photos/27970569/medium.jpeg'),
  (19, 'Hemidactylus platyurus', 'Flat-tailed House Gecko', 'Reptiles', 33376, 'https://inaturalist-open-data.s3.amazonaws.com/photos/66693665/medium.jpg'),
  (20, 'Cinnyris jugularis', 'Garden Sunbird', 'Birds', 145194, 'https://inaturalist-open-data.s3.amazonaws.com/photos/597836560/medium.jpg'),
  (21, 'Draco spilopterus', 'Philippine Flying Dragon', 'Reptiles', 99566, 'https://static.inaturalist.org/photos/9572386/medium.jpg'),
  (22, 'Merops philippinus', 'Blue-tailed Bee-eater', 'Birds', 2212, 'https://inaturalist-open-data.s3.amazonaws.com/photos/41165864/medium.jpg'),
  (23, 'Pycnonotus goiavier', 'Yellow-vented Bulbul', 'Birds', 14623, 'https://inaturalist-open-data.s3.amazonaws.com/photos/191239279/medium.jpg'),
  (24, 'Lanius cristatus', 'Brown Shrike', 'Birds', 12021, 'https://inaturalist-open-data.s3.amazonaws.com/photos/472286950/medium.jpg'),
  (25, 'Dicaeum haematostictum', 'Black-belted Flowerpecker', 'Birds', 72807, 'https://inaturalist-open-data.s3.amazonaws.com/photos/252099854/medium.jpeg'),
  (26, 'Gerygone sulphurea', 'Golden-bellied Gerygone', 'Birds', 13495, 'https://static.inaturalist.org/photos/64829261/medium.jpg'),
  (27, 'Chalcites minutillus', 'Little Bronze Cuckoo', 'Birds', 369157, 'https://inaturalist-open-data.s3.amazonaws.com/photos/52387789/medium.jpeg'),
  (28, 'Spilornis holospilus', 'Philippine Serpent-Eagle', 'Birds', 5160, 'https://inaturalist-open-data.s3.amazonaws.com/photos/398392204/medium.jpeg'),
  (29, 'Sarcops calvus', 'Coleto', 'Birds', 15002, 'https://inaturalist-open-data.s3.amazonaws.com/photos/313613269/medium.jpg')
on conflict (id) do update set
  scientific_name = excluded.scientific_name,
  common_name = excluded.common_name,
  category = excluded.category,
  inaturalist_id = excluded.inaturalist_id,
  image_url = excluded.image_url;

insert into public.wildtrack_mountain_species (mountain_id, species_id, is_endemic)
values
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 16, false),
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 17, false),
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 18, false),
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 19, false),
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 20, false),
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 21, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 18, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 19, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 20, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 22, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 23, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 24, false),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 25, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 16, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 17, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 25, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 18, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 21, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 26, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 27, false),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 20, false),
  ('f2173971-80bf-40dd-96e9-c6b015be194b'::uuid, 25, false),
  ('f2173971-80bf-40dd-96e9-c6b015be194b'::uuid, 28, false),
  ('f2173971-80bf-40dd-96e9-c6b015be194b'::uuid, 29, false)
on conflict (mountain_id, species_id) do update set is_endemic = excluded.is_endemic;

insert into public.wildtrack_mountain_biodiversity (
  id, name, curated_species_count, description, endemic_species_count, key_species, ecosystem, conservation_status
) values
  ('2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid, 'Mt. Balinsayaw', 6, 'Initial WildTrack checklist based on nearby reviewed observations. Records are non-endemic candidates pending further field verification.', 0, '["Saxicola caprata", "Lonchura atricapilla", "Draco spilopterus"]'::jsonb, 'Grassland, forest edge, and karst habitat', 'Pending verification'),
  ('d39ff04a-069b-4d90-b448-f66e6ae05772'::uuid, 'Mt. M', 7, 'Initial WildTrack checklist based on nearby reviewed observations. Records are non-endemic candidates pending further field verification.', 0, '["Dicaeum haematostictum", "Merops philippinus", "Pycnonotus goiavier"]'::jsonb, 'Mixed forest edge and lowland habitat', 'Pending verification'),
  ('aeffeadd-0cb8-418f-b356-5c6dab35b219'::uuid, 'Mt. Nausang', 8, 'Initial WildTrack checklist based on nearby reviewed observations. Records are non-endemic candidates pending further field verification.', 0, '["Saxicola caprata", "Dicaeum haematostictum", "Draco spilopterus"]'::jsonb, 'Limestone, forest edge, and montane habitat', 'Pending verification'),
  ('f2173971-80bf-40dd-96e9-c6b015be194b'::uuid, 'Pandan Hills', 3, 'Initial WildTrack checklist based on nearby reviewed observations. Coastal and lowland-risk candidates were excluded.', 0, '["Dicaeum haematostictum", "Spilornis holospilus", "Sarcops calvus"]'::jsonb, 'Grassland, farmland edge, and low hills', 'Pending verification')
on conflict (id) do update set
  curated_species_count = excluded.curated_species_count,
  description = excluded.description,
  endemic_species_count = excluded.endemic_species_count,
  key_species = excluded.key_species,
  ecosystem = excluded.ecosystem,
  conservation_status = excluded.conservation_status;
