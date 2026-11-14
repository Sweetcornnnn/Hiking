import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  Alert,
  EtiquetteGuide,
  PreparationGuide,
  SafetyGuide,
  TrailGuide,
  TransportGuide,
} from '../../data/mountainTips';
import {
  ALERT_COLOR,
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TYPE,
} from '../../theme/designTokens';

/* ─── Shared pieces (one copy, used by every detail sheet) ─────────────── */

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.kicker, color ? { color } : null]}>{children}</Text>;
}

/** A label with a short passage under it. */
export function Block({ kicker, text }: { kicker: string; text: string }) {
  return (
    <Section>
      <Kicker>{kicker}</Kicker>
      <Text style={styles.body}>{text}</Text>
    </Section>
  );
}

/** A section separated from the one above by a hairline. */
export function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/** Name on the left (and a muted line under it), optional value on the right. */
export function Row({ name, detail, value }: { name: string; detail?: string; value?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name}>{name}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function formatPrice(price: number | string) {
  if (typeof price === 'string') return price;
  return `₱${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/* ─── Detail bodies ───────────────────────────────────────────────────── */

export function ItemsDetail({ items, accent }: { items: string[]; accent: string }) {
  if (items.length === 0) return <Note>No tips have been added for this category yet.</Note>;
  return (
    <View>
      {items.map((item, i) => (
        <View key={`${i}-${item}`} style={styles.item}>
          <View style={[styles.bullet, { backgroundColor: accent }]} />
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function TrailDetail({ guide }: { guide: TrailGuide }) {
  const stops = guide.stops ?? [];
  const landmarks = guide.landmarks?.length ? guide.landmarks.join(' · ') : null;
  return (
    <View>
      <Block kicker="WHERE TO START" text={guide.startPoint} />
      {guide.dropOff ? <Block kicker="DROP-OFF" text={guide.dropOff} /> : null}
      {guide.summitTrail || stops.length > 0 ? (
        <Section>
          <Kicker>ON THE TRAIL</Kicker>
          {guide.summitTrail ? <Text style={styles.body}>{guide.summitTrail}</Text> : null}
          {stops.map((s, i) => (
            <Row key={i} name={s.label} value={s.detail} />
          ))}
        </Section>
      ) : null}
      {landmarks ? <Block kicker="ALONG THE WAY" text={landmarks} /> : null}
      {guide.water ? <Block kicker="WATER" text={guide.water} /> : null}
      {guide.notes ? <Block kicker="NOTES" text={guide.notes} /> : null}
      {guide.tip ? <Note>{guide.tip}</Note> : null}
    </View>
  );
}

export function TransportDetail({ guide }: { guide: TransportGuide }) {
  return (
    <View>
      {guide.startPoint ? <Block kicker="WHERE TO BEGIN" text={guide.startPoint} /> : null}
      {guide.options.length > 0 ? (
        <Section>
          <Kicker>RIDES</Kicker>
          {guide.options.map((o, i) => (
            <Row
              key={i}
              name={o.vehicle}
              detail={o.note}
              value={o.pricePerPerson != null ? `${formatPrice(o.pricePerPerson)} / person` : 'Confirm fare'}
            />
          ))}
        </Section>
      ) : null}
      {guide.whereToAvail ? <Block kicker="WHERE TO AVAIL" text={guide.whereToAvail} /> : null}
      {guide.nextStop ? <Block kicker="NEXT STOP" text={guide.nextStop} /> : null}
      {guide.lastStop ? <Block kicker="LAST STOP / DROP-OFF" text={guide.lastStop} /> : null}
      {guide.faresNotes ? <Block kicker="FARES / NOTES" text={guide.faresNotes} /> : null}
      {guide.tip ? <Note>{guide.tip}</Note> : null}
    </View>
  );
}

export function PreparationDetail({ guide }: { guide: PreparationGuide }) {
  const facts = guide.facts ?? [];
  const fees = guide.fees ?? [];
  const bring = guide.bring ?? [];
  return (
    <View>
      {facts.length > 0 ? (
        <Section>
          {facts.map((f, i) => (
            <Row key={i} name={f.label} value={f.value} />
          ))}
        </Section>
      ) : null}
      {fees.length > 0 ? (
        <Section>
          <Kicker>FEES</Kicker>
          {fees.map((f, i) => (
            <Row key={i} name={f.label} value={f.amount} />
          ))}
        </Section>
      ) : null}
      {bring.length > 0 ? <Block kicker="BRING" text={bring.join(' · ')} /> : null}
      {guide.note ? (facts.length > 0 ? <Note>{guide.note}</Note> : <Block kicker="NOTE" text={guide.note} />) : null}
    </View>
  );
}

export function SafetyDetail({ guide }: { guide: SafetyGuide }) {
  const hazards = guide.hazards ?? [];
  return (
    <View>
      {guide.emergency ? <Block kicker="EMERGENCY PLAN" text={guide.emergency} /> : null}
      {guide.weather ? <Block kicker="WEATHER" text={guide.weather} /> : null}
      {hazards.length > 0 ? (
        <Section>
          <Kicker>WATCH FOR</Kicker>
          {hazards.map((h, i) => (
            <Row key={i} name={h.label} detail={h.detail} />
          ))}
        </Section>
      ) : null}
      {guide.note ? <Note>{guide.note}</Note> : null}
    </View>
  );
}

export function EtiquetteDetail({ guide }: { guide: EtiquetteGuide }) {
  const rules = guide.rules ?? [];
  return (
    <View>
      {guide.local ? <Block kicker="LOCAL CUSTOMS" text={guide.local} /> : null}
      {rules.length > 0 ? (
        <Section>
          <Kicker>ON THE MOUNTAIN</Kicker>
          {rules.map((r, i) => (
            <Row key={i} name={r.label} detail={r.detail} />
          ))}
        </Section>
      ) : null}
      {guide.note ? <Note>{guide.note}</Note> : null}
    </View>
  );
}

const SEVERITY_LABEL: Record<Alert['type'], string> = { danger: 'DANGER', warning: 'WARNING', info: 'NOTICE' };

export function AlertsDetail({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <Block kicker="ALL CLEAR" text="There are no current alerts for this mountain." />;
  }
  return (
    <View>
      {alerts.map((a, i) => (
        <Section key={`${a.type}-${a.title}-${i}`}>
          <Kicker color={ALERT_COLOR[a.type]}>{SEVERITY_LABEL[a.type]}</Kicker>
          <Text style={[styles.name, styles.alertTitle]}>{a.title}</Text>
          <Text style={styles.body}>{a.message}</Text>
          {a.date ? <Text style={[styles.detail, styles.alertDate]}>{a.date}</Text> : null}
        </Section>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
  },
  kicker: { ...TYPE.kicker, color: TEXT_FAINT },
  body: { ...TYPE.body, marginTop: 4, color: TEXT_PRIMARY },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.headline, color: TEXT_PRIMARY },
  detail: { ...TYPE.detail, marginTop: 1, color: TEXT_MUTED },
  value: { ...TYPE.headline, color: TEXT_PRIMARY, fontVariant: ['tabular-nums'], textAlign: 'right', maxWidth: '45%' },
  note: { ...TYPE.detail, paddingTop: 10, color: TEXT_MUTED },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7, marginRight: 10 },
  itemText: { ...TYPE.body, flex: 1, color: TEXT_SECONDARY },
  alertTitle: { marginTop: 5 },
  alertDate: { marginTop: 6 },
});