import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MountainTips } from '../../data/mountainTips';
import ContourMark from './ContourMark';
import AlertsSection from './categories/AlertsSection';
import SafetySection from './categories/SafetySection';
import PreparationSection from './categories/PreparationSection';
import TransportationSection from './categories/TransportationSection';
import TrailTipsSection from './categories/TrailTipsSection';
import EtiquetteSection from './categories/EtiquetteSection';
import {
  ACCENT_GOLD,
  BG_CARD,
  BORDER_DEFAULT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

export interface TipsAndTricksProps {
  mountainTips: MountainTips;
  onBack?: () => void;
}

/**
 * A fixed, non-scrolling dashboard. Six tiles fill the screen: three across
 * in landscape, two across in portrait. Each tile opens its full list on tap.
 *
 * The screen is full-bleed: it ignores safe-area insets and pads itself instead.
 */
export default function TipsAndTricks({ mountainTips, onBack }: TipsAndTricksProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const columns = landscape ? 3 : 2;

  const tiles = [
    <AlertsSection key="alerts" alerts={mountainTips.alerts} />,
    <SafetySection key="safety" items={mountainTips.safety} />,
    <PreparationSection key="preparation" items={mountainTips.preparation} />,
    <TransportationSection key="transportation" items={mountainTips.transportation} />,
    <TrailTipsSection key="trailTips" items={mountainTips.trailTips} />,
    <EtiquetteSection key="etiquette" items={mountainTips.etiquette} />,
  ];

  const rows: React.ReactElement[][] = [];
  for (let i = 0; i < tiles.length; i += columns) {
    rows.push(tiles.slice(i, i + columns));
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, landscape && styles.headerLandscape]}>
        <ContourMark size={landscape ? 150 : 170} summit fade={0.85} style={styles.headerContour} />

        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close tips and tricks"
          >
            <Ionicons name="chevron-back" size={22} color={ACCENT_GOLD} />
          </Pressable>
        ) : null}

        <View style={styles.headerText}>
          <Text style={styles.mountainName} numberOfLines={1} accessibilityRole="header">
            {mountainTips.mountainName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>Tap a tile for the full guide</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((tile, i) => (
              <View key={tile.key ?? i} style={styles.cell}>
                {tile}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-bleed on purpose: no safe-area insets, so the layout runs behind the camera
  // cutout and rounded corners. Spacing comes from the fixed padding below.
  screen: {
    flex: 1,
    backgroundColor: BG_CARD,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerLandscape: {
    paddingBottom: 8,
  },
  headerContour: {
    position: 'absolute',
    right: -30,
    top: -34,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  headerText: {
    flex: 1,
  },
  mountainName: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  grid: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});