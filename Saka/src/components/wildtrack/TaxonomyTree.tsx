import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaxonomyNode } from '../../types/wildtrack';

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
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rank: {
    fontSize: 12,
    color: '#64748B',
  },
  value: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
});
