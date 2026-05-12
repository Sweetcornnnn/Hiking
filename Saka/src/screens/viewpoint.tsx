import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ViewpointScreen() {
  const router = useRouter();
  const { viewpointId, mountainId, viewpointName } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{viewpointName}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Image Placeholder */}
        <View style={styles.heroContainer}>
          <View style={styles.heroImage}>
            <Ionicons name="images-outline" size={80} color="#8B7355" />
            <Text style={styles.heroText}>360° Panoramic View</Text>
          </View>
          
          {/* Gradient Overlay */}
          <View style={styles.gradientOverlay} />
          
          {/* Floating Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Ionicons name="eye-outline" size={16} color="#FFF" />
              <Text style={styles.statText}>Amazing View</Text>
            </View>
          </View>
        </View>

        {/* Content Card */}
        <View style={styles.contentCard}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.viewpointName}>{viewpointName}</Text>
              <Text style={styles.subtitle}>Scenic Viewpoint</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.9</Text>
            </View>
          </View>

          {/* Info Tags */}
          <View style={styles.tagsContainer}>
            <View style={styles.tag}>
              <Ionicons name="camera-outline" size={14} color="#8B7355" />
              <Text style={styles.tagText}>Photo Spot</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="sunny-outline" size={14} color="#8B7355" />
              <Text style={styles.tagText}>Best at Sunrise</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="time-outline" size={14} color="#8B7355" />
              <Text style={styles.tagText}>30 min stop</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>About this Viewpoint</Text>
          <Text style={styles.description}>
            Experience breathtaking panoramic views from {viewpointName}. This stunning 
            location offers hikers a perfect spot to rest, take photos, and appreciate 
            the natural beauty of the surrounding landscape. The viewpoint is accessible 
            via well-marked trails and provides an excellent vantage point for sunrise 
            photography and wildlife observation.
          </Text>

          {/* Features List */}
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresList}>
            {[
              { icon: 'checkmark-circle-outline', text: 'Safe viewing platform' },
              { icon: 'checkmark-circle-outline', text: 'Rest area with benches' },
              { icon: 'checkmark-circle-outline', text: 'Trail markers nearby' },
              { icon: 'warning-outline', text: 'Steep drop-off - stay cautious' },
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons 
                  name={feature.icon as any} 
                  size={18} 
                  color={feature.icon === 'warning-outline' ? '#E74C3C' : '#27AE60'} 
                />
                <Text style={[styles.featureText, feature.icon === 'warning-outline' && styles.warningText]}>
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              onPress={() => router.push('./calendar')}
              style={styles.primaryButton}
            >
              <Ionicons name="calendar-outline" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>Schedule Hike</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.secondaryButton}
            >
              <Ionicons name="map-outline" size={20} color="#2C3E50" />
              <Text style={styles.secondaryButtonText}>Back to Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(139,115,85,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 320,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D4A574',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8B7355',
    fontWeight: '600',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  statsContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(44,62,80,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contentCard: {
    marginTop: -30,
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 30,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  viewpointName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 14,
    color: '#8B7355',
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,115,85,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#8B7355',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  featuresList: {
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#2C3E50',
  },
  warningText: {
    color: '#E74C3C',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5E6D3',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#2C3E50',
    fontSize: 15,
    fontWeight: '600',
  },
});
