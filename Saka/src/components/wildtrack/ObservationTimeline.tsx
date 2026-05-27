import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OccurrenceRecord } from '../../types/wildtrack';

interface ObservationTimelineProps {
  observations?: OccurrenceRecord[];
}

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ observations = [] }) => {
  const visible = observations.slice(0, 5);

  if (visible.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Observation timeline</Text>
        <Text style={styles.emptyText}>No recent field observations available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Observation timeline</Text>
      {visible.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.marker} />
          <View style={styles.detailBlock}>
            <Text style={styles.when}>{item.recordedAt ? new Date(item.recordedAt).toLocaleDateString() : 'Unknown date'}</Text>
            <Text style={styles.where}>{item.locality || item.country || 'Unknown location'}</Text>
            <Text style={styles.meta}>{item.habitat || item.dataset || item.confidence || ''}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  marker: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: '#0F766E',
    marginTop: 6,
  },
  detailBlock: {
    flex: 1,
  },
  when: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  where: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
  },
});
