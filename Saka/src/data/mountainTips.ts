export interface Alert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  date?: string;
}

// ─── Transportation Guide card ──────────────────────────────────────────────
export type TransportKind =
  | 'jeepney'
  | 'bus'
  | 'van'
  | 'car'
  | 'tricycle'
  | 'motorcycle'
  | 'boat'
  | 'walk';

export interface TransportOption {
  /** Shown as the row title, e.g. "Jeepney to Brgy. Poblacion". */
  vehicle: string;
  /** Picks the icon. Defaults to a car. */
  kind?: TransportKind;
  /**
   * A number is shown as pesos (₱150). Use a string for a range, e.g. "₱120–150".
   * Leave it out when the fare isn't known; the card then says "Confirm fare".
   */
  pricePerPerson?: number | string;
  /** One short line: schedule, travel time, capacity. */
  note?: string;
}

export interface TransportGuide {
  /** "Where to begin": the town, terminal or jump-off to head to first. */
  startPoint: string;
  whereToAvail?: string;
  nextStop?: string;
  lastStop?: string;
  faresNotes?: string;
  options: TransportOption[];
  /** Optional closing reminder, e.g. that prices change in peak season. */
  tip?: string;
}

// ─── Trail Tips & Navigation card ───────────────────────────────────────────
export interface TrailStop {
  /** Place name, e.g. "Bantang Camp 1". */
  label: string;
  /** Short extra, shown on the right: day, elevation, time. e.g. "Day 1 · 1,030 m". */
  detail?: string;
}

export interface TrailGuide {
  /** "Where to start": registration, jump-off or first point of the hike. */
  startPoint: string;
  summitTrail?: string;
  /** Where a vehicle might drop you off. */
  dropOff?: string;
  /** Ordered points on the trail. The first four are shown. */
  stops?: TrailStop[];
  /** Notable sights, in no particular order. */
  landmarks?: string[];
  /** Where to find water, and where not to count on it. */
  water?: string;
  notes?: string;
  /** A closing note, or a "data pending" message. */
  tip?: string;
}

// ─── Preparation & Requirements card ────────────────────────────────────────
export interface PreparationGuide {
  /** Quick facts, shown as label / value rows. e.g. { label: 'Difficulty', value: '8/9 · major climb' }. Four are shown. */
  facts?: { label: string; value: string }[];
  /** Costs. e.g. { label: 'Permit', amount: '₱150 / person / day' }. Three are shown. */
  fees?: { label: string; amount: string }[];
  /** Things to pack, shown as one line. */
  bring?: string[];
  /** A closing note, or a "data pending" message. */
  note?: string;
}

// ─── Safety Guidelines card ─────────────────────────────────────────────────
export interface SafetyGuide {
  /** What to watch for. Three are shown. `detail` is one or two short lines. */
  hazards?: { label: string; detail?: string }[];
  weather?: string;
  /** Registration, check-ins, who to contact, evacuation plan. */
  emergency?: string;
  /** A closing note, or a "not available" message. */
  note?: string;
}

// ─── Environmental Etiquette card ───────────────────────────────────────────
export interface EtiquetteGuide {
  /** What to do on the mountain. Three are shown. */
  rules?: { label: string; detail?: string }[];
  /** Respect for people, beliefs and sacred places. */
  local?: string;
  /** Anything good to know. */
  note?: string;
}

export interface MountainTips {
  id: string;
  mountainName: string;
  preparation: string[];
  /** Structured version of preparation. Optional: without it the plain list is shown. */
  preparationGuide?: PreparationGuide;
  safety: string[];
  /** Structured version of safety. Optional: without it the plain list is shown. */
  safetyGuide?: SafetyGuide;
  transportation: string[];
  /** Structured version of the transportation info. Optional: without it the plain list is shown. */
  transportGuide?: TransportGuide;
  trailTips: string[];
  /** Structured version of the trail tips. Optional: without it the plain list is shown. */
  trailGuide?: TrailGuide;
  etiquette: string[];
  /** Structured version of etiquette. Optional: without it the plain list is shown. */
  etiquetteGuide?: EtiquetteGuide;
  alerts: Alert[];
}

