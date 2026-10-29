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
  /** Where a vehicle might drop you off. */
  dropOff?: string;
  /** Ordered points on the trail. The first four are shown. */
  stops?: TrailStop[];
  /** Notable sights, in no particular order. */
  landmarks?: string[];
  /** Where to find water, and where not to count on it. */
  water?: string;
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

export const MOUNTAIN_TIPS: MountainTips[] = [
  {
    id: '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6',
    mountainName: 'Mt. Madja-as',
    preparation: [
      'A major climb rated 8/9 and a 3–4 day itinerary with about 14 hours to the summit are reported, but the rating and timings are not independently verified here.',
      'A guide and registration are reported requirements. Confirm current rules and where to register with the Culasi Tourism Office before hiking.',
      'Older reports list permit, barangay, and guide fees, but current amounts are unverified. Confirm all fees locally before booking.',
      'Older reports characterize this as a major climb and not for beginners; verify current route difficulty with a local guide. Bring a tent, dry bag, headlamp, rain jacket, power bank, trail food, first-aid kit, and water as advised for the confirmed route.',
    ],
    preparationGuide: {
      facts: [
        { label: 'Difficulty', value: 'Reported 8/9 · rating unverified' },
        { label: 'Duration', value: 'Reported 3–4 days · confirm itinerary' },
        { label: 'Guide', value: 'Reported required · confirm locally' },
        { label: 'Register', value: 'Police station reported · confirm with Culasi Tourism' },
      ],
      fees: [
        { label: 'Current permit, barangay & guide fees', amount: 'Confirm with Culasi Tourism Office' },
      ],
      bring: ['Tent', 'Dry bag', 'Headlamp', 'Rain jacket', 'Power bank', 'Trail food', 'First-aid kit', 'Water for the confirmed itinerary'],
      note: 'Older reports describe this as a major climb; confirm current route, conditions, and suitability with a local guide.',
    },
    safety: [
      'Older reports mention exposed knife-edge sections near the summit; confirm whether these are on your route and follow your guide’s instructions.',
      'Leeches, muddy sections, loose rocks, and steep ascents are reported, but current trail conditions are unverified.',
      'Check current weather and local advisories. Confirm check-in and emergency procedures with Culasi Tourism and your guide.',
    ],
    safetyGuide: {
      hazards: [
        { label: 'Exposed sections', detail: 'Knife-edge sections are reported near the summit; verify for your route.' },
        { label: 'Leeches and mud', detail: 'Reported by hikers; current conditions unverified.' },
        { label: 'Loose rocks and steep ascents', detail: 'Reported hazards; follow local guide instructions.' },
      ],
      weather: 'Mountain weather may change quickly; check current forecasts and local advisories.',
      emergency: 'Police-station registration is reported, but current check-in and evacuation procedures must be confirmed with Culasi Tourism and your guide.',
    },
    transportation: [
      'Van or bus travel to Culasi is reported from nearby hubs; a 2024 account describes a van from Caticlan taking about 2 hours. Confirm current routes and schedules.',
      'Barangay Flores is one reported jump-off; Alojipan is also listed in an older itinerary. Confirm the chosen route and final-mile transport locally.',
      'Organizer packages and prices vary. Confirm inclusions and current costs directly with an organizer; older prices are not verified.',
    ],
    transportGuide: {
      startPoint: 'Travel to Culasi, Antique. Barangay Flores and Alojipan are reported trailhead options; confirm your route and meeting point with Culasi Tourism.',
      options: [
        { vehicle: 'Bus or van to Culasi', kind: 'bus', note: 'Travel from Caticlan is reported at about 2 hours; route, duration, and schedule need current confirmation.' },
        { vehicle: 'Final-mile transport to the trailhead', kind: 'motorcycle', note: 'Local motorcycle transport is reported; confirm availability, distance, and fare for the selected trailhead.' },
      ],
      tip: 'Confirm current transport, registration, and package inclusions directly with Culasi Tourism or your organizer. Older package prices are unverified.',
    },
    trailTips: [
      'Older itineraries report a 3–4 day climb and camps named Bantang Camp 1, Camp 2, and Camp 3; route stages and elevations are unverified.',
      'Libog Falls, View Deck, Mossy Forest, and Knife Edge are reported landmarks; confirm which are on your selected route with a local guide.',
      'Water sources and availability vary and are not confirmed here. Ask your guide where water is available and how much to carry.',
    ],
    trailGuide: {
      startPoint: 'Barangay Flores is a reported trailhead; Alojipan is another reported route. Confirm the current registration process and chosen route with Culasi Tourism.',
      dropOff: 'Confirm the vehicle drop-off and final-mile transfer for your selected trailhead locally.',
      stops: [
        { label: 'Bantang Camp 1', detail: 'Reported itinerary stop · details unverified' },
        { label: 'Camp 2', detail: 'Reported stop · elevation and itinerary unverified' },
        { label: 'Camp 3', detail: 'Reported stop · elevation and itinerary unverified' },
      ],
      landmarks: ['Libog Falls', 'View Deck', 'Mossy Forest', 'Knife Edge (reported; confirm these are on your route)'],
      water: 'Water locations and seasonal availability are unverified. Confirm reliable sources and carry requirements with your guide.',
      tip: 'Route stages and elevations are based on older itineraries and need confirmation with a local guide.',
    },
    etiquette: [
      'Pack out all waste, including food scraps, and leave plants and wildlife undisturbed.',
      'Older accounts describe Mt. Madja-as as culturally significant and associate it with Sidapa and Bulalakaw. Verify local beliefs and protocols with the community or guide.',
    ],
    etiquetteGuide: {
      rules: [
        { label: 'Pack out all waste', detail: 'Including food scraps.' },
        { label: 'Leave nature as you found it', detail: 'Plants and wildlife undisturbed.' },
      ],
      local: 'Some accounts describe Mt. Madja-as as culturally significant and associate it with Sidapa and Bulalakaw. Ask local guides about community beliefs and protocols.',
    },
    alerts: [
      {
        type: 'warning',
        title: 'Confirm current access requirements',
        message: 'Older reports describe a major climb, required guide and registration, and a daily climbing cap. Confirm current trail conditions, requirements, capacity, and booking with Culasi Tourism before departure.',
        date: 'Local report referenced a 30-hiker daily limit effective Nov. 24, 2025; current status unverified.',
      },
    ],
  },
  {
    id: '2cd5666c-1deb-4499-812e-eb95a992ef68',
    mountainName: 'Mt. Balinsasayaw',
    preparation: [
      'A tour operator describes the summit trek as about 1 hour and the full trekking activity as about 4 hours. Treat these as reported estimates and assess your own fitness.',
      'A 2024 secondary source reports a Barangay Mambusao jump-off, registration at the Barangay Hall, and a local guide requirement. Confirm current arrangements with the barangay or tour operator.',
      'Bring hiking shoes, extra clothes, sunscreen, insect repellent, and a waterproof bag. Confirm age/access rules and package inclusions with your operator; no reliable source confirms an under-13 restriction.',
    ],
    preparationGuide: {
      facts: [
        { label: 'Difficulty', value: 'Described as easy by tour listings; not independently assessed' },
        { label: 'Duration', value: 'Reported: 1 h summit trek · 4 h activity' },
        { label: 'Access', value: 'Mambusao registration and local guide reported; confirm' },
        { label: 'Age rules', value: 'Confirm with barangay or tour operator' },
      ],
      fees: [
        { label: 'Guide, entrance & transport fees', amount: 'May be package-included; confirm current costs' },
      ],
      bring: ['Hiking shoes', 'Extra clothes', 'Sunscreen', 'Insect repellent', 'Waterproof bag'],
      note: 'Package information comes from commercial tour listings and may vary by operator.',
    },
    safety: [
      'Use caution on steep sections.',
      'Extreme weather may make some destinations inaccessible; tour operators may provide alternative sites.',
      'Check the weather and follow local guide instructions throughout the visit.',
    ],
    safetyGuide: {
      hazards: [{ label: 'Steep sections', detail: 'Use caution.' }],
      weather: 'Check the forecast. Extreme weather may close some destinations; operators may offer alternative sites.',
      emergency: 'Follow your local guide’s instructions throughout the visit.',
    },
    transportation: [
      'Pick-up and drop-off are available within Kalibo or Caticlan on participating tours.',
      'The tour lasts about 8–9 hours in total and includes transportation during the tour.',
      'Confirm the operator, itinerary, and included transport before booking.',
    ],
    transportGuide: {
      startPoint: 'The reported trail access is Barangay Mambusao, Ibajay. Some participating tours offer pick-up in Kalibo or Caticlan.',
      options: [
        {
          vehicle: 'Participating tour transport',
          kind: 'van',
          note: 'Pick-up may be available in Kalibo or Caticlan; confirm operator, route, schedule, and inclusions.',
        },
      ],
      tip: 'Confirm registration at Barangay Mambusao Hall, guide arrangements, fares, and itinerary locally. Tour transport details are operator-specific.',
    },
    trailTips: [
      'A tour listing describes the summit trek as about 1 hour; this is a reported estimate, not an official trail-time assessment.',
      'Katunggan it Ibajay and Nawidwid Falls are listed as nearby tour attractions; confirm whether they are separate stops rather than part of the Mt. Balinsasayaw trail.',
      'A tour listing gives 830–846 m for the area, not necessarily the summit. Treat the elevation as unverified.',
    ],
    trailGuide: {
      startPoint: 'Barangay Mambusao is the reported trail access point; confirm the current route with the barangay or guide.',
      dropOff: 'Barangay Mambusao is reported as the jump-off; confirm the exact drop-off and registration point.',
      stops: [{ label: 'Summit trail', detail: 'About 1 hour reported by a tour operator' }],
      landmarks: ['Katunggan it Ibajay and Nawidwid Falls appear in tour listings as nearby attractions; confirm whether they are separate destinations.'],
      tip: 'Tour listings report 830–846 m for the area, not a verified summit elevation.',
    },
    etiquette: [
      'Follow Leave No Trace principles and do not litter.',
      'Katunggan it Ibajay protects the Philippines’ largest api-api (Avicennia rumphiana) mangrove tree.',
      'Respect the local communities that manage the park and follow posted conservation guidance.',
    ],
    etiquetteGuide: {
      rules: [
        { label: 'Leave No Trace', detail: 'Do not litter.' },
        { label: 'Follow posted guidance', detail: 'Respect the conservation rules in the park.' },
      ],
      local: 'Respect the local communities that manage the park.',
      note: 'Katunggan it Ibajay protects the Philippines’ largest api-api (Avicennia rumphiana) mangrove tree.',
    },
    alerts: [
      {
        type: 'info',
        title: 'Confirm tour terms before booking',
        message: 'Tour inclusions, age rules, and cancellation terms vary. Confirm the current policy directly with your operator.',
      },
      {
        type: 'warning',
        title: 'Weather advisory',
        message: 'Extreme weather may cause destination closures or itinerary changes.',
      },
    ],
  },
  {
    id: 'd39ff04a-069b-4d90-b448-f66e6ae05772',
    mountainName: 'Mt. M',
    preparation: [
      'The name “Mt. M” is not confirmed by the sources reviewed and may be a placeholder. Confirm the intended mountain and its local name with the Tangalan Municipal Tourism Office before relying on this guide.',
    ],
    preparationGuide: {
      note: 'No official or local source reviewed confirms a mountain named “Mt. M” in Tangalan. This may be a placeholder; confirm the intended destination with the Tangalan Municipal Tourism Office.',
    },
    safety: [
      'Trail-specific safety information is not available. Coordinate with the Tangalan LGU before hiking and follow standard hiking precautions.',
    ],
    safetyGuide: {
      emergency: 'Coordinate with the Tangalan LGU before hiking and follow standard hiking precautions.',
      note: 'Trail-specific safety information is not available.',
    },
    transportation: [
      'The route, travel time, and jump-off for the intended destination are unverified. Confirm the destination and current transport with the Tangalan Municipal Tourism Office.',
    ],
    transportGuide: {
      startPoint: 'The intended destination and its location have not been confirmed. Contact Tangalan Municipal Tourism before planning travel.',
      options: [],
      tip: 'No verified jump-off, route, travel time, schedule, or fare is available for “Mt. M.”',
    },
    trailTips: [
      'The identity of “Mt. M” and any associated trail are unverified. Do not rely on a Pudiot jump-off or route until confirmed by Tangalan Municipal Tourism.',
    ],
    trailGuide: {
      startPoint: 'No verified trailhead is available because the mountain identity is unconfirmed.',
      tip: 'Route, landmarks, water sources, and trail conditions are unknown. Confirm the intended destination with Tangalan Municipal Tourism.',
    },
    etiquette: [
      'Follow Leave No Trace principles, carry out all trash, and respect the local community.',
    ],
    etiquetteGuide: {
      rules: [{ label: 'Leave No Trace', detail: 'Carry out all trash.' }],
      local: 'Respect the local community.',
    },
    alerts: [
      {
        type: 'info',
        title: 'Destination name unconfirmed',
        message: 'No source reviewed confirms a mountain named “Mt. M” in Tangalan. Confirm the intended destination with Tangalan Municipal Tourism. Aklan Provincial Tourism Office: (036) 272-7000 local 6500.',
      },
    ],
  },
  {
    id: 'aeffeadd-0cb8-418f-b356-5c6dab35b219',
    mountainName: 'Mt. Opaw (Buruanga)',
    preparation: [
      'Data pending — coordinate with the Buruanga Municipal Tourism Office for verified trail difficulty, duration, fees, and guide requirements.',
    ],
    preparationGuide: {
      note: 'Data pending. Coordinate with the Buruanga Municipal Tourism Office for verified trail difficulty, duration, fees and guide requirements.',
    },
    safety: [
      'Trail-specific safety information is not available. Coordinate with the Buruanga LGU before hiking and follow standard hiking precautions.',
    ],
    safetyGuide: {
      emergency: 'Coordinate with the Buruanga LGU before hiking and follow standard hiking precautions.',
      note: 'Trail-specific safety information is not available.',
    },
    transportation: [
      'Kalibo to Buruanga is approximately 1.5–2 hours by bus or van. Confirm current schedules, fares, and the jump-off point with the Buruanga LGU.',
    ],
    transportGuide: {
      startPoint: 'Ride from Kalibo to Buruanga, then confirm the jump-off with the Buruanga LGU.',
      options: [
        { vehicle: 'Bus or van to Buruanga', kind: 'bus', note: 'From Kalibo, about 1.5–2 hours.' },
      ],
      tip: 'Confirm current schedules and fares with the Buruanga LGU.',
    },
    trailTips: [
      'Data pending — coordinate with the Buruanga LGU for the route, landmarks, water sources, and current trail conditions.',
    ],
    trailGuide: {
      startPoint: 'Confirm the jump-off with the Buruanga LGU before you go.',
      tip: 'Route, landmarks, water sources and trail conditions are pending. Coordinate with the Buruanga LGU.',
    },
    etiquette: [
      'Follow Leave No Trace principles, carry out all trash, and respect the local community.',
    ],
    etiquetteGuide: {
      rules: [{ label: 'Leave No Trace', detail: 'Carry out all trash.' }],
      local: 'Respect the local community.',
    },
    alerts: [
      {
        type: 'info',
        title: 'Data pending — coordinate with LGU',
        message: 'Contact the Buruanga Municipal Tourism Office for current trail information and advisories. The Aklan Provincial Tourism Office can be reached at (036) 272-7000 local 6500.',
      },
    ],
  },
  {
    id: 'f2173971-80bf-40dd-96e9-c6b015be194b',
    mountainName: 'Pandan Hills',
    preparation: [
      'A 2018 personal blog describes this as a short, easy walk with no guide. This is not an official assessment; confirm whether the trail remains accessible and whether a guide is now required.',
      'Bring comfortable clothing, water, and sun protection.',
    ],
    preparationGuide: {
      facts: [
        { label: 'Difficulty', value: 'Described as easy in a 2018 personal blog' },
        { label: 'Guide', value: 'Reported not required in 2018 · confirm locally' },
        { label: 'Duration', value: 'A few minutes reported · unverified' },
      ],
      bring: ['Comfortable clothing', 'Water', 'Sun protection'],
      note: 'The Bay-ang route is an informal report. Confirm the local name, location, current access, and whether this is the intended destination with Aklan tourism.',
    },
    safety: [
      'The route and trail conditions have not been independently verified. Check current weather and access conditions locally before setting out.',
      'Use caution on wet or uneven ground and follow any local guidance.',
    ],
    safetyGuide: {
      hazards: [{ label: 'Trail conditions unverified', detail: 'Check locally for current hazards and access restrictions.' }],
      weather: 'Check the current forecast and local conditions before setting out; seasonal details are not verified here.',
    },
    transportation: [
      'A 2018 personal blog reports travel from Kalibo through the Altavas jeepney terminal to a Bay-ang junction, then a hired motorcycle. Current routes and access are unverified.',
      'The same blog reports travel from Caticlan to Kalibo before continuing toward Bay-ang. Confirm current public transport, schedules, fares, and the intended destination locally.',
      'Ask local tourism staff or transport operators for current last-mile transport and return arrangements; no verified contact is listed here.',
    ],
    transportGuide: {
      startPoint: 'A 2018 personal blog reports a route via Kalibo, the Altavas jeepney terminal, and a Bay-ang junction. Confirm that this is the correct destination and current route.',
      options: [
        { vehicle: 'Caticlan to Kalibo', kind: 'van', note: 'A route is reported in a 2018 personal blog; current schedule and travel time unverified.' },
        { vehicle: 'Kalibo to the Altavas terminal', kind: 'tricycle', note: 'Reported route; confirm current terminal and fare locally.' },
        { vehicle: 'Jeepney toward Bay-ang', kind: 'jeepney', note: 'A Bay-ang junction route is reported; schedule and travel time unverified.' },
        { vehicle: 'Hired motorcycle to the reported trail area', kind: 'motorcycle', note: 'Reported in a personal blog; confirm access, availability, and fare.' },
      ],
      tip: 'Route details come from a 2018 personal blog. Ask Aklan tourism or local operators to confirm the destination, current route, transport, and return arrangements.',
    },
    trailTips: [
      'A 2018 personal blog describes a walk of a few minutes from the reported access point; trail duration and current access are unverified.',
      'The reported view and seasonal recommendations have not been independently confirmed.',
    ],
    trailGuide: {
      startPoint: 'The Bay-ang area is reported in a 2018 personal blog; confirm the destination identity and exact start point with local tourism.',
      dropOff: 'A junction near Barangay Bay-ang is reported as an access point; current vehicle access is unverified.',
      stops: [{ label: 'Hill walk', detail: 'A few minutes reported in a 2018 personal blog' }],
      tip: 'The name “Pandan Hills” and this route are not confirmed by an official source. This entry is not Mt. Mab-o in Pandan, Antique; confirm which destination is intended.',
    },
    etiquette: [
      'Observe Leave No Trace principles and respect the local community.',
    ],
    etiquetteGuide: {
      rules: [{ label: 'Leave No Trace', detail: 'Observe its principles.' }],
      local: 'Respect the local community.',
    },
    alerts: [
      {
        type: 'info',
        title: 'Confirm destination and access',
        message: 'The Bay-ang route and “Pandan Hills” name are reported by a personal blog, not confirmed by an official source. Confirm the intended destination and current access with Aklan tourism before traveling.',
      },
    ],
  },
  {
    id: 'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65',
    mountainName: 'Mt. Nangtud',
    preparation: [
      'Mt. Nangtud is a remote, high-elevation climb commonly listed at about 2,073 m. Treat it as a strenuous expedition and plan for a multi-day itinerary unless local organizers confirm otherwise.',
      'Contact the relevant municipal or barangay tourism office before booking to confirm the current route, required guide, permits, registration, fees, and trail status.',
      'Build up hiking fitness in advance. Pack broken-in hiking footwear, layered clothing, rain protection, a headlamp with spare power, first-aid supplies, navigation and communication equipment, and enough food and water for the confirmed itinerary.',
      'Share your itinerary and expected return time with someone at home. Arrange check-ins and an emergency plan with your group and guide before leaving.',
    ],
    preparationGuide: {
      facts: [
        { label: 'Elevation', value: 'About 2,073 m commonly listed · unverified' },
        { label: 'Type', value: 'Remote, strenuous' },
        { label: 'Duration', value: 'Multi-day itinerary' },
        { label: 'Rules', value: 'Confirm guide, permits and fees locally' },
      ],
      fees: [
        { label: 'Guide/porter (2025 report)', amount: '₱1,000/day reported; basis and current rate unverified' },
      ],
      bring: [
        'Broken-in hiking footwear',
        'Layered clothing',
        'Rain protection',
        'Headlamp with spare power',
        'First-aid supplies',
        'Navigation and communication gear',
        'Food and water',
      ],
      note: 'A September 2025 personal climb report mentioned a ₱1,000/day guide/porter rate; the basis and current rate are unverified. Confirm locally. Share your itinerary and expected return time with someone at home.',
    },
    safety: [
      'Weather, trail duration, water availability, and communications can change quickly in remote mountain terrain. Check the forecast and current local advisories shortly before departure.',
      'Stay with your group and follow your local guide’s instructions. Do not continue onto exposed or unfamiliar sections when visibility, weather, or your condition deteriorates.',
      'Turn back if anyone develops signs of altitude illness, hypothermia, injury, or severe exhaustion. Know the agreed evacuation and emergency-contact plan before the climb.',
      'Do not rely on mobile coverage or unverified trail reports; carry a charged phone and a backup means of communication appropriate to the route.',
    ],
    safetyGuide: {
      hazards: [
        { label: 'Changing conditions', detail: 'Weather, trail time, water and communications can shift quickly.' },
        { label: 'Stay with your group', detail: 'Follow your guide. Turn back if anyone shows altitude illness, hypothermia, injury or exhaustion.' },
        { label: 'No signal', detail: 'Don’t rely on mobile coverage. Carry a backup way to communicate.' },
      ],
      weather: 'Check the forecast and local advisories shortly before departure.',
      emergency: 'Know the agreed evacuation and emergency-contact plan before the climb.',
    },
    transportation: [
      'Confirm the official jump-off point and road conditions with the local tourism office or your organizer. Nangtud access routes and transfer arrangements can depend on the chosen itinerary.',
      'Arrange return transport and a check-in time with your driver or host in advance. Confirm schedules, fares, and whether transport reaches the jump-off before traveling.',
      'Exact public-transport connections, guide contacts, and current fees should be verified locally; do not rely on outdated online listings.',
    ],
    transportGuide: {
      startPoint: 'Barangay Lombuyan (also reported as Lomboyan/Lumbuyan), Barbaza, is commonly cited as the jump-off. Confirm the current trailhead and registration point with Barbaza tourism staff or your authorized guide.',
      options: [
        {
          vehicle: 'Van from Iloilo City to Barbaza',
          kind: 'van',
          note: 'Reported by older and recent trip accounts; current route, schedule, and fare are unverified.',
        },
        {
          vehicle: 'Travel from Kalibo to Barbaza',
          kind: 'van',
          note: 'A connection has been reported, but current route and schedule are unverified.',
        },
        {
          vehicle: 'Barbaza to the jump-off',
          kind: 'motorcycle',
          note: 'Tricycle and habal-habal transfers via Mablad/Kapuywan are reported; arrange and confirm locally.',
        },
      ],
      tip: 'Arrange return transport in advance. Confirm the jump-off, registration, road conditions, schedules, and current fares with Barbaza tourism staff or MDRRMO; older prices are unverified.',
    },
    trailTips: [
      'Treat the commonly listed elevation of about 2,073 m as an approximate reference; confirm the route profile and expected hiking hours with your local guide.',
      'Ask your guide where the reliable water sources are and how much water to carry between them. Purify untreated water and do not assume a source will be available.',
      'Use a steady pace, take planned breaks, and keep a warm, dry layer accessible. Mountain weather can feel much colder and wetter than conditions at the jump-off.',
      'Trail-specific waypoint, campsite, and itinerary details are not verified here. Get the current route briefing from the local guide before setting out.',
    ],
    trailGuide: {
      startPoint: 'Barangay Lombuyan (also reported as Lomboyan/Lumbuyan), Barbaza, is commonly cited as the jump-off. Confirm the current trailhead and route with your authorized local guide.',
      dropOff: 'Arrange a confirmed vehicle drop-off and pick-up at the current jump-off with your guide or driver.',
      stops: [
        { label: 'Dalanas River', detail: 'Reported route section · conditions unverified' },
        { label: 'Pinggan-pinggan campsite', detail: 'Reported campsite · water availability unverified' },
        { label: 'Rancho campsite', detail: 'Reported campsite · confirm current access' },
        { label: 'EBJ Peak and summit', detail: 'Reported landmarks · route details unverified' },
      ],
      landmarks: ['Libtong campsite and Knife-Edge Ridge are reported along the route; confirm they are on your current itinerary.'],
      water: 'Older reports mention water at Lombuyan, along parts of Dalanas River, and near Rancho, and no water at Pinggan-pinggan. These reports are unverified and availability may change; confirm safe sources and carrying needs with your guide.',
      tip: 'Route stages, campsites, river crossings, timings, and summit elevation are reported but not independently confirmed. Check weather and river conditions and agree on emergency procedures before starting.',
    },
    etiquette: [
      'Pack out all rubbish, including food scraps and hygiene waste. Leave plants, wildlife, and natural features undisturbed.',
      'Respect local communities, customary practices, and any sacred or restricted areas. Ask before photographing residents or entering private land.',
      'Use established campsites and trails where directed, and follow local guidance on fires, water sources, and sanitation.',
    ],
    etiquetteGuide: {
      rules: [
        { label: 'Pack out all rubbish', detail: 'Including food scraps and hygiene waste.' },
        { label: 'Leave nature undisturbed', detail: 'Plants, wildlife and natural features.' },
        { label: 'Use established campsites and trails', detail: 'Follow local guidance on fires, water and sanitation.' },
      ],
      local: 'Respect local communities, customs and any sacred or restricted areas. Ask before photographing residents or entering private land.',
    },
    alerts: [
      {
        type: 'warning',
        title: 'Confirm local requirements before departure',
        message: 'Current guide rules, permits, fees, access, route conditions, and itinerary are not verified in this guide. Contact the local tourism office or an authorized organizer before traveling.',
      },
      {
        type: 'info',
        title: 'Plan as a remote, strenuous climb',
        message: 'Prepare for high elevation and limited services. Confirm water, communications, emergency procedures, and return transport with your guide.',
      },
    ],
  },
];