import React from 'react';
import InfoSection from '../InfoSection';
import { ACCENT_GOLD } from '../../../theme/designTokens';

export interface SafetySectionProps {
  items: string[];
}

export default function SafetySection({ items }: SafetySectionProps) {
  return (
    <InfoSection
      title="Safety Guidelines"
      subtitle="Stay safe and be prepared."
      icon="shield-checkmark-outline"
      iconColor={ACCENT_GOLD}
      items={items}
      compact
      showArrow={false}
    />
  );
}