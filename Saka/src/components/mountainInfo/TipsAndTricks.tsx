import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MountainTips } from '../../data/mountainTips';
import PreparationSection from './categories/PreparationSection';
import SafetySection from './categories/SafetySection';
import TransportationSection from './categories/TransportationSection';
import TrailTipsSection from './categories/TrailTipsSection';
import EtiquetteSection from './categories/EtiquetteSection';
import AlertsSection from './categories/AlertsSection';
import {
  ACCENT_GOLD,
  BG_CARD,
  BORDER_DEFAULT,
  FONT,
  RADIUS_BTN,
  SPACING,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

export interface TipsAndTricksProps {
  mountainTips: MountainTips;
  onBack?: () => void;
}

export default function TipsAndTricks({ mountainTips, onBack }: TipsAndTricksProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Close tips and tricks"
          >
            <Ionicons name="close" size={22} color={ACCENT_GOLD} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.mountainName} numberOfLines={2}>{mountainTips.mountainName}</Text>
          <Text style={styles.subtitle}>Information, Tips & Tricks</Text>
          <View style={styles.goldLine} />
        </View>
      </View>

      <View style={styles.categoryGrid}>
        <SafetySection items={mountainTips.safety} />
        <TransportationSection items={mountainTips.transportation} />
        <PreparationSection items={mountainTips.preparation} />
        <TrailTipsSection items={mountainTips.trailTips} />
        <EtiquetteSection items={mountainTips.etiquette} />
        <AlertsSection alerts={mountainTips.alerts} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_CARD,
  },
  header: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.gapLg,
    paddingVertical: SPACING.gapLg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginRight: SPACING.gapLg,
  },
  headerText: {
    flex: 1,
  },
  mountainName: {
    color: TEXT_PRIMARY,
    fontSize: FONT.nameSize,
    fontWeight: '700',
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    marginTop: SPACING.gap / 2,
  },
  goldLine: {
    height: 3,
    width: 40,
    backgroundColor: ACCENT_GOLD,
    marginTop: SPACING.gap,
    borderRadius: 2,
  },
  categoryGrid: {
    flex: 1,
    paddingHorizontal: SPACING.gapLg,
    paddingTop: SPACING.gapLg,
    paddingBottom: SPACING.cardPadB,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'flex-start',
  },
});