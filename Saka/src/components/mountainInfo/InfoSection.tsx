import React, { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import CategoryInfoModal from './CategoryInfoModal';
import { SceneFrame, withAlpha } from './scenes/Primitives';
import {
  BG_PANEL,
  TEXT_FAINT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme/designTokens';

export interface InfoSectionProps {
  title: string;
  subtitle: string;
  /** The topic's colour: tints the tile border, scene backdrop and bullets. */
  accent: string;
  /** The animated scene that shows the topic's situation. */
  scene: ReactNode;
  items?: string[];
  /** Replaces the default bullet list in the detail panel. */
  detail?: ReactNode;
  /** Short label on the tile; defaults to the tip count. */
  countLabel?: string;
  onOpen?: () => void;
}

/**
 * One dashboard tile: an animated scene on top, the topic below.
 * Tapping opens the full list, so the main screen never needs to scroll.
 */
export default function InfoSection({
  title,
  subtitle,
  accent,
  scene,
  items = [],
  detail,
  countLabel,
  onOpen,
}: InfoSectionProps) {
  const [open, setOpen] = useState(false);
  const label = countLabel ?? `${items.length} ${items.length === 1 ? 'tip' : 'tips'}`;

  return (
    <>
      <Pressable
        onPress={() => {
          onOpen?.();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.tile,
          { borderColor: withAlpha(accent, 0.3) },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${label}`}
        accessibilityHint="Opens the full list"
      >
        <SceneFrame accent={accent} style={styles.scene}>
          {scene}
        </SceneFrame>

        <View style={styles.footer}>
          <View style={styles.footerText}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: withAlpha(accent, 0.16) }]}>
            <Text style={[styles.pillText, { color: accent }]}>{label}</Text>
          </View>
        </View>
      </Pressable>

      <CategoryInfoModal
        visible={open}
        title={title}
        subtitle={subtitle}
        accent={accent}
        scene={scene}
        onClose={() => setOpen(false)}
      >
        {detail ??
          (items.length > 0 ? (
            items.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.itemRow}>
                <View style={[styles.bullet, { backgroundColor: accent }]} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No tips have been added for this category yet.</Text>
          ))}
      </CategoryInfoModal>
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: BG_PANEL,
    overflow: 'hidden',
  },
  scene: {
    flex: 1,
    borderRadius: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 2,
  },
  footerText: {
    flex: 1,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  subtitle: {
    color: TEXT_FAINT,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 14,
  },
  itemText: {
    flex: 1,
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
  },
  empty: {
    color: TEXT_FAINT,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});