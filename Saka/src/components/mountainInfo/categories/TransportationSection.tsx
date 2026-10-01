import React from 'react';
import InfoSection from '../InfoSection';

export interface TransportationSectionProps {
  items: string[];
}

export default function TransportationSection({ items }: TransportationSectionProps) {
  return <InfoSection title="Transportation Guide" icon="bus-outline" items={items} />;
}