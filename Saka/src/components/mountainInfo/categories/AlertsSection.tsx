import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../../data/mountainTips';
import AlertCard from '../AlertCard';
import CategoryInfoModal from '../CategoryInfoModal';
import {
  ACCENT_PURPLE,
  FONT,
  RADIUS_CARD,
  SPACING,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

export interface AlertsSectionProps {
  alerts: Alert[];
}

export default function AlertsSection({ alerts }: AlertsSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setModalVisible(true)}
        style={[styles.card, styles.compactCard]}
        accessibilityRole="button"
        accessibilityLabel="Open Events & Alerts"
        accessibilityHint="Opens event and alert information"
      >
        <View style={[styles.iconWrap, { backgroundColor: ACCENT_PURPLE }]}>
          <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
        </View>

        <Text style={[styles.title, styles.compactTitle]} numberOfLines={2}>
          Events & Alerts
        </Text>

        <Text style={[styles.subtitle, styles.compactSubtitle]} numberOfLines={3}>
          Latest updates and important reminders.
        </Text>
      </TouchableOpacity>

      <CategoryInfoModal
        visible={modalVisible}
        title="Events & Alerts"
        icon="notifications-outline"
        onClose={() => setModalVisible(false)}
      >
        {alerts.length > 0 ? (
          alerts.map((alert, index) => (
            <AlertCard key={`${alert.type}-${alert.title}-${index}`} alert={alert} />
          ))
        ) : (
          <Text style={styles.emptyText}>There are no current alerts for this mountain.</Text>
        )}
      </CategoryInfoModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    height: 148,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    marginBottom: SPACING.gapLg,
    justifyContent: 'space-between',
  },
  compactCard: {
    height: 136,
    padding: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  compactTitle: {
    fontSize: 11.5,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 9.5,
    lineHeight: 12.5,
    flex: 1,
  },
  compactSubtitle: {
    fontSize: 8.8,
    lineHeight: 11.5,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 20,
    paddingTop: 14,
  },
});