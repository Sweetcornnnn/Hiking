insert into public.wildtrack_species (
  id,
  scientific_name,
  common_name,
  category,
  inaturalist_id,
  image_url
) values
  (4, 'Calanthe triplicata', 'Christmas Orchid', 'Plants', 369261, 'https://inaturalist-open-data.s3.amazonaws.com/photos/47706560/medium.jpg'),
  (5, 'Begonia panayensis', 'Begonia panayensis', 'Plants', 1614919, 'https://inaturalist-open-data.s3.amazonaws.com/photos/473098081/medium.jpg'),
  (6, 'Astronia lagunensis', 'Astronia lagunensis', 'Plants', 1644125, 'https://inaturalist-open-data.s3.amazonaws.com/photos/662597851/medium.jpg'),
  (7, 'Nepenthes ventricosa', 'Nepenthes ventricosa', 'Plants', 415470, 'https://inaturalist-open-data.s3.amazonaws.com/photos/1285801/medium.jpg'),
  (8, 'Begonia merrilliana', 'Begonia merrilliana', 'Plants', 1399911, 'https://inaturalist-open-data.s3.amazonaws.com/photos/209134822/medium.jpg'),
  (9, 'Plocoglottis plicata', 'Plocoglottis plicata', 'Plants', 736677, 'https://inaturalist-open-data.s3.amazonaws.com/photos/145587815/medium.jpg'),
  (10, 'Begonia culasiensis', 'Begonia culasiensis', 'Plants', 1600887, 'https://inaturalist-open-data.s3.amazonaws.com/photos/316276743/medium.jpeg'),
  (11, 'Aethopyga magnifica', 'Magnificent Sunbird', 'Birds', 339878, 'https://inaturalist-open-data.s3.amazonaws.com/photos/30155797/medium.jpg'),
  (12, 'Chrysocolaptes xanthocephalus', 'Yellow-faced Flameback', 'Birds', 201084, 'https://inaturalist-open-data.s3.amazonaws.com/photos/236185978/medium.jpg'),
  (13, 'Zosterornis latistriatus', 'Panay Striped-Babbler', 'Birds', 144978, 'https://inaturalist-open-data.s3.amazonaws.com/photos/533261272/medium.jpg'),
  (14, 'Psammodynastes pulverulentus', 'Common Mock Viper', 'Reptiles', 28999, 'https://inaturalist-open-data.s3.amazonaws.com/photos/7478438/medium.jpg'),
  (15, 'Microporus xanthopus', 'Yellow-stemmed Micropore', 'Fungi', 370262, 'https://inaturalist-open-data.s3.amazonaws.com/photos/61144171/medium.jpeg')
on conflict (id) do update set
  scientific_name = excluded.scientific_name,
  common_name = excluded.common_name,
  category = excluded.category,
  inaturalist_id = excluded.inaturalist_id,
  image_url = excluded.image_url;

insert into public.wildtrack_mountain_species (mountain_id, species_id, is_endemic)
select '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6'::uuid, ids.id, false
from unnest(array[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::bigint[]) as ids(id)
on conflict (mountain_id, species_id) do update set is_endemic = excluded.is_endemic;

update public.wildtrack_mountain_biodiversity
set curated_species_count = 15,
    description = 'WildTrack curated species list for Mt. Madjaas, combining three initial endemic records with twelve additional GBIF/iNaturalist candidate records approved for review.',
    key_species = '["Rafflesia speciosa", "Penelopides panini", "Varanus mabitang", "Calanthe triplicata", "Begonia panayensis", "Astronia lagunensis", "Nepenthes ventricosa", "Begonia merrilliana", "Plocoglottis plicata", "Begonia culasiensis", "Aethopyga magnifica", "Chrysocolaptes xanthocephalus", "Zosterornis latistriatus", "Psammodynastes pulverulentus", "Microporus xanthopus"]'::jsonb
where id = '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6'::uuid;
