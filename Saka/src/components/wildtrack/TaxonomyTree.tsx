import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaxonomyNode } from '../../types/wildtrack';
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

interface TaxonomyTreeProps {
  taxonomy?: TaxonomyNode;
}

export const TaxonomyTree: React.FC<TaxonomyTreeProps> = ({ taxonomy }) => {
  const [expanded, setExpanded] = useState(true);

  if (!taxonomy) {
    return null;
  }

  const entries = [
    { label: 'Kingdom', value: taxonomy.kingdom },
    { label: 'Phylum', value: taxonomy.phylum },
    { label: 'Class', value: taxonomy.class },
    { label: 'Order', value: taxonomy.order },
    { label: 'Family', value: taxonomy.family },
    { label: 'Genus', value: taxonomy.genus },
    { label: 'Species', value: taxonomy.species },
  ];

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded((prev) => !prev)}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Taxonomic classification</Text>
          <Text style={styles.subtitle}>Scientific hierarchy for mountain species</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#0F172A" />
      </Pressable>
      {expanded && (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.label} style={styles.entryRow}>
              <Text style={styles.rank}>{entry.label}</Text>
              <Text style={styles.value}>{entry.value || 'Unknown'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_PANEL,
    borderRadius: 22,
    padding: isLandscape ? 18 : 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isLandscape ? 14 : 12,
  },
  titleRow: {
    flex: 1,
  },
  title: {
    fontSize: isLandscape ? 16 : 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
    paddingTop: isLandscape ? 14 : 12,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: isLandscape ? 12 : 10,
  },
  rank: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  value: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
});
