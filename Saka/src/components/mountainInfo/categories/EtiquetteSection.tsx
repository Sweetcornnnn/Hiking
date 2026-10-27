import React from 'react';
import InfoSection from '../InfoSection';
import EtiquetteScene from '../scenes/EtiquetteScene';
import { PALETTE } from '../scenes/Primitives';

export interface EtiquetteSectionProps {
  items: string[];
}

export default function EtiquetteSection({ items }: EtiquetteSectionProps) {
  return (
    <InfoSection
      title="Environmental Etiquette"
      subtitle="Keep the mountain clean and green."
      accent={PALETTE.sage}
      scene={<EtiquetteScene />}
      items={items}
    />
  );
}