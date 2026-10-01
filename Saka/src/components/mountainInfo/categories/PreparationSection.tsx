import React from 'react';
import InfoSection from '../InfoSection';

export interface PreparationSectionProps {
  items: string[];
}

export default function PreparationSection({ items }: PreparationSectionProps) {
  return <InfoSection title="Preparation & Requirements" icon="clipboard-outline" items={items} />;
}