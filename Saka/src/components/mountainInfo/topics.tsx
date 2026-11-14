import React, { type ReactNode } from 'react';
import type { MountainTips } from '../../data/mountainTips';
import { TOPIC } from '../../theme/designTokens';
import TrailTipsScene from './scenes/TrailTipsScene';
import TransportationScene from './scenes/TransportationScene';
import SafetyScene from './scenes/SafetyScene';
import PreparationScene from './scenes/PreparationScene';
import EtiquetteScene from './scenes/EtiquetteScene';
import {
  EtiquetteDetail,
  ItemsDetail,
  PreparationDetail,
  SafetyDetail,
  TrailDetail,
  TransportDetail,
  formatPrice,
} from './GuideDetails';

export type TopicKey = 'trail' | 'transport' | 'preparation' | 'safety' | 'etiquette';

export interface Topic {
  key: TopicKey;
  title: string;
  subtitle: string;
  accent: string;
  scene: ReactNode;
  /** The one fact the card shows without opening the sheet. */
  headline: string;
  /** Small supporting line, e.g. "3 rides". */
  meta?: string;
  detail: ReactNode;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function fallback(items: string[]) {
  return {
    headline: items[0] ?? 'No tips yet',
    meta: items.length > 0 ? plural(items.length, 'tip') : undefined,
  };
}

/** Turns the mountain's guide data into the five topics shown on the screen. */
export function buildTopics(tips: MountainTips): Record<TopicKey, Topic> {
  // ── Trail ──
  const trail = tips.trailGuide;
  const hasTrail = Boolean(trail && trail.startPoint);
  const stopCount = trail?.stops?.length ?? 0;

  // ── Transport ──
  const transport = tips.transportGuide;
  const hasTransport = Boolean(transport && (transport.startPoint || transport.options.length > 0));
  const prices = (transport?.options ?? [])
    .map((o) => o.pricePerPerson)
    .filter((p): p is number => typeof p === 'number');
  const rideCount = transport?.options.length ?? 0;

  // ── Preparation ──
  const prep = tips.preparationGuide;
  const hasPrep = Boolean(prep && (prep.facts?.length || prep.fees?.length || prep.bring?.length || prep.note));
  const fee = prep?.fees?.[0];
  const bringCount = prep?.bring?.length ?? 0;

  // ── Safety ──
  const safety = tips.safetyGuide;
  const hasSafety = Boolean(safety && (safety.hazards?.length || safety.weather || safety.emergency));
  const hazardCount = safety?.hazards?.length ?? 0;

  // ── Etiquette ──
  const etiquette = tips.etiquetteGuide;
  const hasEtiquette = Boolean(etiquette && (etiquette.rules?.length || etiquette.local));
  const ruleCount = etiquette?.rules?.length ?? 0;

  return {
    trail: {
      key: 'trail',
      title: 'Trail Tips & Navigation',
      subtitle: 'Know the trail, find your way.',
      accent: TOPIC.teal,
      scene: <TrailTipsScene />,
      ...(hasTrail && trail
        ? { headline: trail.startPoint, meta: stopCount > 0 ? plural(stopCount, 'stop') : undefined }
        : fallback(tips.trailTips)),
      detail: hasTrail && trail ? <TrailDetail guide={trail} /> : <ItemsDetail items={tips.trailTips} accent={TOPIC.teal} />,
    },
    transport: {
      key: 'transport',
      title: 'Transportation Guide',
      subtitle: 'Get there without the stress.',
      accent: TOPIC.blue,
      scene: <TransportationScene />,
      ...(hasTransport && transport
        ? {
            headline: prices.length > 0 ? `From ${formatPrice(Math.min(...prices))} per person` : transport.startPoint || 'See route details',
            meta: rideCount > 0 ? plural(rideCount, 'ride') : 'Route details',
          }
        : fallback(tips.transportation)),
      detail: hasTransport && transport ? <TransportDetail guide={transport} /> : <ItemsDetail items={tips.transportation} accent={TOPIC.blue} />,
    },
    preparation: {
      key: 'preparation',
      title: 'Preparation & Requirements',
      subtitle: 'What to bring before you go.',
      accent: TOPIC.gold,
      scene: <PreparationScene />,
      ...(hasPrep && prep
        ? {
            headline: fee ? `${fee.label} ${fee.amount}` : prep.facts?.[0] ? `${prep.facts[0].label}: ${prep.facts[0].value}` : prep.note ?? 'See requirements',
            meta: bringCount > 0 ? `${plural(bringCount, 'item')} to bring` : undefined,
          }
        : fallback(tips.preparation)),
      detail: hasPrep && prep ? <PreparationDetail guide={prep} /> : <ItemsDetail items={tips.preparation} accent={TOPIC.gold} />,
    },
    safety: {
      key: 'safety',
      title: 'Safety Guidelines',
      subtitle: 'Stay safe and be prepared.',
      accent: TOPIC.coral,
      scene: <SafetyScene />,
      ...(hasSafety && safety
        ? {
            headline: safety.hazards?.[0]?.label ?? safety.emergency ?? safety.weather ?? 'See safety guide',
            meta: hazardCount > 0 ? plural(hazardCount, 'hazard') : undefined,
          }
        : fallback(tips.safety)),
      detail: hasSafety && safety ? <SafetyDetail guide={safety} /> : <ItemsDetail items={tips.safety} accent={TOPIC.coral} />,
    },
    etiquette: {
      key: 'etiquette',
      title: 'Environmental Etiquette',
      subtitle: 'Keep the mountain clean and green.',
      accent: TOPIC.sage,
      scene: <EtiquetteScene />,
      ...(hasEtiquette && etiquette
        ? {
            headline: etiquette.rules?.[0]?.label ?? etiquette.local ?? 'See etiquette guide',
            meta: ruleCount > 0 ? plural(ruleCount, 'rule') : undefined,
          }
        : fallback(tips.etiquette)),
      detail: hasEtiquette && etiquette ? <EtiquetteDetail guide={etiquette} /> : <ItemsDetail items={tips.etiquette} accent={TOPIC.sage} />,
    },
  };
}