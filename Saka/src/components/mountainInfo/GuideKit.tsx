import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BORDER_DEFAULT, TEXT_FAINT, TEXT_MUTED, TEXT_PRIMARY } from '../../theme/designTokens';

/**
 * Small layout pieces shared by the single-look popups (Safety, Preparation, Etiquette).
 * UI only: the data for each guide lives in data/mountainTips.ts.
 */

/** True when the popup is wide enough for two columns. */
export function useWide() {
  const { width } = useWindowDimensions();
  return Math.min(width - 40, 620) >= 500;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

/** A small label with a short passage under it. */
export function Block({ kicker, text }: { kicker: string; text: string }) {
  return (
    <View style={styles.block}>
      <Kicker>{kicker}</Kicker>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );
}

/** A ruled row: a name, an optional grey line under it, and an optional value on the right. */
export function Row({
  name,
  detail,
  value,
  first,
}: {
  name: string;
  detail?: string;
  value?: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.row, !first && styles.rowRule]}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

/** A quiet closing line. */
export function Footnote({ children }: { children: ReactNode }) {
  return <Text style={styles.footnote}>{children}</Text>;
}

/**
 * Wide: left column, hairline, right column; `bottom` sits at the foot of the left column.
 * Narrow: everything stacks. Leave `right` out for a single column.
 */
export function GuideColumns({
  left,
  right,
  bottom,
  leftFlex = 0.9,
  rightFlex = 1.2,
}: {
  left: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  leftFlex?: number;
  rightFlex?: number;
}) {
  const wide = useWide();

  if (wide) {
    return (
      <View style={styles.cols}>
        <View style={[styles.left, { flex: right ? leftFlex : 1 }, right ? styles.leftPad : null]}>
          <View>{left}</View>
          {bottom}
        </View>
        {right ? (
          <>
            <View style={styles.vline} />
            <View style={[styles.right, { flex: rightFlex }]}>{right}</View>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {left}
      {right ? <View style={styles.stackRule}>{right}</View> : null}
      {bottom ? <View style={styles.stackBottom}>{bottom}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cols: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 6,
  },
  left: {
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  leftPad: {
    paddingRight: 16,
  },
  vline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_DEFAULT,
  },
  right: {
    paddingLeft: 16,
    paddingVertical: 4,
  },
  stackRule: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  stackBottom: {
    paddingTop: 8,
  },

  kicker: {
    color: TEXT_FAINT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  block: {
    paddingBottom: 12,
  },
  blockText: {
    marginTop: 5,
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  rowRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  detail: {
    marginTop: 1,
    color: TEXT_MUTED,
    fontSize: 11.5,
    lineHeight: 15,
  },
  value: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    color: TEXT_FAINT,
    fontSize: 12,
    lineHeight: 17,
  },
});