import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OccurrenceRecord } from '../../types/wildtrack';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GREEN,
} from '../../theme/designTokens';

interface DistributionMapProps {
  occurrences?: OccurrenceRecord[];
}

export const DistributionMap: React.FC<DistributionMapProps> = ({ occurrences = [] }) => {
  const summary = {
    total: occurrences.length,
    philippine: occurrences.filter((record) =>
      record.country?.toLowerCase().includes('philippines')
    ).length,
    mountain: occurrences.filter(
      (record) =>
        record.locality?.toLowerCase().includes('mt.') ||
        record.locality?.toLowerCase().includes('mount')
    ).length,
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Distribution</Text>
        <Text style={styles.subtitle}>Philippine mountain occurrence preview</Text>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapBackground}>
          <View style={[styles.marker, styles.markerNorth]} />
          <View style={[styles.marker, styles.markerCentral]} />
          <View style={[styles.marker, styles.markerSouth]} />
        </View>

        <View style={styles.mapStats}>
          <Text style={styles.statTitle}>Observation points</Text>
          <Text style={styles.statValue}>{summary.total}</Text>
          <Text style={styles.statDetail}>{summary.philippine} Philippine records</Text>
          <Text style={styles.statDetail}>{summary.mountain} mountain hotspots</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{summary.total} sightings</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{summary.philippine} in PH</Text>
        </View>
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
  headerRow: { marginBottom: 14 },
  title: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  subtitle: { fontSize: 10, color: TEXT_MUTED, marginTop: 4 },
  mapCard: {
    backgroundColor: BG_SUBTLE,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  mapBackground: {
    width: '100%',
    height: 130,
    borderRadius: 16,
    backgroundColor: '#0B1220',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: ACCENT_GREEN,
    borderWidth: 2,
    borderColor: TEXT_PRIMARY,
  },
  markerNorth: { top: 20, left: '30%' },
  markerCentral: { top: 44, left: '58%' },
  markerSouth: { top: 84, left: '20%' },
  mapStats: { width: '100%' },
  statTitle: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '600', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '700', color: ACCENT_GREEN, marginBottom: 4 },
  statDetail: { fontSize: 10, color: TEXT_MUTED, marginBottom: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  badge: {
    backgroundColor: BG_SUBTLE,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  badgeText: { fontSize: 10, color: TEXT_PRIMARY, fontWeight: '600' },
});