import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Species } from '../../store/wildtrackStore';
import { SpeciesCard } from './SpeciesCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SpeciesCarouselProps {
  species: Species[];
  onSpeciesPress: (species: Species) => void;
  discoveredSpecies?: Set<number>;
}

export const SpeciesCarousel: React.FC<SpeciesCarouselProps> = ({
  species,
  onSpeciesPress,
  discoveredSpecies = new Set(),
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = Math.min(320, SCREEN_WIDTH * 0.78);

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (cardWidth + 16));
    setActiveIndex(index);
  };

  if (species.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {species.map((speciesItem, index) => (
          <View key={speciesItem.id} style={[styles.cardWrapper, { width: cardWidth }]}>
            <SpeciesCard
              species={speciesItem}
              onPress={() => onSpeciesPress(speciesItem)}
              isDiscovered={discoveredSpecies.has(speciesItem.id)}
              showDiscoveryStatus={true}
            />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {species.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  cardWrapper: {
    width: SCREEN_WIDTH - 64,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#2C3E50',
    width: 24,
  },
  dotInactive: {
    backgroundColor: '#D4A574',
  },
});
