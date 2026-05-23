import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WildTrackStats } from '../../store/wildtrackStore';

interface ProgressCardProps {
  stats: WildTrackStats | null;
  mountainName?: string;
  onExplorePress?: () => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  stats,
  mountainName = 'Mt. Madjaas',
  onExplorePress,
}) => {
  if (!stats) {
    // Empty state
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf-outline" size={40} color="#8B7355" />
          </View>
          <Text style={styles.emptyTitle}>Start Your WildTrack Journey</Text>
          <Text style={styles.emptySubtitle}>
            Discover plants, birds, and wildlife while hiking.{'\n'}
            Track species you encounter across mountains.
          </Text>
          {onExplorePress && (
            <TouchableOpacity onPress={onExplorePress} style={styles.exploreButton}>
              <Ionicons name="compass-outline" size={20} color="#FFF" />
              <Text style={styles.exploreButtonText}>Explore Species</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const percentage = stats.percentage;
  const progressWidth = percentage;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Discoveries</Text>
          <Text style={styles.subtitle}>{mountainName}</Text>
        </View>
        <View style={styles.percentageBadge}>
          <Text style={styles.percentageText}>{percentage}%</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{stats.discovered_count} discovered</Text>
          <Text style={styles.progressLabel}>of {stats.total_species} species</Text>
        </View>
      </View>

      {/* Category Stats */}
      {stats.by_category && stats.by_category.length > 0 && (
        <View style={styles.categoryStats}>
          {stats.by_category.slice(0, 4).map((cat, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryDot} />
              <Text style={styles.categoryText}>{cat.category}: {cat.count}</Text>
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
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    backgroundColor: '#F5E6D3',
    padding: 16,
    borderRadius: 999,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C3E50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
  },
  exploreButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 13,
    color: '#8B7355',
    marginTop: 2,
  },
  percentageBadge: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  percentageText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#F5E6D3',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2C3E50',
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5E6D3',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4A574',
  },
  categoryText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});
