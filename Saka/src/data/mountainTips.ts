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
};
