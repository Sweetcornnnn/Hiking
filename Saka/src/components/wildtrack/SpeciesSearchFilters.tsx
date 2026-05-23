import React from 'react';
import { ScrollView, Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeciesSearchFilters as SpeciesSearchFiltersType } from '../../types/wildtrack';

interface SpeciesSearchFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  suggestions: string[];
  onSelectSuggestion: (value: string) => void;
  filters: SpeciesSearchFiltersType;
  setFilter: (key: keyof SpeciesSearchFiltersType, value: any) => void;
  clearFilters: () => void;
  categoryLabels: { key: string; label: string }[];
  regionOptions: { key: string; label: string }[];
  mountainOptions: { key: string; label: string }[];
  isLoading: boolean;
}

export const SpeciesSearchFilters: React.FC<SpeciesSearchFiltersProps> = ({
  query,
  onQueryChange,
  onSearch,
  suggestions,
  onSelectSuggestion,
  filters,
  setFilter,
  clearFilters,
  categoryLabels,
  regionOptions,
  mountainOptions,
  isLoading,
}) => {
  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.panelTitle}>Search & Filters</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#4B5563" />
        <TextInput
          placeholder="Search common or scientific name"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={onQueryChange}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          autoCapitalize="none"
        />
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          <Text style={styles.sectionLabel}>Quick suggestions</Text>
          <View style={styles.suggestionList}>
            {suggestions.slice(0, 6).map((item) => (
              <Pressable key={item} onPress={() => onSelectSuggestion(item)} style={styles.suggestionPill}>
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipWrap}>
        {categoryLabels.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setFilter('category', option.key)}
            style={[
              styles.chip,
              filters.category === option.key && styles.chipSelected,
            ]}
          >
            <Text style={[styles.chipLabel, filters.category === option.key && styles.chipLabelSelected]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Region</Text>
      <View style={styles.chipWrap}>
        {regionOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setFilter('region', option.key)}
            style={[
              styles.chip,
              filters.region === option.key && styles.chipSelected,
            ]}
          >
            <Text style={[styles.chipLabel, filters.region === option.key && styles.chipLabelSelected]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Mountain focus</Text>
      <View style={styles.chipWrap}>
        {mountainOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setFilter('mountain', option.key)}
            style={[
              styles.chip,
              filters.mountain === option.key && styles.chipSelected,
            ]}
          >
            <Text style={[styles.chipLabel, filters.mountain === option.key && styles.chipLabelSelected]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Advanced</Text>
      <View style={styles.toggleGrid}>
        {[
          { key: 'endemicOnly', label: 'Endemic' },
          { key: 'threatenedOnly', label: 'Threatened' },
          { key: 'nativeOnly', label: 'Native' },
          { key: 'imagesOnly', label: 'With images' },
          { key: 'recentOnly', label: 'Recently observed' },
          { key: 'highConfidenceOnly', label: 'High confidence' },
        ].map((toggle) => (
          <Pressable
            key={toggle.key}
            onPress={() => setFilter(toggle.key as keyof SpeciesSearchFiltersType, !filters[toggle.key as keyof SpeciesSearchFiltersType])}
            style={[styles.toggleBox, filters[toggle.key as keyof SpeciesSearchFiltersType] && styles.toggleBoxActive]}
          >
            <Text style={[styles.toggleLabel, filters[toggle.key as keyof SpeciesSearchFiltersType] && styles.toggleLabelActive]}>{toggle.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={clearFilters} style={styles.clearButton}>
        <Text style={styles.clearButtonText}>Reset filters</Text>
      </Pressable>

      <Pressable onPress={onSearch} style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} disabled={isLoading}>
        <Text style={styles.primaryButtonText}>{isLoading ? 'Searching...' : 'Apply search'}</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#F8FBFF',
    borderRadius: 24,
    padding: 18,
  },
  panelContent: {
    gap: 14,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '700',
    marginBottom: 6,
  },
  suggestionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  suggestionText: {
    color: '#0C4A6E',
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  chipSelected: {
    backgroundColor: '#0F766E',
  },
  chipLabel: {
    color: '#374151',
    fontSize: 12,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toggleBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '48%',
  },
  toggleBoxActive: {
    backgroundColor: '#DDF4FF',
    borderColor: '#38BDF8',
  },
  toggleLabel: {
    color: '#334155',
    fontSize: 12,
  },
  toggleLabelActive: {
    color: '#0C4A6E',
    fontWeight: '700',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
