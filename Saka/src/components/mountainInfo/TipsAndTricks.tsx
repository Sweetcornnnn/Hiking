import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert, MountainTips } from '../../data/mountainTips';
import ContourMark from './ContourMark';
import MergedTile from './MergedTile';
import AlertsSection from './categories/AlertsSection';
import { getMountainAlertKey } from '../../services/mountainAlertReadService';
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
  unreadAlertKeys: Set<string>;
  onAlertViewed: (alert: Alert) => void;
  onBack?: () => void;
}

/**
 * A fixed, non-scrolling dashboard.
 *  - Header: back button, mountain name, and the small alerts button (red badge = unread).
 *  - Top row: Trail Tips & Navigation and Transportation Guide, sharing one wide card.
 *  - Bottom row: Safety, Preparation & Requirements, Environmental Etiquette.
 * Each tile opens its full guide on tap.
 *
 * The screen is full-bleed: it ignores safe-area insets and pads itself instead.
 */
export default function TipsAndTricks({
  mountainTips,
  unreadAlertKeys,
  onAlertViewed,
  onBack,
}: TipsAndTricksProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  // Rows are sized from the space that is actually free, then capped, so they stay
  // compact instead of stretching to fill the screen. Rows can never overflow.
  const [gridHeight, setGridHeight] = useState(0);
  const ROW_COUNT = 2;
  const maxRowHeight = landscape ? 128 : 156;
  const rowHeight = gridHeight > 0
    ? Math.min(maxRowHeight, (gridHeight - GRID_PAD_BOTTOM - GRID_GAP * (ROW_COUNT - 1)) / ROW_COUNT)
    : maxRowHeight;

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

        <AlertsSection
          alerts={mountainTips.alerts}
          mountain={mountainTips}
          unreadAlertKeys={unreadAlertKeys}
          getAlertKey={getMountainAlertKey}
          onAlertViewed={onAlertViewed}
        />
      </View>

      <View
        style={styles.grid}
        onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
      >
        {/* Top row: two tiles, one card, a line between them */}
        <View style={[styles.row, { height: rowHeight }]}>
          <MergedTile
            left={<TrailTipsSection items={mountainTips.trailTips} guide={mountainTips.trailGuide} bare />}
            right={
              <TransportationSection
                items={mountainTips.transportation}
                guide={mountainTips.transportGuide}
                bare
              />
            }
          />
        </View>

        {/* Bottom row: three separate cards */}
        <View style={[styles.row, { height: rowHeight }]}>
          <View style={styles.cell}>
            <SafetySection items={mountainTips.safety} guide={mountainTips.safetyGuide} />
          </View>
          <View style={styles.cell}>
            <PreparationSection items={mountainTips.preparation} guide={mountainTips.preparationGuide} />
          </View>
          <View style={styles.cell}>
            <EtiquetteSection items={mountainTips.etiquette} guide={mountainTips.etiquetteGuide} />
          </View>
        </View>
      </View>
    </View>
  );
}

const GRID_GAP = 10;
const GRID_PAD_BOTTOM = 16;

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
    justifyContent: 'center',
    gap: GRID_GAP,
    paddingHorizontal: 20,
    paddingBottom: GRID_PAD_BOTTOM,
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});