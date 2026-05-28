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

interface DistributionMapProps {
  occurrences?: OccurrenceRecord[];
}

export const DistributionMap: React.FC<DistributionMapProps> = ({ occurrences = [] }) => {
  const summary = {
    total: occurrences.length,
    philippine: occurrences.filter((record) => record.country?.toLowerCase().includes('philippines')).length,
    mountain: occurrences.filter((record) => record.locality?.toLowerCase().includes('mt.') || record.locality?.toLowerCase().includes('mount')).length,
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
        <View style={styles.badge}><Text style={styles.badgeText}>{summary.total} sightings</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>{summary.philippine} in PH</Text></View>
      </View>
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
  headerRow: {
    marginBottom: isLandscape ? 16 : 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  mapCard: {
    backgroundColor: BG_SUBTLE,
    borderRadius: 22,
    padding: isLandscape ? 16 : 14,
    flexDirection: isLandscape ? 'row' : 'column',
    alignItems: 'center',
    gap: isLandscape ? 16 : 12,
  },
  mapBackground: {
    width: isLandscape ? 180 : 140,
    height: isLandscape ? 140 : 120,
    borderRadius: 18,
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
  markerNorth: {
    top: 18,
    left: isLandscape ? 70 : 52,
  },
  markerCentral: {
    top: 38,
    left: isLandscape ? 130 : 98,
  },
  markerSouth: {
    top: 76,
    left: isLandscape ? 50 : 34,
  },
  mapStats: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT_GREEN,
    marginBottom: 4,
  },
  statDetail: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  badge: {
    backgroundColor: BG_SUBTLE,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  badgeText: {
    fontSize: 10,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
});
