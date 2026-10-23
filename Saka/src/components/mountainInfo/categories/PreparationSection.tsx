import React from 'react';
import InfoSection from '../InfoSection';
import PreparationScene from '../scenes/PreparationScene';
import { PALETTE } from '../scenes/Primitives';

export interface PreparationSectionProps {
  items: string[];
}

export default function PreparationSection({ items }: PreparationSectionProps) {
  return (
    <InfoSection
      title="Preparation & Requirements"
      subtitle="What to bring before you go."
      accent={PALETTE.gold}
      scene={<PreparationScene />}
      items={items}
    />
  );
}