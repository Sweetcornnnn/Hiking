import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OccurrenceRecord } from '../../types/wildtrack';
import {
  BG_PANEL,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GREEN,
} from '../../theme/designTokens';

interface ObservationTimelineProps {
  observations?: OccurrenceRecord[];
  embedded?: boolean;
}

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({
  observations = [],
  embedded = false,
}) => {
  const visible = observations.slice(0, 5);

  if (visible.length === 0) {
    return (
      <View style={[styles.container, embedded && styles.embeddedContainer]}>
        <Text style={styles.title}>Observation timeline</Text>
        <Text style={styles.emptyText}>No recent field observations available yet.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, embedded && styles.embeddedContainer]}>
      <Text style={styles.title}>Observation timeline</Text>
      <View style={styles.observationsGrid}>
        {visible.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.source}>
              {item.source === 'inaturalist' ? 'iNaturalist' : 'GBIF'}
            </Text>
            <Text style={styles.when}>
              {item.recordedAt && Number.isFinite(new Date(item.recordedAt).getTime())
                ? new Date(item.recordedAt).toLocaleDateString()
                : 'Date not provided'}
            </Text>
            <Text style={styles.where}>
              {item.locality || item.country || 'Location not provided'}
            </Text>
            {(item.habitat || item.dataset) && (
              <Text style={styles.meta}>
                {item.habitat
                  ? `Habitat: ${item.habitat}`
                  : `Dataset: ${item.dataset}`}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_PANEL,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  embeddedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  observationsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14 },
  row: { flexBasis: '47%', flexGrow: 1 },
  source: { fontSize: 9, color: ACCENT_GREEN, fontWeight: '700', marginBottom: 2 },
  when: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '500' },
  where: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  meta: { fontSize: 9, color: TEXT_MUTED, marginTop: 2 },
  emptyText: { color: TEXT_MUTED, fontSize: 10 },
});