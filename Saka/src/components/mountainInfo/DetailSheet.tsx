import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import { SceneThumb, withAlpha } from './scenes/Primitives';
import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  MI_MAX_WIDTH,
  MI_RADIUS,
  MI_SPACE,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
} from '../../theme/designTokens';

interface DetailSheetProps {
  visible: boolean;
  title: string;
  subtitle: string;
  accent: string;
  scene?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet that scrolls. Replaces the paged CategoryInfoModal. */
export default function DetailSheet({ visible, title, subtitle, accent, scene, onClose, children }: DetailSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal {...FULLSCREEN_MODAL_PROPS} visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ModalScrim color="rgba(4,8,13,0.72)" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        />
        <View style={[styles.sheet, { maxHeight: height * 0.88, borderColor: withAlpha(accent, 0.35) }]}>
          <View style={styles.header}>
            {scene ? <SceneThumb accent={accent} width={56}>{scene}</SceneThumb> : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
            >
              <Ionicons name="close" size={18} color={TEXT_MUTED} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: MI_SPACE.lg + insets.bottom }]}
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'transparent' },
  sheet: {
    width: '100%',
    maxWidth: MI_MAX_WIDTH,
    backgroundColor: BG_CARD,
    borderTopLeftRadius: MI_RADIUS.sheet,
    borderTopRightRadius: MI_RADIUS.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: MI_SPACE.md,
    paddingVertical: MI_SPACE.md,
    backgroundColor: BG_PANEL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  headerText: { flex: 1 },
  title: { ...TYPE.title, color: TEXT_PRIMARY },
  subtitle: { ...TYPE.detail, marginTop: 1, color: TEXT_FAINT },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },
  content: { paddingHorizontal: MI_SPACE.lg, paddingTop: MI_SPACE.xs },
  pressed: { opacity: 0.7 },
});