import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CategoryInfoModal from './CategoryInfoModal';
import {
  ACCENT_GOLD,
  FONT,
  RADIUS_CARD,
  SPACING,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

export interface InfoSectionProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  items: string[];
  compact?: boolean;
  showArrow?: boolean;
}

export default function InfoSection({
  title,
  subtitle,
  icon,
  iconColor,
  items,
  compact = false,
  showArrow = true,
}: InfoSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setModalVisible(true)}
        style={[styles.card, compact && styles.compactCard]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint="Opens this category's tips"
      >
        <View style={[styles.iconWrap, compact && styles.compactIconWrap, { backgroundColor: iconColor }]}>
          <Ionicons name={icon} size={compact ? 18 : 20} color="#FFFFFF" />
        </View>

        <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>
          {title}
        </Text>

        <Text style={[styles.subtitle, compact && styles.compactSubtitle]} numberOfLines={3}>
          {subtitle}
        </Text>

        {showArrow ? (
          <View style={styles.arrowButton}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </TouchableOpacity>

      <CategoryInfoModal
        visible={modalVisible}
        title={title}
        icon={icon}
        onClose={() => setModalVisible(false)}
      >
        {items.map((item, index) => (
          <View key={`${index}-${item}`} style={styles.itemRow}>
            <View style={styles.bullet} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
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
  compactIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    marginBottom: 4,
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
  arrowButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.gapLg,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_GOLD,
    marginTop: 7,
    marginRight: SPACING.gapLg,
  },
  itemText: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 20,
  },
});