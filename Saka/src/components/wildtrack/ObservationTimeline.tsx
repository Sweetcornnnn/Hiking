import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OccurrenceRecord } from '../../types/wildtrack';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  ACCENT_GREEN,
} from '../../theme/designTokens';

const { width, height } = Dimensions.get('window');
const isLandscape = width >= height;

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
    backgroundColor: BG_PANEL,
    borderRadius: 24,
    padding: isLandscape ? 18 : 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: isLandscape ? 16 : 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: isLandscape ? 16 : 14,
  },
  marker: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: ACCENT_GREEN,
    marginTop: 6,
  },
  detailBlock: {
    flex: 1,
  },
  when: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  where: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  meta: {
    fontSize: 9,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 10,
  },
});
