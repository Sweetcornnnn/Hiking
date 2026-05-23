import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SpeciesCardProps {
  species: {
    id: string | number;
    scientific_name: string;
    common_name?: string;
    category?: string;
    image_url?: string;
    description?: string;
    habitat?: string;
    conservation_status?: string;
    is_endemic?: boolean;
    is_native?: boolean;
    gbif_id?: number;
    inaturalist_id?: number;
    occurrence_count?: number;
    last_observed?: string;
    discovered?: boolean;
    taxonomy?: {
      kingdom?: string;
      phylum?: string;
      class?: string;
      order?: string;
      family?: string;
      genus?: string;
      species?: string;
    };
  };
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

  const statusColor = (status?: string) => {
    if (!status) return '#64748B';
    const lower = status.toLowerCase();
    if (lower.includes('critically endangered')) return '#DC2626';
    if (lower.includes('endangered')) return '#F97316';
    if (lower.includes('vulnerable')) return '#FBBF24';
    if (lower.includes('near threatened')) return '#EAB308';
    if (lower.includes('least concern')) return '#16A34A';
    return '#64748B';
  };

  const iconName = (category?: string) => {
    if (!category) return 'leaf-outline';
    const normalized = category.toLowerCase();
    if (normalized.includes('bird')) return 'leaf-outline';
    if (normalized.includes('mammal')) return 'paw-outline';
    if (normalized.includes('reptile')) return 'alert-circle-outline';
    if (normalized.includes('insect')) return 'bug-outline';
    if (normalized.includes('fern') || normalized.includes('tree') || normalized.includes('orchid') || normalized.includes('flora')) return 'leaf-outline';
    if (normalized.includes('amphibian')) return 'water-outline';
    return 'earth-outline';
  };

  const handleImageError = () => setImageError(true);

  return (
    <Pressable onPress={onPress} style={styles.card} android_ripple={{ color: '#E2E8F0' }}>
      <View style={styles.heroImageContainer}>
        {species.image_url && !imageError ? (
          <Image source={{ uri: species.image_url }} style={styles.heroImage} resizeMode="cover" onError={handleImageError} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={42} color="#94A3B8" />
          </View>
        )}
        <View style={styles.heroBadgeRow}>
          {species.is_endemic && (
            <View style={styles.badgePrimary}>
              <Ionicons name="star" size={12} color="#FFF" />
              <Text style={styles.badgeText}>Endemic</Text>
            </View>
          )}
          <View style={[styles.badgeSecondary, { backgroundColor: statusColor(species.conservation_status) }]}> 
            <Text style={styles.badgeText} numberOfLines={1}>{species.conservation_status || 'Data deficient'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.commonName} numberOfLines={1}>{species.common_name || 'Unknown species'}</Text>
            <Text style={styles.scientificName} numberOfLines={1}>{species.scientific_name}</Text>
          </View>
          <View style={styles.iconPill}>
            <Ionicons name={iconName(species.category)} size={14} color="#0F766E" />
            <Text style={styles.iconPillText}>{species.category || 'Wildlife'}</Text>
          </View>
        </View>

        <Text style={styles.quickNote} numberOfLines={2}>{species.description || 'A mountain explorer profile sourced from GBIF and iNaturalist.'}</Text>

        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{species.occurrence_count ?? '–'}</Text>
            <Text style={styles.statLabel}>Records</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{species.last_observed ? new Date(species.last_observed).toLocaleDateString() : 'Unknown'}</Text>
            <Text style={styles.statLabel}>Last seen</Text>
          </View>
        </View>

        <View style={styles.miniRow}>
          {species.habitat ? (
            <View style={styles.miniBadge}>
              <Ionicons name="location-outline" size={12} color="#0F766E" />
              <Text style={styles.miniText}>{species.habitat}</Text>
            </View>
          ) : null}
          <View style={styles.miniBadge}>
            <Ionicons name={species.is_native === false ? 'earth-outline' : 'leaf-outline'} size={12} color="#0F766E" />
            <Text style={styles.miniText}>{species.is_native === false ? 'Introduced' : 'Native'}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.detailLink}>View full profile</Text>
          {showDiscoveryStatus && (
            <View style={[styles.statusTag, isDiscovered ? styles.statusTagActive : styles.statusTagHidden]}>
              <Ionicons name={isDiscovered ? 'checkmark-circle' : 'lock-closed'} size={12} color={isDiscovered ? '#16A34A' : '#64748B'} />
              <Text style={[styles.statusText, isDiscovered ? styles.statusTextActive : styles.statusTextHidden]}>{isDiscovered ? 'Discovered' : 'Locked'}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroImageContainer: {
    height: 200,
    backgroundColor: '#E2E8F0',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  heroBadgeRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 6,
  },
  badgeSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  titleGroup: {
    flex: 1,
  },
  commonName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  scientificName: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  iconPillText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
  },
  quickNote: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 14,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    marginRight: 10,
    borderRadius: 18,
    padding: 14,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F766E',
  },
  statLabel: {
    marginTop: 6,
    color: '#475569',
    fontSize: 11,
  },
  miniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  miniText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLink: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 12,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusTagActive: {
    backgroundColor: '#DCFCE7',
  },
  statusTagHidden: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextHidden: {
    color: '#475569',
  },
});