export const MOUNTAIN_TIPS_BY_ID: Record<string, MountainTips> = {
  '2cd5666c-1deb-4499-812e-eb95a992ef68': {
    id: '2cd5666c-1deb-4499-812e-eb95a992ef68',
    mountainName: 'Mt. Balinsasayaw',
    preparation: [],
    safety: [],
    transportation: [
      'Hotel pick-up in Kalibo or Caticlan.',
      'Usually direct tour transport; no next stop.',
      'Return drop-off at your Kalibo or Caticlan hotel.',
      'Full-day tour (8–9 hr): round-trip transport, entrance, guide, and lunch included. Public bus/jeepney fares unavailable. Tour: ~₱6,500+ per person.',
    ],
    transportGuide: {
      startPoint: 'Hotel pick-up in Kalibo or Caticlan.',
      whereToAvail: 'Book online: GetYourGuide, Pelago, Guide to the Philippines, Tripadvisor, or Lokalee. Operator: CTPH TOUR.',
      nextStop: 'N/A (Usually a direct tour transport).',
      lastStop: 'Return drop-off at your Kalibo or Caticlan hotel.',
      faresNotes: 'Full-day tour (8–9 hr) includes round-trip transport, entrance, guide, and lunch. Public bus/jeepney fares unavailable. Tour: ~₱6,500+ per person.',
      options: [],
    },
    trailTips: [
      'Jump off at Barangay Mambusao; register at the Barangay Hall and arrange a local guide.',
      'Accessible 45–60 minute hike, suitable for all ages.',
      'Nearby tour stops: Katunggan It Ibajay (Mangrove Forest) and 50-meter Nawidwid Falls.',
      'Tall grasses cover the exposed ridges. Elevation: ~830–846 m. Best light: early morning or late afternoon.',
    ],
    trailGuide: {
      startPoint: 'Jump off at Barangay Mambusao; register at the Barangay Hall and arrange a local guide.',
      summitTrail: 'Accessible 45–60 minute hike, suitable for all ages.',
      landmarks: [
        'Katunggan It Ibajay (Mangrove Forest)',
        'Nawidwid Falls (50 meters high)',
      ],
      notes: 'Tall grasses cover the exposed ridges. Elevation: ~830–846 m. Best light: early morning or late afternoon.',
    },
    etiquette: [],
    alerts: [],
  },
  'f2173971-80bf-40dd-96e9-c6b015be194b': {
    id: 'f2173971-80bf-40dd-96e9-c6b015be194b',
    mountainName: 'Pandan Hills',
    preparation: [],
    safety: [],
    transportation: [
      'From Kalibo town, take a tricycle to the Altavas jeepney terminal.',
      'Take an Altavas-bound jeepney; request drop-off at the Barangay Bay-ang junction (~1 hr).',
      'Charter a motorcycle from the junction to the jump-off.',
      'Fares unavailable online. Solo travelers pay the full motorcycle charter; confirm the rate before departure.',
    ],
    transportGuide: {
      startPoint: 'From Kalibo town, take a tricycle to the Altavas jeepney terminal.',
      whereToAvail: 'DIY route; no tour packages currently listed online.',
      nextStop: 'Take an Altavas-bound jeepney; request drop-off at the Barangay Bay-ang junction (~1 hr).',
      lastStop: 'Charter a motorcycle from the junction to the jump-off.',
      faresNotes: 'Fares unavailable online. Solo travelers pay the full motorcycle charter; confirm the rate before departure.',
      options: [],
    },
    trailTips: [
      'A short hike from the jump-off reaches the hills.',
      'Straightforward trail; no guide needed.',
      'Enjoy panoramic views of the surrounding landscape.',
      'Transport rates vary. Kalibo tricycle contact: Kuya Rex, 09388216786.',
    ],
    trailGuide: {
      startPoint: 'A short hike from the jump-off reaches the hills.',
      summitTrail: 'Straightforward trail; no guide needed.',
      landmarks: ['Panoramic views of the surrounding landscape.'],
      notes: 'Transport rates vary. Kalibo tricycle contact: Kuya Rex, 09388216786.',
    },
    etiquette: [],
    alerts: [],
  },
  'd39ff04a-069b-4d90-b448-f66e6ae05772': {
    id: 'd39ff04a-069b-4d90-b448-f66e6ae05772',
    mountainName: 'Mt. M',
    preparation: [
      'Bring 2–3 liters of water per person and trail food.',
      'Wear hiking shoes with good grip.',
      'Pack a first aid kit, raincoat, sun protection, and extra clothes.',
      'Strictly verify permits and fees with the Tangalan Municipal Tourism Office; no official public pricing is available yet.',
      'Elevation: Unverified. Nearby reference points: Barangay Pudiot is approximately 130.6 meters, while the nearby End Peak is roughly 188 meters.',
      'Type: Remote, undeveloped, and unverified hiking destination.',
      'Duration: Likely a day hike or short trek (exact duration unverified).',
      'Rules: Confirm guide, permits, and fees locally with the Tangalan Municipal Tourism Office.',
    ],
    preparationGuide: {
      facts: [
        {
          label: 'Elevation',
          value: 'Unverified. Nearby reference points: Barangay Pudiot is approximately 130.6 meters, while the nearby End Peak is roughly 188 meters.',
        },
        {
          label: 'Type',
          value: 'Remote, undeveloped, and unverified hiking destination.',
        },
        {
          label: 'Duration',
          value: 'Likely a day hike or short trek (exact duration unverified).',
        },
        {
          label: 'Rules',
          value: 'Confirm guide, permits, and fees locally with the Tangalan Municipal Tourism Office.',
        },
      ],
      note: 'Coordinate with the Tangalan Tourism Office, secure a local guide, and bring enough water and gear for an unverified trail.',
      fees: [
        {
          label: 'Permits and fees',
          amount: 'Strictly verify with the Tangalan Municipal Tourism Office. No official public pricing is available yet.',
        },
      ],
      bring: [
        'Trail water (2–3 liters per person)',
        'Trail food',
        'Hiking shoes with good grip',
        'First aid kit',
        'Raincoat',
        'Sun protection',
        'Extra clothes',
      ],
    },
    safety: [
      'Best during the dry season (December to May); start early to avoid midday heat.',
      'Watch for slippery trails, exposed roots, and insects, especially because the trail is not yet fully developed.',
      'Cellular signal is limited; it is highly recommended not to hike alone.',
    ],
    safetyGuide: {
      weather: 'December to May. Among these, February to April have the least rainfall, with April being the driest month (approximately 28-83 mm).\nStart hiking early in the morning to avoid midday heat.',
      emergency: 'Save the Tangalan MDRRMO hotline (036) 272-2032, hike in a group, and set a strict turn-around time since signal is limited.',
      hazards: [
        { label: 'Slippery trails', detail: 'Avoid trekking during heavy rains.' },
        { label: 'Exposed roots and insects', detail: 'The trail is not yet fully developed; watch your step.' },
        { label: 'Limited cellular signal', detail: 'It is highly recommended not to hike alone.' },
      ],
      note: 'Because the trail is not yet fully developed, watch your step. It is highly recommended not to hike alone.',
    },
    transportation: [
      'From Kalibo town, take a tricycle or short ride to the Kalibo Integrated Transport Terminal or Oyo Torong Terminal.',
      'Board a jeepney or Ceres bus bound for Tangalan or Ibajay. Travel from Kalibo to Tangalan takes approximately 30–45 minutes.',
      'Alight at the Tangalan Public Market or Municipal Hall. Register at the Tangalan Municipal Tourism Office to secure a local guide and confirm the exact jump-off point.',
      'From the town proper, charter a tricycle or habal-habal to Barangay Pudiot or the designated jump-off point.',
    ],
    transportGuide: {
      startPoint: 'From Kalibo town, take a tricycle or a short ride to the Kalibo Integrated Transport Terminal or the Oyo Torong Terminal.',
      whereToAvail: 'Tangalan Municipal Tourism Office or the Tangalan Municipal Hall. Hikers usually need to register here and secure a local guide. You may try contacting them at (036) 272-2032, though you should verify this number.',
      nextStop: 'Tangalan Poblacion or Tangalan Municipal Hall. Registration and briefings typically happen here before heading to the jump-off point.',
      lastStop: 'From the town proper, charter a tricycle or a habal-habal to the Barangay Pudiot area or the designated jump-off point. Confirm the exact location with the tourism office.',
      faresNotes: 'No verified public fares are available. Environmental and guide fees are likely but unconfirmed; bring cash just in case.',
      options: [
        {
          vehicle: 'Step 1: Kalibo town to terminal',
          kind: 'tricycle',
          note: 'From Kalibo town, take a tricycle or a short ride to the Kalibo Integrated Transport Terminal or the Oyo Torong Terminal.',
        },
        {
          vehicle: 'Step 2: Jeepney or Ceres bus to Tangalan or Ibajay',
          kind: 'bus',
          note: 'Travel from Kalibo to Tangalan takes approximately 30 to 45 minutes.',
        },
        {
          vehicle: 'Step 3: Register in Tangalan',
          kind: 'walk',
          note: 'Alight at the Tangalan Public Market or the Tangalan Municipal Hall. Register at the Tangalan Municipal Tourism Office to secure a local guide and confirm the exact jump-off point.',
        },
        {
          vehicle: 'Step 4: Town proper to jump-off point',
          kind: 'motorcycle',
          note: 'From the town proper, charter a tricycle or a habal-habal (motorcycle) to the Barangay Pudiot area or the designated jump-off point.',
        },
      ],
      tip: 'No verified jump-off, route, travel time, schedule, or fare is available for \'Mt. M.\' Confirm the destination and current transport with the Tangalan Municipal Tourism Office.',
    },
    trailTips: [
      'Register at the Tangalan Municipal Tourism Office and secure a local guide; confirm the exact jump-off point.',
      'The drop-off is typically Tangalan Poblacion or Tangalan Municipal Hall, where registration and briefings happen.',
      'No verified landmarks or established named stops are available; local viewpoints may be identified by your guide.',
      'Bring your own potable water (at least 2–3 liters per person); do not rely on finding water on the mountain.',
    ],
    trailGuide: {
      startPoint: 'Register at the Tangalan Municipal Tourism Office and secure a local guide; confirm the exact jump-off point before setting out.',
      dropOff: 'Tangalan Poblacion or Tangalan Municipal Hall.',
      landmarks: ['End Peak near Pudiot, with an elevation of approximately 188 meters.'],
      water: 'Bring your own water. Do not rely on finding potable water on the mountain; bring at least 2–3 liters per person.',
      notes: 'No verified landmarks or established named stops are available. Local viewpoints may be identified by your guide. The trail is not yet fully developed, so watch your step and do not hike alone.',
    },
    etiquette: ['Practice strict Leave No Trace by packing out all trash and respecting the pristine, undeveloped environment.'],
    etiquetteGuide: {
      note: 'Practice strict Leave No Trace by packing out all trash and respecting the pristine, undeveloped environment.',
    },
    alerts: [],
  },
  'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65': {
    id: 'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65',
    mountainName: 'Mt. Nangtud',
    preparation: [
      'Elevation: Approximately 2,074 meters above sea level (MASL).',
      'Location: Central Panay Mountain Range, boundary of Barbaza, Antique and Jamindan, Capiz.',
      'Ranking: Second-highest peak on Panay Island and third-highest in the Visayas.',
      'Difficulty: Major climb, Difficulty 8/9 – only for experienced hikers.',
      'Days required: 3–4 days (overnight camping on the mountain).',
      'Also known as: Part of the Panay Trilogy (with Mt. Madja-as and Mt. Baloy-daku).',
    ],
    preparationGuide: {
      facts: [
        { label: 'Elevation', value: 'Approximately 2,074 meters above sea level (MASL).' },
        { label: 'Location', value: 'Central Panay Mountain Range, boundary of Barbaza, Antique and Jamindan, Capiz.' },
        { label: 'Ranking', value: 'Second-highest peak on Panay Island and third-highest in the Visayas.' },
        { label: 'Difficulty', value: 'Major climb, Difficulty 8/9 – only for experienced hikers.' },
      ],
      note: 'Days required: 3–4 days (overnight camping on the mountain). Also known as: Part of the Panay Trilogy (with Mt. Madja-as and Mt. Baloy-daku).',
      fees: [
        { label: 'Climb permit', amount: '~₱1,500 per head' },
        { label: 'Guide fee', amount: '~₱850 per head' },
        { label: 'Porter fee', amount: '~₱750 per kilo, or depending on guide arrangement' },
      ],
      bring: [
        'Trail water (2–3 liters)',
        'Trail food',
        'Hiking shoes with good grip',
        'Sandals for river trekking',
        'Rain protection',
        'Extra clothes',
        'Headlamp',
        'First-aid kit',
        'Tent and sleeping bag for overnight camps',
      ],
    },
    safety: [
      'River crossings: strong currents and sudden water level rises.',
      'Knife-edge ridges: steep and dizzying, especially on exposed sections.',
      'Limatik (leeches): common in the mossy forest and around the Rancho campsite.',
      'Loose rocks and steep assault can be slippery and dangerous.',
      'Weather on the summit ridge can change rapidly.',
    ],
    safetyGuide: {
      weather: 'Best months to climb: February to May (dry season). Mt. Nangtud involves river trekking along the Dalanas River. During the rainy season, the river can become extremely dangerous with strong currents and sudden flash floods. Plan your climb during the dry season and always have a contingency plan.',
      emergency: 'Coordinate with Barbaza MDRRMO and local guides for evacuation protocols, and set a strict turn-around time since the trail has multiple river crossings and very limited signal.',
      hazards: [
        { label: 'River crossings', detail: 'Strong currents and sudden water level rises.' },
        { label: 'Knife-edge ridges; loose rocks and steep assault', detail: 'Exposed sections are steep and dizzying; loose terrain can be slippery and dangerous.' },
        { label: 'Limatik and changing weather', detail: 'Leeches are common in the mossy forest and around Rancho; summit ridge weather can change rapidly.' },
      ],
      note: 'This is a major 8/9 difficulty climb requiring a guide, proper gear for knife-edge ridges and leeches, and strict avoidance during heavy rain due to dangerous river currents.',
    },
    transportation: [
      'From Iloilo City or Kalibo, take a bus or van bound for Barbaza, Antique. Travel time is roughly 4 hours from Iloilo.',
      'Alight at the Barbaza Municipal Hall. Register at the police station and secure your climb permit at the tourism office.',
      'From the Barbaza town proper, charter a habal-habal (motorcycle) or tricycle to Barangay Lombuyan or the designated jump-off area. Some roads may be rough or damaged.',
      'Coordinate with your guide for the final transfer to the river trail. The trek usually starts with river crossings along the Dalanas River.',
    ],
    transportGuide: {
      startPoint: 'Barangay Lombuyan (also reported as Lomboyan/Lumbuyan), Barbaza. This is the primary jump-off point. Hikers must first register and secure permits at the Barbaza Municipal Hall or Tourism Office before proceeding to the trailhead. Roads going to Lombuyan may have damaged sections, so a habal-habal (motorcycle) or tricycle ride from the town proper is often required.',
      whereToAvail: 'Register at the Barbaza Municipal Hall or Tourism Office. Register at the police station and secure your climb permit at the Tourism Office.',
      nextStop: 'Barbaza Municipal Hall: register at the police station and secure your climb permit at the Tourism Office.',
      lastStop: 'Barangay Lombuyan or the designated jump-off area; coordinate with your guide for the final transfer to the river trail.',
      faresNotes: 'Climb permit: ~₱1,500 per head. Guide fee: ~₱850 per head. Porter fee: ~₱750 per kilo, or depending on guide arrangement. These prices are based on past climbs and are subject to change. Bring enough cash and verify the latest rates with the Barbaza Tourism Office.',
      options: [
        { vehicle: 'Step 1: Bus or van to Barbaza', kind: 'bus', note: 'From Iloilo City or Kalibo, take a bus or van bound for Barbaza, Antique. Travel time is roughly 4 hours from Iloilo.' },
        { vehicle: 'Step 2: Registration and climb permit', kind: 'walk', note: 'Alight at the Barbaza Municipal Hall. Register at the police station and secure your climb permit at the Tourism Office.' },
        { vehicle: 'Step 3: Barbaza town proper to Lombuyan', kind: 'motorcycle', note: 'Charter a habal-habal or tricycle to Barangay Lombuyan or the designated jump-off area. Some roads may be rough or damaged.' },
        { vehicle: 'Step 4: Final transfer to the Dalanas River trail', kind: 'walk', note: 'Coordinate with your guide. The trek usually starts with river crossings along the Dalanas River.' },
      ],
      tip: 'Mt. Nangtud is a major climb with river crossings and knife-edge ridges. Secure permits from the Barbaza Tourism Office in advance, arrange return transport, and confirm trail conditions with local guides. Do not attempt during heavy rain or typhoon season.',
    },
    trailTips: [
      'Barangay Lombuyan (also reported as Lomboyan/Lumbuyan), Barbaza, is the primary jump-off point.',
      'The trek starts at the Dalanas River; almost 70% of the route is river trekking.',
      'Pinggan-pinggan Campsite has wide flat ground but no water source; Rancho Campsite is around 1,400 MASL and has a water source.',
      'Knife Edge is a scenic ridge with steep drop-offs.',
    ],
    trailGuide: {
      startPoint: 'Barangay Lombuyan (also reported as Lomboyan/Lumbuyan), Barbaza. Register and secure permits at the Barbaza Municipal Hall or Tourism Office before proceeding to the trailhead.',
      summitTrail: 'The trek usually starts with river crossings along the Dalanas River; almost 70% of the route is river trekking.',
      dropOff: 'Register at the Barbaza Municipal Hall or Tourism Office, then arrange transport to the Barangay Lombuyan jump-off.',
      landmarks: [
        'Dalanas River: Start of the trek; almost 70% is river trekking.',
        'Pinggan-pinggan Campsite: Wide flat ground, but no water source.',
        'Knife Edge: A famous scenic ridge with steep drop-offs.',
        'Rancho Campsite: Approximately 1,400 MASL, with a water source and cold temperatures.',
      ],
      water: 'There is a water source at the Rancho campsite, but it is not guaranteed to be potable. Bring water purification tablets or a filter.',
      notes: 'On Day 1, the route is mostly river trekking, so wear comfortable footwear that can get wet, such as sandals or quick-dry shoes.',
    },
    etiquette: ['Practice strict Leave No Trace by packing out all waste and avoiding the collection of plants or disturbance of wildlife in the mossy forest.'],
    etiquetteGuide: {
      note: 'Practice strict Leave No Trace by packing out all waste and avoiding the collection of plants or disturbance of wildlife in the mossy forest.',
    },
    alerts: [],
  },
  '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6': {
    id: '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6',
    mountainName: 'Mt. Madja-as',
    preparation: [],
    safety: [
      'Wear full-coverage clothing to protect against prevalent leeches, prepare for sudden weather changes, maintain a safe distance from the exposed knife-edge ridge, purify all water from trail sources, and always stay with your guide due to the difficult terrain and limited signal.',
    ],
    safetyGuide: {
      note: 'Wear full-coverage clothing to protect against prevalent leeches, prepare for sudden weather changes, maintain a safe distance from the exposed knife-edge ridge, purify all water from trail sources, and always stay with your guide due to the difficult terrain and limited signal.',
    },
    transportation: [],
    transportGuide: {
      startPoint: 'Culasi town proper; visit the Municipal Tourism Office for orientation and permits and the Police Station for log-in before heading to Brgy. Flores.',
      whereToAvail: 'Culasi Municipal Tourism Office (for orientation and permit) and the Culasi Police Station (for log-in). Guide is mandatory and can be arranged here.',
      nextStop: 'Brgy. Flores (the jump-off point). From Culasi town proper, take a motorcycle/habal-habal or tricycle to the trailhead near the concrete bridge.',
      lastStop: 'Culasi Municipal Hall / Police Station. This is where you log out and secure your certificate after descending.',
      faresNotes: 'Permit: ~₱150 per person per day.\nGuide Fee: ~₱600 per day per group of up to 5 people.\nPorter Fee: ~₱800 per day per group (optional).\nNote: Rates are based on 2022 data; confirm current prices with the tourism office. Transport from Kalibo to Culasi takes about 2–3 hours by bus/van.',
      options: [],
    },
    trailTips: [
      'The summit trail is a strenuous major climb (Difficulty 8/9). From Bantang River campsite, expect steep, muddy assaults with roots and loose rocks. You will pass through mossy forests and the bonsai forest (crown shyness phenomenon) before reaching the Opao Knife-Edge ridge, which is exposed with strong winds. The final ridge to the summit offers views of Western Panay in clear weather.',
    ],
    trailGuide: {
      startPoint: 'Brgy. Flores, the jump-off point near the concrete bridge.',
      summitTrail: 'The summit trail is a strenuous major climb (Difficulty 8/9). From Bantang River campsite, expect steep, muddy assaults with roots and loose rocks. You will pass through mossy forests and the bonsai forest (crown shyness phenomenon) before reaching the Opao Knife-Edge ridge, which is exposed with strong winds. The final ridge to the summit offers views of Western Panay in clear weather.',
    },
    etiquette: [
      'Respect the mountain\'s sacred status in Visayan mythology (home of Sidapa and Bulalakaw). Practice strict Leave No Trace—pack out all trash (especially since leeches are present) and avoid disturbing the mossy forest and bonsai trees.',
    ],
    etiquetteGuide: {
      note: 'Respect the mountain\'s sacred status in Visayan mythology (home of Sidapa and Bulalakaw). Practice strict Leave No Trace—pack out all trash (especially since leeches are present) and avoid disturbing the mossy forest and bonsai trees.',
    },
    alerts: [],
  },
};
