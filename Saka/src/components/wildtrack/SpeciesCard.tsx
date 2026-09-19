import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
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
} from '../../theme/designTokens';

export interface SpeciesCardProps {
  species: any;
  onPress: () => void;
  isDiscovered?: boolean;
  showDiscoveryStatus?: boolean;
}

/**
 * IMAGE FIX
 * ----------
 * Photos come from an external API in unpredictable sizes/aspect ratios.
 * Instead of a fixed pixel height + resizeMode="contain" (which letterboxes
 * anything that doesn't match the box exactly), the image container uses a
 * fixed `aspectRatio` and resizeMode="cover". That means:
 *  - every card has the exact same frame, so grids line up cleanly
 *  - every photo fills that frame completely, no empty bars
 *  - a loading spinner covers the swap-in, and a leaf icon covers failures
 */
export const SpeciesCard: React.FC<SpeciesCardProps> = ({
  species,
  onPress,
  isDiscovered = false,
  showDiscoveryStatus = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const hasImage = !!species?.image_url && !imageError;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#1E293B' }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* IMAGE */}
      <View style={styles.imageContainer}>
        {hasImage ? (
          <>
            <Image
              source={{ uri: species.image_url }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />

            {imageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color={ACCENT_GOLD} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="leaf-outline" size={28} color="#64748B" />
          </View>
        )}

        {showDiscoveryStatus && isDiscovered && (
          <View style={styles.topBadge}>
            <Ionicons name="checkmark-circle" size={11} color={ACCENT_GREEN} />
            <Text style={styles.topBadgeText} numberOfLines={1}>
              Discovered
            </Text>
          </View>
        )}
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.commonName} numberOfLines={1}>
          {species?.common_name || 'Unknown species'}
        </Text>

        {!!species?.scientific_name && (
          <Text style={styles.scientificName} numberOfLines={1}>
            {species.scientific_name}
          </Text>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.detailLink}>View profile</Text>
          <Ionicons name="arrow-forward" size={12} color={ACCENT_GOLD} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 148,
    backgroundColor: BG_PANEL,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },

  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },

  // Fixed aspect ratio (not a fixed height) — every photo, whatever size it
  // arrives at from the API, fills this exact frame with resizeMode="cover".
  imageContainer: {
    width: '100%',
    aspectRatio: 1.55,
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imageLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },

  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },

  topBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 83, 45, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    maxWidth: '70%',
  },

  topBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DCFCE7',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  content: {
    padding: 8,
    gap: 1,
  },

  commonName: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.05,
  },

  scientificName: {
    fontSize: 8.5,
    color: TEXT_MUTED,
    fontStyle: 'italic',
  },

  footerRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  detailLink: {
    color: ACCENT_GOLD,
    fontWeight: '600',
    fontSize: 8.5,
  },
});