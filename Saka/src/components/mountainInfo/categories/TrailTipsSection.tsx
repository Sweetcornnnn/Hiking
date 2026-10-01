import React from 'react';
import InfoSection from '../InfoSection';

export interface TrailTipsSectionProps {
  items: string[];
}

export default function TrailTipsSection({ items }: TrailTipsSectionProps) {
  return <InfoSection title="Trail Tips & Navigation" icon="trail-sign-outline" items={items} />;
}