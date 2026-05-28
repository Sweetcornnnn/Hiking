import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
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
  RADIUS_BTN,
} from '../../theme/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isLandscape = SCREEN_WIDTH >= SCREEN_HEIGHT;

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
  /**
   * LANDSCAPE-FIRST COMPACT SYSTEM
   * --------------------------------
   * Prevents:
   * - oversized progress sections
   * - excessive vertical height
   * - cramped category layouts
   * - uneven spacing rhythm
   */

  const layoutConfig = useMemo(() => {
    if (SCREEN_WIDTH >= 1400) {
      return {
        titleSize: 13,
        percentageSize: 16,
        padding: 18,
      };
    }

    if (SCREEN_WIDTH >= 1000) {
      return {
        titleSize: 13,
        percentageSize: 16,
        padding: 16,
      };
    }

    return {
      titleSize: 13,
      percentageSize: 16,
      padding: 15,
    };
  }, []);

  /**
   * EMPTY STATE
   */

  if (!stats) {
    return (
      <View
        style={[
          styles.container,
          {
            padding: layoutConfig.padding,
          },
        ]}
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="leaf-outline"
              size={32}
              color={ACCENT_GOLD}
            />
          </View>

          <Text style={styles.emptyTitle}>
            Start Your WildTrack Journey
          </Text>

          <Text style={styles.emptySubtitle}>
            Discover plants, birds, and wildlife
            while hiking and track species across
            mountains.
          </Text>

          {onExplorePress && (
            <TouchableOpacity
              onPress={onExplorePress}
              style={styles.exploreButton}
            >
              <Ionicons
                name="compass-outline"
                size={18}
                color="#FFF"
              />

              <Text style={styles.exploreButtonText}>
                Explore Species
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const percentage = stats.percentage;
  const progressWidth = Math.max(0, Math.min(percentage, 100)) as any;

  return (
    <View
      style={[
        styles.container,
        {
          padding: layoutConfig.padding,
        },
      ]}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            style={[
              styles.title,
              {
                fontSize: layoutConfig.titleSize,
              },
            ]}
            numberOfLines={1}
          >
            Your Discoveries
          </Text>

          <Text
            style={styles.subtitle}
            numberOfLines={1}
          >
            {mountainName}
          </Text>
        </View>

        <View style={styles.percentageBadge}>
          <Text
            style={[
              styles.percentageText,
              {
                fontSize: layoutConfig.percentageSize,
              },
            ]}
          >
            {percentage}%
          </Text>
        </View>
      </View>

      {/* PROGRESS */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>

        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>
            {stats.discovered_count} discovered
          </Text>

          <Text style={styles.progressLabel}>
            of {stats.total_species} species
          </Text>
        </View>
      </View>

      {/* CATEGORY STATS */}
      {stats.by_category &&
        stats.by_category.length > 0 && (
          <View style={styles.categoryStats}>
            {stats.by_category
              .slice(0, 4)
              .map((cat, index) => (
                <View
                  key={index}
                  style={styles.categoryItem}
                >
                  <View style={styles.categoryDot} />

                  <Text
                    style={styles.categoryText}
                    numberOfLines={1}
                  >
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
  /**
   * CARD
   * ------
   * Compact premium side-panel card.
   * Optimized for landscape layouts.
   */

  container: {
    backgroundColor: BG_PANEL,
    borderRadius: RADIUS_CARD,

    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    overflow: 'hidden',

    ...(Platform.OS === 'android'
      ? {
          elevation: 2,
        }
      : {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.12,
          shadowRadius: 10,
        }),
  },

  /**
   * EMPTY STATE
   */

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: isLandscape ? 14 : 20,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: BG_SUBTLE,

    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,

    textAlign: 'center',
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 10,
    color: TEXT_MUTED,

    textAlign: 'center',
    lineHeight: 14,

    maxWidth: 320,
    marginBottom: 18,
  },

  /**
   * BUTTON
   */

  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: ACCENT_GREEN,

    paddingHorizontal: 18,
    paddingVertical: 12,

    borderRadius: 999,
  },

  exploreButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },

  /**
   * HEADER
   * --------
   * Better compact hierarchy.
   */

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 14,
  },

  headerText: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: 10,
    color: ACCENT_GOLD,
    marginTop: 3,
  },

  percentageBadge: {
    minWidth: 74,
    height: 44,

    borderRadius: 14,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: BG_SUBTLE,

    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  percentageText: {
    color: ACCENT_GREEN,
    fontWeight: '800',
  },

  /**
   * PROGRESS
   * ----------
   * Cleaner compact visual rhythm.
   */

  progressContainer: {
    marginBottom: 14,
  },

  progressBar: {
    height: 10,
    borderRadius: 999,

    backgroundColor: BG_SUBTLE,

    overflow: 'hidden',

    marginBottom: 8,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,

    backgroundColor: ACCENT_GREEN,
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontWeight: '600',
  },

  /**
   * CATEGORY SECTION
   * ------------------
   * Compact + breathable landscape chips.
   */

  categoryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: 10,

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

  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 999,

    backgroundColor: ACCENT_GOLD,

    marginRight: 7,
  },

  categoryText: {
    fontSize: 10,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
});