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
  BG_GOLD_ICON,
  BG_GOLD_TINT,
  BORDER_GOLD_SOFT,
  FONT,
  SPACING,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

export interface InfoSectionProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  items: string[];
  compact?: boolean;
  showArrow?: boolean;
}

export default function InfoSection({
  title,
  subtitle,
  icon,
  iconColor = ACCENT_GOLD,
  items,
  compact = false,
  showArrow = true,
}: InfoSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setModalVisible(true)}
        style={[styles.card, compact && styles.compactCard]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint="Opens this category's tips"
      >
        <View style={[styles.iconWrap, compact && styles.compactIconWrap]}>
          <Ionicons name={icon} size={compact ? 18 : 22} color={iconColor} />
        </View>

        <View style={[styles.textWrap, compact && styles.compactTextWrap]}>
          <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.subtitle, compact && styles.compactSubtitle]} numberOfLines={3}>
            {subtitle}
          </Text>
        </View>

        {showArrow ? (
          <Ionicons name="arrow-forward" size={14} color={ACCENT_GOLD} />
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
  // Match ProfileCard's gold-tinted quick-action tiles.
  card: {
    flexGrow: 1,
    alignSelf: 'stretch',
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
    backgroundColor: BG_GOLD_TINT,
  },
  compactCard: {
    minHeight: 116,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BG_GOLD_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  textWrap: {
    flex: 1,
  },
  compactTextWrap: {
    flex: 0,
    width: '100%',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  compactTitle: {
    fontSize: 10.5,
    lineHeight: 12,
  },
  subtitle: {
    color: TEXT_FAINT,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  compactSubtitle: {
    fontSize: 8.5,
    lineHeight: 10,
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