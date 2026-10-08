import React from 'react';
import InfoSection from '../InfoSection';
import { ACCENT_GOLD } from '../../../theme/designTokens';

export interface TransportationSectionProps {
  items: string[];
}

export default function TransportationSection({ items }: TransportationSectionProps) {
  return (
    <InfoSection
      title="Transportation Guide"
      subtitle="Get there without the stress."
      icon="bus-outline"
      iconColor={ACCENT_GOLD}
      items={items}
      compact
      showArrow={false}
    />
  );
}