import React from 'react';
import InfoSection from '../InfoSection';

export interface EtiquetteSectionProps {
  items: string[];
}

export default function EtiquetteSection({ items }: EtiquetteSectionProps) {
  return <InfoSection title="Environmental Etiquette" icon="leaf-outline" items={items} />;
}
