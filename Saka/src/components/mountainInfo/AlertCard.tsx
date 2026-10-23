import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../data/mountainTips';
import {
  ACCENT_GOLD,
  BG_DANGER_SUBTLE,
  BG_GOLD_TINT,
  BG_SUBTLE,
  SPACING,
  TEXT_DANGER,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

export interface AlertCardProps {
  alert: Alert;
}

const ALERT_STYLES = {
  danger: {
    color: TEXT_DANGER,
    background: BG_DANGER_SUBTLE,
    icon: 'alert-circle' as const,
  },
  warning: {
    color: ACCENT_GOLD,
    background: BG_GOLD_TINT,
    icon: 'warning' as const,
  },
  info: {
    color: TEXT_MUTED,
    background: BG_SUBTLE,
    icon: 'information-circle' as const,
  },
};

export default function AlertCard({ alert }: AlertCardProps) {
  const appearance = ALERT_STYLES[alert.type];

  return (
    <View
      style={[styles.card, { backgroundColor: appearance.background, borderColor: appearance.color }]}
      accessibilityRole="alert"
    >
      <Ionicons name={appearance.icon} size={22} color={appearance.color} style={styles.icon} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: appearance.color }]}>{alert.title}</Text>
        <Text style={styles.message}>{alert.message}</Text>
        {alert.date ? <Text style={styles.date}>{alert.date}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: SPACING.gapLg,
    paddingVertical: 14,
  },
  icon: {
    marginRight: 12,
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  message: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 2,
  },
  date: {
    color: TEXT_MUTED,
    fontSize: 13,
    marginTop: 8,
  },
});