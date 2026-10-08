import React from 'react';
import InfoSection from '../InfoSection';
import { ACCENT_GREEN } from '../../../theme/designTokens';

export interface EtiquetteSectionProps {
  items: string[];
}

export default function EtiquetteSection({ items }: EtiquetteSectionProps) {
  return (
    <InfoSection
      title="Environmental Etiquette"
      subtitle="Keep the mountain clean and green."
      icon="leaf-outline"
      iconColor={ACCENT_GREEN}
      items={items}
      compact
      showArrow={false}
    />
  );
}
