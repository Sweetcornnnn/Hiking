import React from 'react';
import InfoSection from '../InfoSection';

export interface SafetySectionProps {
  items: string[];
}

export default function SafetySection({ items }: SafetySectionProps) {
  return <InfoSection title="Safety Guidelines" icon="shield-checkmark-outline" items={items} />;
}