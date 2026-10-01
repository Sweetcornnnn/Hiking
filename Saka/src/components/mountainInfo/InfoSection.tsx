import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  FONT,
  RADIUS_CARD,
  RADIUS_BTN,
  SPACING,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

export interface InfoSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
}

export default function InfoSection({ title, icon, items }: InfoSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        activeOpacity={0.75}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={21} color={ACCENT_GOLD} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={TEXT_MUTED}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.content}>
          {items.map((item, index) => (
            <View key={`${index}-${item}`} style={styles.itemRow}>
              <View style={styles.bullet} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
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
    marginRight: SPACING.gap,
  },
  content: {
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: 2,
    paddingBottom: SPACING.cardPadB,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
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
    color: TEXT_SECONDARY,
    fontSize: FONT.itemSize,
    lineHeight: 18,
  },
});