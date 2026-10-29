import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import InfoSection from '../InfoSection';
import TransportationScene from '../scenes/TransportationScene';
import { PALETTE } from '../scenes/Primitives';
import type { TransportGuide } from '../../../data/mountainTips';
import {
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

export interface TransportationSectionProps {
  /** Plain tips, shown when the mountain has no structured guide yet. */
  items: string[];
  guide?: TransportGuide;
  /** True when the tile shares a card with another (see MergedTile). */
  bare?: boolean;
}

function formatPrice(price: number | string) {
  if (typeof price === 'string') return price;
  return `₱${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * The whole guide in one look, with nothing to swipe or scroll.
 * Wide screens: the starting point on the left, the rides on the right.
 * Narrow screens: the starting point on top, the rides below.
 */
function TransportDetail({ guide }: { guide: TransportGuide }) {
  const { width } = useWindowDimensions();
  const wide = Math.min(width - 40, 620) >= 500;

  const start = guide.startPoint ? (
    <View style={wide ? undefined : styles.startStacked}>
      <Text style={styles.kicker}>WHERE TO BEGIN</Text>
      <Text style={styles.startText}>{guide.startPoint}</Text>
    </View>
  ) : null;

  const tip = guide.tip ? <Text style={styles.tip}>{guide.tip}</Text> : null;

  const rides = guide.options.map((option, index) => (
    <View key={index} style={[styles.row, index > 0 && styles.rowRule]}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{option.vehicle}</Text>
        {option.note ? <Text style={styles.note} numberOfLines={2}>{option.note}</Text> : null}
      </View>
      <View style={styles.priceBox}>
        {option.pricePerPerson != null ? (
          <>
            <Text style={styles.price}>{formatPrice(option.pricePerPerson)}</Text>
            <Text style={styles.perPerson}>per person</Text>
          </>
        ) : (
          <Text style={styles.noPrice}>Confirm fare</Text>
        )}
      </View>
    </View>
  ));

  if (wide) {
    return (
      <View style={styles.cols}>
        <View style={styles.left}>
          {start}
          {tip}
        </View>
        <View style={styles.vline} />
        <View style={styles.right}>{rides}</View>
      </View>
    );
  }

  return (
    <View>
      {start}
      {rides}
      {tip ? <View style={styles.tipStacked}>{tip}</View> : null}
    </View>
  );
}

export default function TransportationSection({ items, guide, bare }: TransportationSectionProps) {
  const hasGuide = Boolean(guide && (guide.startPoint || guide.options.length > 0));

  return (
    <InfoSection
      title="Transportation Guide"
      subtitle="Get there without the stress."
      accent={PALETTE.blue}
      scene={<TransportationScene />}
      modalScene={false}
      fitModal={hasGuide}
      items={items}
      detail={hasGuide && guide ? <TransportDetail guide={guide} /> : undefined}
      countLabel={hasGuide && guide ? `${guide.options.length} ${guide.options.length === 1 ? 'ride' : 'rides'}` : undefined}
      bare={bare}
    />
  );
}

const styles = StyleSheet.create({
  // ── Wide: two columns ──
  cols: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 6,
  },
  left: {
    flex: 0.85,
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingVertical: 8,
  },
  vline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_DEFAULT,
  },
  right: {
    flex: 1.3,
    paddingLeft: 16,
  },

  // ── Narrow: stacked ──
  startStacked: {
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  tipStacked: {
    paddingTop: 4,
  },

  kicker: {
    color: TEXT_FAINT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  startText: {
    marginTop: 6,
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 21,
  },
  tip: {
    paddingTop: 10,
    color: TEXT_FAINT,
    fontSize: 12,
    lineHeight: 17,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  name: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  note: {
    marginTop: 1,
    color: TEXT_MUTED,
    fontSize: 11.5,
    lineHeight: 15,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  price: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  perPerson: {
    color: TEXT_FAINT,
    fontSize: 10,
    lineHeight: 13,
  },
  noPrice: {
    color: TEXT_FAINT,
    fontSize: 12,
  },
});