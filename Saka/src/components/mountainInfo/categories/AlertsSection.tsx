import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../../data/mountainTips';
import AlertCard from '../AlertCard';
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  BORDER_GOLD_SOFT,
  FONT,
  RADIUS_BTN,
  SPACING,
  TEXT_DANGER,
  TEXT_MUTED,
} from '../../../theme/designTokens';

export interface AlertsSectionProps {
  alerts: Alert[];
}

const PANEL_MAX_WIDTH = 320;
const FALLBACK_ANCHOR = { top: 64, right: SPACING.gapLg };

export default function AlertsSection({ alerts }: AlertsSectionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const bellRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  // Alerts count as "unread" until the panel is opened once.
  const [seen, setSeen] = useState(false);
  const [anchor, setAnchor] = useState(FALLBACK_ANCHOR);

  const unreadCount = seen ? 0 : alerts.length;
  const panelWidth = Math.min(windowWidth - SPACING.gapLg * 2, PANEL_MAX_WIDTH);

  const openPanel = () => {
    setSeen(true);
    const node = bellRef.current;
    if (!node) {
      setOpen(true);
      return;
    }
    // Anchor the dropdown just below the bell, right-aligned with it.
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setAnchor({
          top: y + height + SPACING.gap,
          right: Math.max(windowWidth - (x + width), SPACING.gap),
        });
      } else {
        setAnchor(FALLBACK_ANCHOR);
      }
      setOpen(true);
    });
  };

  const closePanel = () => setOpen(false);

  return (
    <>
      <View ref={bellRef} collapsable={false} style={styles.bellWrap}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openPanel}
          style={styles.bellButton}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? `Open Events & Alerts, ${unreadCount} new`
              : 'Open Events & Alerts'
          }
          accessibilityHint="Opens event and alert information"
        >
          <Ionicons name="notifications-outline" size={22} color={ACCENT_GOLD} />
        </TouchableOpacity>
        {unreadCount > 0 ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePanel}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closePanel}
            accessibilityRole="button"
            accessibilityLabel="Close Events & Alerts"
          />
          <View
            style={[styles.panel, { top: anchor.top, right: anchor.right, width: panelWidth }]}
          >
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <Ionicons name="notifications-outline" size={14} color={ACCENT_GOLD} />
                <Text style={styles.panelTitle} numberOfLines={1}>Events & Alerts</Text>
              </View>
              <TouchableOpacity
                onPress={closePanel}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close Events & Alerts"
              >
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={styles.panelContent}
              showsVerticalScrollIndicator={false}
            >
              {alerts.length > 0 ? (
                alerts.map((alert, index) => (
                  <AlertCard key={`${alert.type}-${alert.title}-${index}`} alert={alert} />
                ))
              ) : (
                <Text style={styles.emptyText}>There are no current alerts for this mountain.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellWrap: {
    width: 44,
    height: 44,
    marginLeft: SPACING.gapLg,
  },
  // Same footprint and treatment as the header's back button.
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TEXT_DANGER,
    borderWidth: 1.5,
    borderColor: BG_CARD,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    maxHeight: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
    backgroundColor: BG_PANEL,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  panelHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BG_SUBTLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelScroll: {
    flexGrow: 0,
  },
  panelContent: {
    paddingHorizontal: SPACING.gapLg,
    paddingTop: 2,
    paddingBottom: SPACING.gapLg,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 20,
    paddingTop: 14,
  },
});
