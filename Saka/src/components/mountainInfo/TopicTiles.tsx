import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../data/mountainTips';
import AlertsScene from './scenes/AlertsScene';
import { SceneThumb, withAlpha } from './scenes/Primitives';
import type { Topic } from './topics';
import {
  ALERT_COLOR,
  BG_PANEL,
  BORDER_DEFAULT,
  MI_RADIUS,
  MI_SPACE,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TOPIC,
  TYPE,
} from '../../theme/designTokens';

/* ─── Alert banner ────────────────────────────────────────────────────── */

const SEVERITY_ORDER: Record<Alert['type'], number> = { danger: 0, warning: 1, info: 2 };
export const sortAlerts = (alerts: Alert[]) =>
  [...alerts].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]);

/**
 * Active alerts: a banner with the most urgent one. All clear: a slim, non-tappable line.
 * Opening it marks every unread alert as read (handled by the parent).
 */
export function AlertBanner({
  sorted,
  unread,
  onOpen,
}: {
  sorted: Alert[];
  unread: number;
  onOpen: () => void;
}) {
  if (sorted.length === 0) {
    return (
      <View style={styles.calm} accessible accessibilityLabel="All clear. No current alerts.">
        <View style={[styles.calmDot, { backgroundColor: ALERT_COLOR.calm }]} />
        <Text style={styles.calmText}>All clear · no current alerts</Text>
      </View>
    );
  }

  const top = sorted[0];
  const color = ALERT_COLOR[top.type];
  const more = sorted.length - 1;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.banner,
        { borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.1) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${top.title}${more > 0 ? `, and ${more} more` : ''}${unread > 0 ? `, ${unread} unread` : ''}`}
      accessibilityHint="Opens all alerts"
    >
      <SceneThumb accent={color} width={44}>
        <AlertsScene accent={color} />
      </SceneThumb>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle} numberOfLines={1}>{top.title}</Text>
        <Text style={styles.bannerMeta} numberOfLines={1}>
          {more > 0 ? `+${more} more alert${more === 1 ? '' : 's'}` : top.message}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
    </Pressable>
  );
}

/* ─── Hero card: Trail + Transport share one card ─────────────────────── */

function HeroTile({ topic, onOpen }: { topic: Topic; onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.heroTile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}. ${topic.headline}${topic.meta ? `, ${topic.meta}` : ''}`}
      accessibilityHint="Opens the full guide"
    >
      <View style={styles.heroTop}>
        <SceneThumb accent={topic.accent} width={56}>{topic.scene}</SceneThumb>
        {topic.meta ? (
          <View style={[styles.pill, { backgroundColor: withAlpha(topic.accent, 0.16) }]}>
            <Text style={[styles.pillText, { color: topic.accent }]}>{topic.meta}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{topic.title}</Text>
      <Text style={styles.headline} numberOfLines={3}>{topic.headline}</Text>
    </Pressable>
  );
}

export function HeroCard({ left, right, onOpen }: { left: Topic; right: Topic; onOpen: (t: Topic) => void }) {
  return (
    <View style={styles.hero}>
      <HeroTile topic={left} onOpen={() => onOpen(left)} />
      <View style={styles.divider} />
      <HeroTile topic={right} onOpen={() => onOpen(right)} />
    </View>
  );
}

/* ─── Rows: Preparation (regular) and Safety / Etiquette (compact) ────── */

export function TopicRow({ topic, compact = false, onOpen }: { topic: Topic; compact?: boolean; onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        { borderColor: withAlpha(topic.accent, 0.3) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}. ${topic.headline}${topic.meta ? `, ${topic.meta}` : ''}`}
      accessibilityHint="Opens the full guide"
    >
      <SceneThumb accent={topic.accent} width={compact ? 48 : 64}>{topic.scene}</SceneThumb>
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>{topic.title}</Text>
        <Text style={styles.headline} numberOfLines={compact ? 1 : 2}>{topic.headline}</Text>
        {topic.meta && !compact ? <Text style={styles.meta}>{topic.meta}</Text> : null}
      </View>
      {topic.meta && compact ? <Text style={styles.meta}>{topic.meta}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  // Alerts
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: MI_RADIUS.card,
  },
  bannerText: { flex: 1, minWidth: 0 },
  bannerTitle: { ...TYPE.title, color: TEXT_PRIMARY },
  bannerMeta: { ...TYPE.detail, marginTop: 1, color: TEXT_MUTED },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: TOPIC.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  calm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 2 },
  calmDot: { width: 6, height: 6, borderRadius: 3 },
  calmText: { ...TYPE.detail, color: TEXT_MUTED },

  // Hero
  hero: {
    flexDirection: 'row',
    borderRadius: MI_RADIUS.card,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_PANEL,
    overflow: 'hidden',
  },
  heroTile: { flex: 1, minWidth: 0, padding: MI_SPACE.md, gap: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  divider: { width: 1, marginVertical: MI_SPACE.md, backgroundColor: BORDER_DEFAULT },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderRadius: MI_RADIUS.card,
    backgroundColor: BG_PANEL,
  },
  rowCompact: { padding: 8, gap: 10 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },

  // Shared text
  title: { ...TYPE.title, color: TEXT_PRIMARY },
  headline: { ...TYPE.headline, color: TEXT_PRIMARY },
  meta: { ...TYPE.detail, color: TEXT_MUTED },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: MI_RADIUS.chip },
  pillText: { ...TYPE.detail, fontWeight: '700' },
});