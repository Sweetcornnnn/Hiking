import React from 'react';
import InfoSection from '../InfoSection';
import { ACCENT_ORANGE } from '../../../theme/designTokens';

export interface TrailTipsSectionProps {
  items: string[];
}

export default function TrailTipsSection({ items }: TrailTipsSectionProps) {
  return (
    <InfoSection
      title="Trail Tips & Navigation"
      subtitle="Know the trail, find your way."
      icon="trail-sign-outline"
      iconColor={ACCENT_ORANGE}
      items={items}
      compact
      showArrow={false}
    />
  );
}