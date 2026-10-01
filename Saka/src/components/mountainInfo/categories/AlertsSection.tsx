import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../../data/mountainTips';
import AlertCard from '../AlertCard';
import {
  ACCENT_GOLD,
  BG_DANGER_SUBTLE,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  FONT,
  RADIUS_CARD,
  RADIUS_BTN,
  SPACING,
  TEXT_DANGER,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

export interface AlertsSectionProps {
  alerts: Alert[];
}

export default function AlertsSection({ alerts }: AlertsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Events & Alerts, ${expanded ? 'collapse' : 'expand'}`}
        activeOpacity={0.75}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={21} color={ACCENT_GOLD} />
        </View>
        <Text style={styles.title}>Events & Alerts</Text>
        {alerts.length > 0 ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{alerts.length}</Text>
          </View>
        ) : null}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={TEXT_MUTED}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.content}>
          {alerts.length > 0 ? alerts.map((alert, index) => (
            <AlertCard key={`${alert.type}-${alert.title}-${index}`} alert={alert} />
          )) : (
            <Text style={styles.emptyText}>There are no current alerts for this mountain.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG_PANEL,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    marginBottom: SPACING.gapLg,
    overflow: 'hidden',
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.cardPadH,
    paddingVertical: SPACING.gapLg,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS_BTN,
    backgroundColor: BG_SUBTLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.gapLg,
  },
  title: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: FONT.itemSize,
    fontWeight: FONT.itemWeight,
  },
  count: {
    minWidth: 24,
    height: 24,
    borderRadius: RADIUS_BTN,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_DANGER_SUBTLE,
    marginRight: SPACING.gap,
  },
  countText: {
    color: TEXT_DANGER,
    fontSize: FONT.itemSize,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: 2,
    paddingBottom: SPACING.cardPadB,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 20,
    paddingTop: 14,
  },
});