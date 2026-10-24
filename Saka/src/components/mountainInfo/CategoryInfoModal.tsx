import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SceneFrame, withAlpha } from './scenes/Primitives';
import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

interface CategoryInfoModalProps {
  visible: boolean;
  title: string;
  subtitle: string;
  accent: string;
  /** The same animated scene as the tile, shown small in the header. */
  scene: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export default function CategoryInfoModal({
  visible,
  title,
  subtitle,
  accent,
  scene,
  onClose,
  children,
}: CategoryInfoModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        />
        <View style={[styles.panel, { borderColor: withAlpha(accent, 0.35) }]}>
          <View style={styles.header}>
            <SceneFrame accent={accent} style={styles.thumb}>
              {scene}
            </SceneFrame>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
            >
              <Ionicons name="close" size={20} color={TEXT_MUTED} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  panel: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '100%',
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: BG_CARD,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: BG_PANEL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  thumb: {
    width: 96,
    height: 62,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  subtitle: {
    color: TEXT_FAINT,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});