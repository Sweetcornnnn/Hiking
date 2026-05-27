import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SpeciesCardProps {
  species: any;
  onPress: () => void;
  isDiscovered?: boolean;
  showDiscoveryStatus?: boolean;
}

export const SpeciesCard: React.FC<SpeciesCardProps> = ({ species, onPress, isDiscovered = false, showDiscoveryStatus = true }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <Pressable onPress={onPress} style={styles.card} android_ripple={{ color: '#E2E8F0' }}>
      <View style={styles.heroImageContainer}>
        {species.image_url && !imageError ? (
          <Image source={{ uri: species.image_url }} style={styles.heroImage} resizeMode="cover" onError={() => setImageError(true)} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={42} color="#94A3B8" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.commonName} numberOfLines={1}>{species.common_name || 'Unknown species'}</Text>
        <Text style={styles.scientificName} numberOfLines={1}>{species.scientific_name}</Text>
        <Text style={styles.quickNote} numberOfLines={2}>{species.description || 'A mountain explorer profile.'}</Text>

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
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  heroImageContainer: { height: 200, backgroundColor: '#E2E8F0' },
  heroImage: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  commonName: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  scientificName: { fontSize: 13, color: '#475569', fontStyle: 'italic' },
  quickNote: { fontSize: 13, color: '#475569', marginTop: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  detailLink: { color: '#0F766E', fontWeight: '700', fontSize: 12 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  statusTagActive: { backgroundColor: '#DCFCE7' },
  statusTagHidden: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextActive: { color: '#166534' },
  statusTextHidden: { color: '#475569' },
});
