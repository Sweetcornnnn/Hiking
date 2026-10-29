import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Alert, MountainTips } from '../../../data/mountainTips';
import AlertCard from '../AlertCard';
import InfoSection from '../InfoSection';
import AlertsScene from '../scenes/AlertsScene';
import { PALETTE } from '../scenes/Primitives';
import { TEXT_MUTED } from '../../../theme/designTokens';

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

/**
 * The alerts tile. Its beacon takes the colour of the most severe active alert,
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

  const calm = sorted.length === 0;
  const accent = calm ? PALETTE.sage : SEVERITY_COLOR[sorted[0].type];

  return (
    <InfoSection
      title="Events & Alerts"
      subtitle={calm ? 'All clear for now.' : 'Closures and hazards, most urgent first.'}
      accent={accent}
      scene={<AlertsScene accent={accent} calm={calm} />}
      countLabel={calm ? 'None' : `${sorted.length} active`}
      detail={
        calm ? (
          <Text style={styles.empty}>There are no current alerts for this mountain.</Text>
        ) : (
          // One top-level entry per alert, so the popup can page them instead of scrolling.
          sorted.map((alert, index) => (
            <View key={`${alert.type}-${alert.title}-${index}`} style={styles.alertEntry}>
              <AlertCard
                alert={alert}
                unread={unreadAlertKeys.has(getAlertKey(mountain, alert))}
                onPress={
                  unreadAlertKeys.has(getAlertKey(mountain, alert))
                    ? () => onAlertViewed(alert)
                    : undefined
                }
              />
            </View>
          ))
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  alertEntry: {
    marginTop: 12,
  },
  empty: {
    color: TEXT_MUTED,
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 14,
  },
});