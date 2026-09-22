import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Species } from '../../store/wildtrackStore';
import { SpeciesCard } from './SpeciesCard';
import { BG_SUBTLE, BORDER_DEFAULT, ACCENT_GOLD } from '../../theme/designTokens';

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
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const itemSpacing = 12;
  // One card fully visible with a peek of the next — a familiar phone
  // carousel pattern instead of a fixed desktop card width.
  const cardWidth = Math.min(230, width * 0.6);
  const snapInterval = cardWidth + itemSpacing;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    if (index !== activeIndex) setActiveIndex(index);
  };

  if (!species || species.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {species.map((item) => (
          <View
            key={item.id}
            style={{ width: cardWidth, marginRight: itemSpacing }}
          >
            <SpeciesCard
              species={item}
              onPress={() => onSpeciesPress(item)}
              isDiscovered={discoveredSpecies.has(item.id)}
              showDiscoveryStatus
            />
          </View>
        ))}
      </ScrollView>

      {species.length > 1 && (
        <View style={styles.paginationContainer}>
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 2,
  },
  paginationContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  dotActive: {
    width: 18,
    backgroundColor: ACCENT_GOLD,
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#6E6E6E',
  },
});