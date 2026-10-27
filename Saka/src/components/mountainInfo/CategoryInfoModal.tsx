import React, { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_GOLD_ICON,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  FONT,
  RADIUS_BTN,
  SPACING,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

interface CategoryInfoModalProps {
  visible: boolean;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
  children: ReactNode;
}

export default function CategoryInfoModal({
  visible,
  title,
  icon,
  onClose,
  children,
}: CategoryInfoModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={20} color={ACCENT_GOLD} />
            </View>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scrollView}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  panel: {
    width: '78%',
    maxWidth: 500,
    height: '78%',
    maxHeight: 520,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_CARD,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.cardPadH,
    paddingVertical: SPACING.gap,
    backgroundColor: BG_PANEL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.gapLg,
    borderRadius: 18,
    backgroundColor: BG_GOLD_ICON,
  },
  title: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: FONT.itemSize,
    fontWeight: '700',
    marginRight: SPACING.gap,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS_BTN,
    backgroundColor: BG_SUBTLE,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: SPACING.gap,
    paddingBottom: SPACING.cardPadB,
  },
});