import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WildTrackStats } from '../../store/wildtrackStore';

import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  ACCENT_GREEN,
  RADIUS_CARD,
} from '../../theme/designTokens';

interface ProgressCardProps {
  stats: WildTrackStats | null;
  mountainName?: string;
  onExplorePress?: () => void;
  onDiscoveriesPress?: () => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  stats,
  mountainName = 'Mt. Madjaas',
  onExplorePress,
  onDiscoveriesPress,
}) => {
  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf-outline" size={30} color={ACCENT_GOLD} />
          </View>

          <Text style={styles.emptyTitle}>Start Your WildTrack Journey</Text>

          <Text style={styles.emptySubtitle}>
            Discover plants, birds, and wildlife while hiking and track species across
            mountains.
          </Text>

          {onExplorePress && (
            <TouchableOpacity onPress={onExplorePress} style={styles.exploreButton}>
              <Ionicons name="compass-outline" size={17} color="#FFF" />
              <Text style={styles.exploreButtonText}>Explore Species</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const percentage = stats.percentage;
  const progressWidth = `${Math.max(0, Math.min(percentage, 100))}%` as any;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              Your Discoveries
            </Text>

            {onDiscoveriesPress && (
              <TouchableOpacity
                onPress={onDiscoveriesPress}
                style={styles.discoveriesIconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="arrow-forward" size={14} color={ACCENT_GOLD} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {mountainName}
          </Text>
        </View>

        <View style={styles.percentageBadge}>
          <Text style={styles.percentageText}>{percentage}%</Text>
        </View>
      </View>

      {/* PROGRESS */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{stats.discovered_count} discovered</Text>
          <Text style={styles.progressLabel}>of {stats.total_species} species</Text>
        </View>
      </View>

      {/* CATEGORY STATS */}
      {stats.by_category && stats.by_category.length > 0 && (
        <View style={styles.categoryStats}>
          {stats.by_category.slice(0, 4).map((cat, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryDot} />
              <Text style={styles.categoryText} numberOfLines={1}>
                {cat.category}: {cat.count}
              </Text>
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
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    padding: 15,

    ...(Platform.OS === 'android'
      ? { elevation: 2 }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
        }),
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 300,
    marginBottom: 18,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_GREEN,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
  },
  exploreButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerText: { flex: 1, paddingRight: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: 0.2 },
  discoveriesIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { fontSize: 11, color: ACCENT_GOLD, marginTop: 3 },
  percentageBadge: {
    minWidth: 68,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  percentageText: { color: ACCENT_GREEN, fontWeight: '800', fontSize: 17 },

  progressContainer: { marginBottom: 14 },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: BG_SUBTLE,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: ACCENT_GREEN },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: '600' },

  categoryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_SUBTLE,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    maxWidth: '48%',
  },
  categoryDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: ACCENT_GOLD, marginRight: 7 },
  categoryText: { fontSize: 10, color: TEXT_PRIMARY, fontWeight: '500' },
});