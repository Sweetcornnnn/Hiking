import React from 'react';
import InfoSection from '../InfoSection';
import TrailTipsScene from '../scenes/TrailTipsScene';
import { PALETTE } from '../scenes/Primitives';

export interface TrailTipsSectionProps {
  items: string[];
}

export default function TrailTipsSection({ items }: TrailTipsSectionProps) {
  return (
    <InfoSection
      title="Trail Tips & Navigation"
      subtitle="Know the trail, find your way."
      accent={PALETTE.teal}
      scene={<TrailTipsScene />}
      items={items}
    />
  );
}