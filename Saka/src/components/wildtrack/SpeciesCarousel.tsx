import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Species } from '../../store/wildtrackStore';
import { SpeciesCard } from './SpeciesCard';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  ACCENT_GOLD,
} from '../../theme/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isLandscape = SCREEN_WIDTH >= SCREEN_HEIGHT;

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

  /**
   * LANDSCAPE-OPTIMIZED CARD SIZING
   * --------------------------------
   * Compact but breathable sizing:
   * - prevents oversized cards
   * - avoids clipped layouts
   * - keeps surrounding UI visible
   * - preserves landscape balance
   */
  const cardWidth = useMemo(() => {
    if (SCREEN_WIDTH >= 1300) return 360;
    if (SCREEN_WIDTH >= 1100) return 340;
    if (SCREEN_WIDTH >= 900) return 315;
    if (SCREEN_WIDTH >= 760) return 295;

    return Math.min(280, SCREEN_WIDTH * 0.72);
  }, []);

  const sideInset = useMemo(() => {
    if (SCREEN_WIDTH >= 1200) return 8;
    if (SCREEN_WIDTH >= 900) return 4;
    return 2;
  }, []);

  const itemSpacing = 14;
  const snapInterval = cardWidth + itemSpacing;

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const contentOffset = event.nativeEvent.contentOffset.x;

    const index = Math.round(contentOffset / snapInterval);

    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  if (!species || species.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.carouselShell}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled={false}
          nestedScrollEnabled
          bounces={false}
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          overScrollMode="never"
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingLeft: sideInset,
              paddingRight: sideInset + 4,
            },
          ]}
        >
          {species.map((speciesItem) => (
            <View
              key={speciesItem.id}
              style={[
                styles.cardWrapper,
                {
                  width: cardWidth,
                  marginRight: itemSpacing,
                },
              ]}
            >
              <SpeciesCard
                species={speciesItem}
                onPress={() => onSpeciesPress(speciesItem)}
                isDiscovered={discoveredSpecies.has(speciesItem.id)}
                showDiscoveryStatus={true}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Pagination */}
      {species.length > 1 && (
        <View style={styles.paginationContainer}>
          <View style={styles.pagination}>
            {species.map((_, index) => {
              const isActive = index === activeIndex;

              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isActive ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
    marginBottom: 4,
  },

  /**
   * OUTER SHELL
   * ------------
   * Keeps carousel visually balanced
   * inside landscape layouts.
   */
  carouselShell: {
    backgroundColor: BG_PANEL,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    paddingVertical: isLandscape ? 14 : 16,
  },

  /**
   * SCROLL CONTENT
   * ----------------
   * Compact spacing rhythm
   * while maintaining readability.
   */
  scrollContent: {
    alignItems: 'stretch',
  },

  /**
   * CARD WRAPPER
   * --------------
   * Prevents:
   * - stretching
   * - overflow
   * - awkward card scaling
   * - landscape clipping
   */
  cardWrapper: {
    justifyContent: 'center',
    alignItems: 'stretch',
    minHeight: isLandscape ? 250 : 300,
  },

  /**
   * PAGINATION
   * ------------
   * Cleaner + more premium
   * compact indicators.
   */
  paginationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    gap: 8,
  },

  dot: {
    height: 7,
    borderRadius: 999,
  },

  dotActive: {
    width: 24,
    backgroundColor: ACCENT_GOLD,
  },

  dotInactive: {
    width: 7,
    backgroundColor: '#6E6E6E',
  },
});