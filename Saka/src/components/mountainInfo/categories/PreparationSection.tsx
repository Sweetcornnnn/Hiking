import React from 'react';
import InfoSection from '../InfoSection';
import { ACCENT_GOLD } from '../../../theme/designTokens';

export interface PreparationSectionProps {
  items: string[];
}

export default function PreparationSection({ items }: PreparationSectionProps) {
  return (
    <InfoSection
      title="Preparation & Requirements"
      subtitle="What to bring before you go."
      icon="clipboard-outline"
      iconColor={ACCENT_GOLD}
      items={items}
      compact
      showArrow={false}
    />
  );
}