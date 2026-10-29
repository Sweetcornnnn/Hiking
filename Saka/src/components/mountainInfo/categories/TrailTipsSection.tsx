import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import InfoSection from '../InfoSection';
import TrailTipsScene from '../scenes/TrailTipsScene';
import { PALETTE } from '../scenes/Primitives';
import type { TrailGuide } from '../../../data/mountainTips';
import {
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

export interface TrailTipsSectionProps {
  /** Plain tips, shown when the mountain has no structured guide yet. */
  items: string[];
  guide?: TrailGuide;
  /** True when the tile shares a card with another (see MergedTile). */
  bare?: boolean;
}

const MAX_STOPS = 4;

function Block({ kicker, text, rule }: { kicker: string; text: string; rule?: boolean }) {
  return (
    <View style={[styles.block, rule && styles.blockRule]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );
}

function Meta({ label, text }: { label: string; text: string }) {
  return (
    <Text style={styles.meta}>
      <Text style={styles.metaLabel}>{label}  </Text>
      {text}
    </Text>
  );
}

/**
 * The whole trail briefing in one look: where to start, where a vehicle drops you, and what
 * is on the way. Wide screens use two columns; narrow screens stack. Nothing to swipe or scroll.
 */
function TrailDetail({ guide }: { guide: TrailGuide }) {
  const { width } = useWindowDimensions();
  const wide = Math.min(width - 40, 620) >= 500;

  const stops = (guide.stops ?? []).slice(0, MAX_STOPS);
  const landmarks = guide.landmarks?.length ? guide.landmarks.join(' · ') : null;

  const places = (
    <>
      <Block kicker="WHERE TO START" text={guide.startPoint} rule={!wide && Boolean(guide.dropOff)} />
      {guide.dropOff ? <Block kicker="DROP-OFF" text={guide.dropOff} /> : null}
    </>
  );

  const pointer = <Text style={styles.pointer}>Need a ride? See the Transportation Guide.</Text>;

  const trail = (
    <>
      <Text style={styles.kicker}>ON THE TRAIL</Text>
      {stops.map((stop, index) => (
        <View key={index} style={[styles.row, index > 0 && styles.rowRule]}>
          <Text style={styles.stopName} numberOfLines={1}>{stop.label}</Text>
          {stop.detail ? <Text style={styles.stopDetail} numberOfLines={1}>{stop.detail}</Text> : null}
        </View>
      ))}
      <View style={stops.length > 0 ? styles.metaGroup : undefined}>
        {landmarks ? <Meta label="Along the way" text={landmarks} /> : null}
        {guide.water ? <Meta label="Water" text={guide.water} /> : null}
        {guide.tip ? <Meta label="Note" text={guide.tip} /> : null}
      </View>
    </>
  );

  if (wide) {
    return (
      <View style={styles.cols}>
        <View style={styles.left}>
          <View>{places}</View>
          {pointer}
        </View>
        <View style={styles.vline} />
        <View style={styles.right}>{trail}</View>
      </View>
    );
  }

  return (
    <View>
      {places}
      <View style={styles.stackedTrail}>{trail}</View>
      <View style={styles.stackedPointer}>{pointer}</View>
    </View>
  );
}

export default function TrailTipsSection({ items, guide, bare }: TrailTipsSectionProps) {
  const hasGuide = Boolean(guide && guide.startPoint);

  return (
    <InfoSection
      title="Trail Tips & Navigation"
      subtitle="Know the trail, find your way."
      accent={PALETTE.teal}
      scene={<TrailTipsScene />}
      modalScene={false}
      fitModal={hasGuide}
      items={items}
      detail={hasGuide && guide ? <TrailDetail guide={guide} /> : undefined}
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
    flex: 0.9,
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingVertical: 4,
  },
  vline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_DEFAULT,
  },
  right: {
    flex: 1.2,
    paddingLeft: 16,
    paddingVertical: 4,
  },

  // ── Narrow: stacked ──
  stackedTrail: {
    paddingTop: 12,
  },
  stackedPointer: {
    paddingTop: 2,
  },

  block: {
    paddingBottom: 12,
  },
  blockRule: {
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  kicker: {
    color: TEXT_FAINT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  blockText: {
    marginTop: 5,
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
  },
  pointer: {
    color: TEXT_FAINT,
    fontSize: 12,
    lineHeight: 17,
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
  stopName: {
    flexShrink: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  stopDetail: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },

  metaGroup: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
    gap: 4,
  },
  meta: {
    color: TEXT_MUTED,
    fontSize: 11.5,
    lineHeight: 16,
  },
  metaLabel: {
    color: TEXT_FAINT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});