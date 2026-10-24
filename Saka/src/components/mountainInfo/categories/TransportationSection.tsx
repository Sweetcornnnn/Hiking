import React from 'react';
import InfoSection from '../InfoSection';
import TransportationScene from '../scenes/TransportationScene';
import { PALETTE } from '../scenes/Primitives';

export interface TransportationSectionProps {
  items: string[];
}

export default function TransportationSection({ items }: TransportationSectionProps) {
  return (
    <InfoSection
      title="Transportation Guide"
      subtitle="Get there without the stress."
      accent={PALETTE.blue}
      scene={<TransportationScene />}
      items={items}
    />
  );
}