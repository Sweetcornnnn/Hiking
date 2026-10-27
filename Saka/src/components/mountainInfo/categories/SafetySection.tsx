import React from 'react';
import InfoSection from '../InfoSection';
import SafetyScene from '../scenes/SafetyScene';
import { PALETTE } from '../scenes/Primitives';

export interface SafetySectionProps {
  items: string[];
}

export default function SafetySection({ items }: SafetySectionProps) {
  return (
    <InfoSection
      title="Safety Guidelines"
      subtitle="Stay safe and be prepared."
      accent={PALETTE.coral}
      scene={<SafetyScene />}
      items={items}
    />
  );
}