update public.mountain_manager_content
set tips_data = tips_data || jsonb_build_object(
  'transportation', jsonb_build_array(
    'Pick-up is available from your accommodation in Kalibo or Caticlan.',
    'N/A (Usually a direct tour transport).',
    'Drop-off back at your hotel in Kalibo or Caticlan.',
    'The most convenient option is a full-day tour (8-9 hours) which includes round-trip transportation, entrance fees, guide fees, and lunch. Exact public transport fares (bus/jeepney) are not listed. Tour package price is roughly ₱6,500+ PHP per person.'
  ),
  'transportGuide', jsonb_build_object(
    'startPoint', 'Pick-up is available from your accommodation in Kalibo or Caticlan.',
    'nextStop', 'N/A (Usually a direct tour transport).',
    'lastStop', 'Drop-off back at your hotel in Kalibo or Caticlan.',
    'faresNotes', 'The most convenient option is a full-day tour (8-9 hours) which includes round-trip transportation, entrance fees, guide fees, and lunch. Exact public transport fares (bus/jeepney) are not listed. Tour package price is roughly ₱6,500+ PHP per person.',
    'options', '[]'::jsonb
  ),
  'trailTips', jsonb_build_array(
    'The jump-off point is in Barangay Mambusao. Register at the Barangay Hall and arrange a local guide.',
    'The hike takes about 45 minutes to 1 hour. The trail is accessible and suitable for hikers of all ages.',
    'The tour typically includes visits to Katunggan It Ibajay (Mangrove Forest) and Nawidwid Falls (50 meters high).',
    'The exposed ridges are blanketed in tall grasses. Elevation is around 830–846 meters. Early morning or late afternoon provides ideal lighting.'
  ),
  'trailGuide', jsonb_build_object(
    'startPoint', 'The jump-off point is in Barangay Mambusao. Register at the Barangay Hall and arrange a local guide.',
    'summitTrail', 'The hike takes about 45 minutes to 1 hour. The trail is accessible and suitable for hikers of all ages.',
    'landmarks', jsonb_build_array(
      'Katunggan It Ibajay (Mangrove Forest)',
      'Nawidwid Falls (50 meters high)'
    ),
    'notes', 'The exposed ridges are blanketed in tall grasses. Elevation is around 830–846 meters. Early morning or late afternoon provides ideal lighting.'
  )
)
where mountain_id = '2cd5666c-1deb-4499-812e-eb95a992ef68'::uuid;

update public.mountain_manager_content
set tips_data = tips_data || jsonb_build_object(
  'transportation', jsonb_build_array(
    'From Kalibo town proper, ride a tricycle to the terminal of jeepneys bound for Altavas.',
    'Transfer to a jeepney going to Altavas and ask the driver to drop you off at the junction going to Barangay Bay-ang (travel time: approx. 1 hour).',
    'From the junction, charter a motorcycle to the jump-off point.',
    'Exact fares for the tricycle, jeepney, and motorcycle are not provided online. Note that if traveling alone, you will shoulder the entire cost of the motorcycle transfer. Confirm the charter rate with the driver before departing.'
  ),
  'transportGuide', jsonb_build_object(
    'startPoint', 'From Kalibo town proper, ride a tricycle to the terminal of jeepneys bound for Altavas.',
    'nextStop', 'Transfer to a jeepney going to Altavas and ask the driver to drop you off at the junction going to Barangay Bay-ang (travel time: approx. 1 hour).',
    'lastStop', 'From the junction, charter a motorcycle to the jump-off point.',
    'faresNotes', 'Exact fares for the tricycle, jeepney, and motorcycle are not provided online. Note that if traveling alone, you will shoulder the entire cost of the motorcycle transfer. Confirm the charter rate with the driver before departing.',
    'options', '[]'::jsonb
  ),
  'trailTips', jsonb_build_array(
    'From the jump-off, trek for about a few minutes to reach the hills.',
    'The trail is straightforward and there is no need for a guide.',
    'Expect panoramic views of the surrounding landscape.',
    'Fares and transport rates are variable. A local tricycle driver contact is provided (Kuya Rex: 09388216786) for Kalibo transfers.'
  ),
  'trailGuide', jsonb_build_object(
    'startPoint', 'From the jump-off, trek for about a few minutes to reach the hills.',
    'summitTrail', 'The trail is straightforward and there is no need for a guide.',
    'landmarks', jsonb_build_array('Panoramic views of the surrounding landscape.'),
    'notes', 'Fares and transport rates are variable. A local tricycle driver contact is provided (Kuya Rex: 09388216786) for Kalibo transfers.'
  )
)
where mountain_id = 'f2173971-80bf-40dd-96e9-c6b015be194b'::uuid;
