import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
 Text,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isLandscape = SCREEN_WIDTH >= SCREEN_HEIGHT;

export interface SpeciesCardProps {
  species: any;
  onPress: () => void;
  isDiscovered?: boolean;
  showDiscoveryStatus?: boolean;
}

export const SpeciesCard: React.FC<SpeciesCardProps> = ({
  species,
  onPress,
  isDiscovered = false,
  showDiscoveryStatus = true,
}) => {
  const [imageError, setImageError] = useState(false);

  /**
   * LANDSCAPE-FIRST RESPONSIVE SYSTEM
   * ----------------------------------
   * Ensures cards ALWAYS feel landscape optimized.
   * Prevents:
   * - tall stretched cards
   * - oversized images
   * - overflow
   * - clipped content
   * - cramped text
   */

  const layoutConfig = useMemo(() => {
    if (SCREEN_WIDTH >= 1400) {
      return {
        imageHeight: 182,
        minHeight: 330,
        titleSize: 17,
        descriptionLines: 2,
      };
    }

    if (SCREEN_WIDTH >= 1100) {
      return {
        imageHeight: 172,
        minHeight: 318,
        titleSize: 16,
        descriptionLines: 2,
      };
    }

    if (SCREEN_WIDTH >= 900) {
      return {
        imageHeight: 162,
        minHeight: 306,
        titleSize: 16,
        descriptionLines: 2,
      };
    }

    return {
      imageHeight: isLandscape ? 154 : 190,
      minHeight: isLandscape ? 292 : 360,
      titleSize: 15,
      descriptionLines: 2,
    };
  }, []);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#1E293B' }}
      style={({ pressed }) => [
        styles.card,
        {
          minHeight: layoutConfig.minHeight,
        },
        pressed && styles.cardPressed,
      ]}
    >
      {/* IMAGE SECTION */}
      <View
        style={[
          styles.heroImageContainer,
          {
            height: layoutConfig.imageHeight,
          },
        ]}
      >
        {species.image_url && !imageError ? (
          <Image
            source={{ uri: species.image_url }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons
              name="image-outline"
              size={34}
              color="#64748B"
            />
          </View>
        )}

        {/* TOP OVERLAY */}
        {showDiscoveryStatus && (
          <View
            style={[
              styles.topBadge,
              isDiscovered
                ? styles.topBadgeDiscovered
                : styles.topBadgeLocked,
            ]}
          >
            <Ionicons
              name={
                isDiscovered
                  ? 'checkmark-circle'
                  : 'lock-closed'
              }
              size={11}
              color={
                isDiscovered
                  ? ACCENT_GREEN
                  : '#94A3B8'
              }
            />

            <Text
              style={[
                styles.topBadgeText,
                isDiscovered
                  ? styles.topBadgeTextActive
                  : styles.topBadgeTextLocked,
              ]}
              numberOfLines={1}
            >
              {isDiscovered ? 'Discovered' : 'Locked'}
            </Text>
          </View>
        )}
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text
            style={[
              styles.commonName,
              {
                fontSize: layoutConfig.titleSize,
              },
            ]}
            numberOfLines={1}
          >
            {species.common_name || 'Unknown species'}
          </Text>

          {!!species.scientific_name && (
            <Text
              style={styles.scientificName}
              numberOfLines={1}
            >
              {species.scientific_name}
            </Text>
          )}
        </View>

        <Text
          style={styles.quickNote}
          numberOfLines={layoutConfig.descriptionLines}
        >
          {species.description ||
            ' mountA curatedain biodiversity profile for field exploration.'}
        </Text>

        {/* FOOTER */}
        <View style={styles.footerRow}>
          <View style={styles.viewProfileButton}>
            <Text style={styles.detailLink}>
              View full profile
            </Text>

            <Ionicons
              name="arrow-forward"
              size={12}
              color={ACCENT_GOLD}
            />
          </View>

          {!showDiscoveryStatus && (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  /**
   * CARD
   * -----
   * Compact premium field-guide card.
   * Optimized specifically for
   * landscape carousel layouts.
   */

  card: {
    flex: 1,
    backgroundColor: BG_PANEL,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,

    /**
     * Prevent Android clipping issues
     * while preserving performance.
     */
    ...(Platform.OS === 'android'
      ? {
          elevation: 2,
        }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowRadius: 10,
          shadowOffset: {
            width: 0,
            height: 5,
          },
        }),
  },

  /**
   * PRESS STATE
   */

  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },

  /**
   * IMAGE
   * ------
   * Prevent:
   * - aggressive cropping
   * - stretched images
   * - oversized visuals
   */

  heroImageContainer: {
    width: '100%',
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden',
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  imageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_SUBTLE,
  },

  /**
   * BADGE
   * -------
   * Cleaner premium overlay hierarchy.
   */

  topBadge: {
    position: 'absolute',
    top: 12,
    right: 12,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,
    paddingVertical: 6,

    borderRadius: 999,
    borderWidth: 1,

    maxWidth: '70%',
  },

  topBadgeDiscovered: {
    backgroundColor: 'rgba(20, 83, 45, 0.88)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },

  topBadgeLocked: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },

  topBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 5,
  },

  topBadgeTextActive: {
    color: '#DCFCE7',
  },

  topBadgeTextLocked: {
    color: '#CBD5E1',
  },

  /**
   * CONTENT
   * --------
   * Compact spacing rhythm
   * with better readability.
   */

  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },

  titleSection: {
    marginBottom: 7,
  },

  commonName: {
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },

  scientificName: {
    fontSize: 11.5,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    marginTop: 3,
  },

  quickNote: {
    fontSize: 11.5,
    color: '#CBD5E1',
    lineHeight: 17,
    marginTop: 2,

    /**
     * Prevent layout jumps
     * while staying compact.
     */
    minHeight: isLandscape ? 34 : 42,
  },

  /**
   * FOOTER
   * --------
   * Cleaner compact CTA row.
   */

  footerRow: {
    marginTop: 12,

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailLink: {
    color: ACCENT_GOLD,
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.25,
    marginRight: 6,
  },

  placeholder: {
    width: 1,
    height: 1,
  },
});