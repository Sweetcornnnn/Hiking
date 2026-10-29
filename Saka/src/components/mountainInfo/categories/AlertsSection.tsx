import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Alert, MountainTips } from '../../../data/mountainTips';
import InfoSection from '../InfoSection';
import AlertsScene from '../scenes/AlertsScene';
import { PALETTE } from '../scenes/Primitives';
import {
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

export interface AlertsSectionProps {
  alerts: Alert[];
  mountain: MountainTips;
  unreadAlertKeys: Set<string>;
  getAlertKey: (mountain: MountainTips, alert: Alert) => string;
  onAlertViewed: (alert: Alert) => void;
}

const SEVERITY_ORDER: Record<Alert['type'], number> = { danger: 0, warning: 1, info: 2 };
const SEVERITY_COLOR: Record<Alert['type'], string> = {
  danger: PALETTE.red,
  warning: PALETTE.gold,
  info: PALETTE.blue,
};
const SEVERITY_LABEL: Record<Alert['type'], string> = {
  danger: 'DANGER',
  warning: 'WARNING',
  info: 'NOTICE',
};

const MAX_ALERTS = 3;

function AlertItem({ alert }: { alert: Alert }) {
  const color = SEVERITY_COLOR[alert.type];
  return (
    <>
      <View style={styles.severity}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.severityText, { color }]}>{SEVERITY_LABEL[alert.type]}</Text>
      </View>
      <Text style={styles.title}>{alert.title}</Text>
      <Text style={styles.message} numberOfLines={8}>{alert.message}</Text>
      {alert.date ? <Text style={styles.date}>{alert.date}</Text> : null}
    </>
  );
}

/**
 * Every alert in one look. Wide screens set them side by side, most urgent first; narrow
 * screens stack them with a line between. Nothing to swipe or scroll.
 */
function AlertDetail({ alerts }: { alerts: Alert[] }) {
  const { width } = useWindowDimensions();
  const wide = Math.min(width - 40, 620) >= 500;

  if (alerts.length === 0) {
    return (
      <View style={styles.calm}>
        <Text style={styles.calmKicker}>ALL CLEAR</Text>
        <Text style={styles.calmText}>There are no current alerts for this mountain.</Text>
      </View>
    );
  }

  if (wide) {
    return (
      <View style={styles.cols}>
        {alerts.map((alert, index) => (
          <React.Fragment key={`${alert.type}-${alert.title}-${index}`}>
            {index > 0 ? <View style={styles.vline} /> : null}
            <View style={styles.col}>
              <AlertItem alert={alert} />
            </View>
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View>
      {alerts.map((alert, index) => (
        <View
          key={`${alert.type}-${alert.title}-${index}`}
          style={[styles.stackItem, index > 0 && styles.stackRule]}
        >
          <AlertItem alert={alert} />
        </View>
      ))}
    </View>
  );
}

/**
 * The alerts button that lives in the header: just the animated scene, with a red
 * number badge for unread alerts. Pressing it opens the list and marks every
 * unread alert as read. Its beacon takes the colour of the most severe active alert,
 * and turns calm and green when there are none.
 */
export default function AlertsSection({
  alerts,
  mountain,
  unreadAlertKeys,
  getAlertKey,
  onAlertViewed,
}: AlertsSectionProps) {
  const sorted = useMemo(
    () => [...alerts].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]),
    [alerts],
  );

  const unread = useMemo(
    () => sorted.filter((alert) => unreadAlertKeys.has(getAlertKey(mountain, alert))),
    [sorted, unreadAlertKeys, getAlertKey, mountain],
  );

  const calm = sorted.length === 0;
  const accent = calm ? PALETTE.sage : SEVERITY_COLOR[sorted[0].type];

  return (
    <InfoSection
      compact
      title="Events & Alerts"
      subtitle={calm ? 'All clear for now.' : 'Closures and hazards, most urgent first.'}
      accent={accent}
      scene={<AlertsScene accent={accent} calm={calm} />}
      modalScene={false}
      fitModal
      countLabel={calm ? 'None' : `${sorted.length} active`}
      badge={unread.length}
      // Opening the list counts as reading it.
      onOpen={() => unread.forEach((alert) => onAlertViewed(alert))}
      detail={<AlertDetail alerts={sorted.slice(0, MAX_ALERTS)} />}
    />
  );
}

const styles = StyleSheet.create({
  // ── Wide: side by side ──
  cols: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 10,
  },
  col: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
  },
  vline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_DEFAULT,
  },

  // ── Narrow: stacked ──
  stackItem: {
    paddingVertical: 12,
  },
  stackRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },

  severity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 8,
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  message: {
    marginTop: 5,
    color: TEXT_MUTED,
    fontSize: 12.5,
    lineHeight: 18,
  },
  date: {
    marginTop: 8,
    color: TEXT_FAINT,
    fontSize: 11.5,
  },

  calm: {
    paddingTop: 12,
  },
  calmKicker: {
    color: PALETTE.sage,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  calmText: {
    marginTop: 6,
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
  },
});