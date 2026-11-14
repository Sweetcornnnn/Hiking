import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Alert, MountainTips } from '../../data/mountainTips';
import { getMountainAlertKey } from '../../services/mountainAlertReadService';
import ContourMark from './ContourMark';
import DetailSheet from './DetailSheet';
import AlertsScene from './scenes/AlertsScene';
import { AlertsDetail } from './GuideDetails';
import { AlertBanner, HeroCard, TopicRow, sortAlerts } from './TopicTiles';
import { buildTopics, type TopicKey } from './topics';
import { SERIF } from '../events/TrailKit';
import {
  ACCENT_GOLD,
  ALERT_COLOR,
  BG_CARD,
  BORDER_DEFAULT,
  MI_MAX_WIDTH,
  MI_SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

export interface TipsAndTricksProps {
  mountainTips: MountainTips;
  unreadAlertKeys: Set<string>;
  onAlertViewed: (alert: Alert) => void;
  onBack?: () => void;
}

type OpenKey = TopicKey | 'alerts' | null;

/**
 * Scrolling, compact guide. Order follows what hikers need, most urgent first:
 * alerts, then Trail + Transport (hero card), Preparation, and Safety / Etiquette rows.
 * Every card previews its key fact; tapping opens the full guide in a scrolling sheet.
 */
export default function TipsAndTricks({ mountainTips, unreadAlertKeys, onAlertViewed, onBack }: TipsAndTricksProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<OpenKey>(null);

  const topics = useMemo(() => buildTopics(mountainTips), [mountainTips]);
  const sorted = useMemo(() => sortAlerts(mountainTips.alerts), [mountainTips.alerts]);
  const unread = useMemo(
    () => sorted.filter((a) => unreadAlertKeys.has(getMountainAlertKey(mountainTips, a))),
    [sorted, unreadAlertKeys, mountainTips],
  );

  const openAlerts = () => {
    unread.forEach((a) => onAlertViewed(a)); // opening the list counts as reading it
    setOpen('alerts');
  };

  const active = open && open !== 'alerts' ? topics[open] : null;
  const alertAccent = sorted.length > 0 ? ALERT_COLOR[sorted[0].type] : ALERT_COLOR.calm;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + MI_SPACE.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ContourMark size={150} summit fade={0.85} style={styles.headerContour} />
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back to mountain"
            >
              <Ionicons name="home-outline" size={18} color={ACCENT_GOLD} />
            </Pressable>
          ) : <View style={styles.headerBackSpacer} />}
          <View style={styles.headerText}>
            <Text style={styles.mountainName} numberOfLines={1} accessibilityRole="header">
              {mountainTips.mountainName} Hiking Guide
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Trail, transport, preparation, safety and etiquette
            </Text>
          </View>
          <View style={styles.headerBackSpacer} />
        </View>

        <View style={styles.column}>
          <AlertBanner sorted={sorted} unread={unread.length} onOpen={openAlerts} />
          <HeroCard left={topics.trail} right={topics.transport} onOpen={(t) => setOpen(t.key)} />
          <TopicRow topic={topics.preparation} onOpen={() => setOpen('preparation')} />
          <TopicRow compact topic={topics.safety} onOpen={() => setOpen('safety')} />
          <TopicRow compact topic={topics.etiquette} onOpen={() => setOpen('etiquette')} />
        </View>
      </ScrollView>

      {active ? (
        <DetailSheet
          visible
          title={active.title}
          subtitle={active.subtitle}
          accent={active.accent}
          scene={active.scene}
          onClose={() => setOpen(null)}
        >
          {active.detail}
        </DetailSheet>
      ) : null}

      <DetailSheet
        visible={open === 'alerts'}
        title="Events & Alerts"
        subtitle={sorted.length === 0 ? 'All clear for now.' : 'Closures and hazards, most urgent first.'}
        accent={alertAccent}
        scene={<AlertsScene accent={alertAccent} calm={sorted.length === 0} />}
        onClose={() => setOpen(null)}
      >
        <AlertsDetail alerts={sorted} />
      </DetailSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_CARD },
  content: { alignItems: 'stretch', gap: MI_SPACE.sm },
  column: { width: '100%', maxWidth: MI_MAX_WIDTH + MI_SPACE.screen * 2, alignSelf: 'center', paddingHorizontal: MI_SPACE.screen, gap: MI_SPACE.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: MI_SPACE.screen,
    minHeight: 40,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
    overflow: 'hidden',
  },
  headerContour: { position: 'absolute', right: -30, top: -34 },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: 24 }] },
  headerBackSpacer: { width: 36 },
  headerText: { flex: 1, alignItems: 'center', gap: 2 },
  mountainName: { color: TEXT_PRIMARY, fontFamily: SERIF, fontSize: 20, textAlign: 'center' },
  subtitle: { marginTop: 1, color: TEXT_MUTED, fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});