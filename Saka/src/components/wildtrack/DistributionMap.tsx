import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OccurrenceRecord } from '../../types/wildtrack';

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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  headerRow: {
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  mapCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapBackground: {
    width: 140,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: '#14B8A6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerNorth: {
    top: 18,
    left: 52,
  },
  markerCentral: {
    top: 38,
    left: 98,
  },
  markerSouth: {
    top: 76,
    left: 34,
  },
  mapStats: {
    flex: 1,
  },
  statTitle: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F766E',
    marginBottom: 4,
  },
  statDetail: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  badge: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  badgeText: {
    fontSize: 12,
    color: '#0F172A',
  },
});
