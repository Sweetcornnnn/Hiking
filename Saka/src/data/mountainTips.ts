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
