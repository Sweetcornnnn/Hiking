import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../data/mountainTips';
import { FONT, RADIUS_BTN, SPACING, TEXT_MUTED } from '../../theme/designTokens';

export interface AlertCardProps {
  alert: Alert;
}

const ALERT_STYLES = {
  danger: {
    color: '#D32F2F',
    background: '#FDECEC',
    icon: 'alert-circle' as const,
  },
  warning: {
    color: '#FF9800',
    background: '#FFF4E5',
    icon: 'warning' as const,
  },
  info: {
    color: '#2196F3',
    background: '#EAF4FE',
    icon: 'information-circle' as const,
  },
};

export default function AlertCard({ alert }: AlertCardProps) {
  const appearance = ALERT_STYLES[alert.type];

  return (
    <View
      style={[styles.card, { backgroundColor: appearance.background, borderLeftColor: appearance.color }]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={appearance.icon}
        size={22}
        color={appearance.color}
        style={styles.icon}
      />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: appearance.color }]}>{alert.title}</Text>
          {alert.date ? <Text style={styles.date}>{alert.date}</Text> : null}
        </View>
        <Text style={styles.message}>{alert.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderRadius: RADIUS_BTN,
    padding: SPACING.gapLg,
    marginTop: SPACING.gap,
  },
  icon: {
    marginRight: SPACING.gapLg,
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: SPACING.gap / 2,
  },
  title: {
    flexShrink: 1,
    fontSize: FONT.itemSize,
    fontWeight: '700',
    marginRight: 8,
  },
  date: {
    color: TEXT_MUTED,
    fontSize: FONT.tagSize,
  },
  message: {
    color: '#273326',
    fontSize: FONT.itemSize,
    lineHeight: 18,
  },
});