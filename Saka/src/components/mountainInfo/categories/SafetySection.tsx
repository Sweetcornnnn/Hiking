import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import InfoSection from '../InfoSection';
import SafetyScene from '../scenes/SafetyScene';
import { PALETTE } from '../scenes/Primitives';
import type { SafetyGuide } from '../../../data/mountainTips';
import {
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../../theme/designTokens';

// ─── Layout pieces for the single-look popup ────────────────────────────────

/** True when the popup is wide enough for two columns. */
function useWide() {
  const { width } = useWindowDimensions();
  return Math.min(width - 40, 620) >= 500;
}

function Kicker({ children }: { children: ReactNode }) {
  return <Text style={kit.kicker}>{children}</Text>;
}

/** A small label with a short passage under it. */
function Block({ kicker, text }: { kicker: string; text: string }) {
  return (
    <View style={kit.block}>
      <Kicker>{kicker}</Kicker>
      <Text style={kit.blockText}>{text}</Text>
    </View>
  );
}

/** A ruled row: a name, an optional grey line under it, and an optional value on the right. */
function Row({
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
    <View style={[kit.row, !first && kit.rowRule]}>
      <View style={kit.rowText}>
        <Text style={kit.name} numberOfLines={1}>{name}</Text>
        {detail ? <Text style={kit.detail} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {value ? <Text style={kit.value}>{value}</Text> : null}
    </View>
  );
}

/** A quiet closing line. */
function Footnote({ children }: { children: ReactNode }) {
  return <Text style={kit.footnote}>{children}</Text>;
}

/**
 * Wide: left column, hairline, right column; `bottom` sits at the foot of the left column.
 * Narrow: everything stacks. Leave `right` out for a single column.
 */
function GuideColumns({
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
      <View style={kit.cols}>
        <View style={[kit.left, { flex: right ? leftFlex : 1 }, right ? kit.leftPad : null]}>
          <View>{left}</View>
          {bottom}
        </View>
        {right ? (
          <>
            <View style={kit.vline} />
            <View style={[kit.right, { flex: rightFlex }]}>{right}</View>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {left}
      {right ? <View style={kit.stackRule}>{right}</View> : null}
      {bottom ? <View style={kit.stackBottom}>{bottom}</View> : null}
    </View>
  );
}

const kit = StyleSheet.create({
  cols: { flexDirection: 'row', alignItems: 'stretch', paddingTop: 6 },
  left: { justifyContent: 'space-between', paddingVertical: 4 },
  leftPad: { paddingRight: 16 },
  vline: { width: StyleSheet.hairlineWidth, backgroundColor: BORDER_DEFAULT },
  right: { paddingLeft: 16, paddingVertical: 4 },
  stackRule: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  stackBottom: { paddingTop: 8 },

  kicker: { color: TEXT_FAINT, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  block: { paddingBottom: 12 },
  blockText: { marginTop: 5, color: TEXT_PRIMARY, fontSize: 14, lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER_DEFAULT },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  detail: { marginTop: 1, color: TEXT_MUTED, fontSize: 11.5, lineHeight: 15 },
  value: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  footnote: { color: TEXT_FAINT, fontSize: 12, lineHeight: 17 },
});

export interface SafetySectionProps {
  /** Plain tips, shown when the mountain has no structured guide yet. */
  items: string[];
  guide?: SafetyGuide;
}

const MAX_HAZARDS = 3;

function SafetyDetail({ guide }: { guide: SafetyGuide }) {
  const hazards = (guide.hazards ?? []).slice(0, MAX_HAZARDS);

  const left = (
    <>
      {guide.emergency ? <Block kicker="EMERGENCY PLAN" text={guide.emergency} /> : null}
      {guide.weather ? <Block kicker="WEATHER" text={guide.weather} /> : null}
    </>
  );

  const right = hazards.length > 0 ? (
    <>
      <Kicker>WATCH FOR</Kicker>
      {hazards.map((hazard, index) => (
        <Row key={index} name={hazard.label} detail={hazard.detail} first={index === 0} />
      ))}
    </>
  ) : undefined;

  return (
    <GuideColumns
      left={left}
      right={right}
      bottom={guide.note ? <Footnote>{guide.note}</Footnote> : undefined}
    />
  );
}

export default function SafetySection({ items, guide }: SafetySectionProps) {
  const hasGuide = Boolean(guide && (guide.hazards?.length || guide.weather || guide.emergency));

  return (
    <InfoSection
      title="Safety Guidelines"
      subtitle="Stay safe and be prepared."
      accent={PALETTE.coral}
      scene={<SafetyScene />}
      modalScene={false}
      fitModal={hasGuide}
      items={items}
      detail={hasGuide && guide ? <SafetyDetail guide={guide} /> : undefined}
    />
  );
}