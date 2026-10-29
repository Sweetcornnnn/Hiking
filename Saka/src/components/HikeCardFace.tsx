import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/* ------------------------------------------------------------------ */
/* Hike card faces                                                     */
/*  stub    - a paper permit stub, same family as HikePermitModal      */
/*  blaze   - trail-register entry marked with a painted trail blaze   */
/*  contour - dark forest card with topographic rings                  */
/* Only the look lives here. Tap / hold-to-delete stays in Hikes.tsx.  */
/* ------------------------------------------------------------------ */

export type CardVariant = 'stub' | 'blaze' | 'contour';

/** Flip this to compare the three looks. */
export const CARD_VARIANT: CardVariant = 'stub';

const SCREEN_BG = '#0A111A';
const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

// Permit palette (same values as HikePermitModal.tsx)
const PAPER = '#F2E8D0';
const PAPER_EDGE = '#CDB88A';
const INK = '#1B2433';
const INK_LABEL = 'rgba(90,70,35,0.7)';

// Hikes other people put on the calendar are written in blue ballpoint on cooler paper
const SHARED_PAPER = '#DDE3EC';
const SHARED_PAPER_EDGE = '#A9B4C4';
const SHARED_INK = '#2B4A8C';
const SHARED_INK_LABEL = 'rgba(43,74,140,0.65)';

export interface CardWeather {
  /** Ionicons name */
  name: string;
  /** OpenWeather code, e.g. '10d' */
  code?: string;
  /** Colour that reads on the dark card faces */
  color: string;
}

export interface HikeCardFaceProps {
  variant: CardVariant;
  canEdit: boolean;
  hikeId: string;
  timePrimary: string;
  timeSecondary: string;
  dateText: string;
  group?: number | string | null;
  weather: CardWeather | null;
}

/** Container look for each variant. Padding lives in the faces so the stub can bleed to the edges. */
export const getCardShell = (variant: CardVariant, canEdit: boolean): ViewStyle => {
  switch (variant) {
    case 'blaze':
      return {
        borderRadius: 3,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: canEdit ? '#0C131C' : '#0C1420',
      };
    case 'contour':
      return {
        borderRadius: 12,
        borderColor: canEdit ? 'rgba(143,184,154,0.2)' : 'rgba(124,168,255,0.22)',
        backgroundColor: canEdit ? '#0E1914' : '#0E1624',
      };
    default:
      return {
        borderRadius: 4,
        borderColor: canEdit ? PAPER_EDGE : SHARED_PAPER_EDGE,
        backgroundColor: canEdit ? PAPER : SHARED_PAPER,
      };
  }
};

// Pale sky colours vanish on paper, so the stub gets inkier ones
const paperWeatherColor = (code?: string) => {
  if (!code) return INK_LABEL;
  if (code.startsWith('01')) return '#B7791F';
  if (code.startsWith('02')) return '#A8803A';
  if (code.startsWith('09') || code.startsWith('10')) return '#2F6DB5';
  if (code.startsWith('11')) return '#6B3FB0';
  if (code.startsWith('13')) return '#5B8FB0';
  return '#6B7785';
};

const shortNo = (id: string) => `SK-${String(id).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`;
const hasGroupOf = (g?: number | string | null) => Number(g) > 0;

/* ============================ stub ================================= */

function StubFace(p: HikeCardFaceProps) {
  const ink = p.canEdit ? INK : SHARED_INK;
  const label = p.canEdit ? INK_LABEL : SHARED_INK_LABEL;
  const edge = p.canEdit ? 'rgba(120,90,40,0.45)' : 'rgba(43,74,140,0.4)';

  return (
    <View>
      <View style={s.stubTop}>
        <Text style={[s.stubNo, { color: label }]}>No. {shortNo(p.hikeId)}</Text>
        {p.weather ? (
          <Ionicons name={p.weather.name as any} size={13} color={paperWeatherColor(p.weather.code)} />
        ) : null}
      </View>

      <View style={s.stubBody}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[s.stubTime, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {p.timePrimary}
          </Text>
          <Text
            style={[s.stubSub, { color: label }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {p.timeSecondary}
          </Text>
        </View>
        {!p.canEdit ? (
          <View style={[s.sharedStamp, { borderColor: SHARED_INK }]}>
            <Text style={[s.sharedStampText, { color: SHARED_INK }]}>SHARED</Text>
          </View>
        ) : null}
      </View>

      {/* perforation, with punched half-circles on both edges */}
      <View style={s.perfRow}>
        <View style={[s.perfLine, { borderColor: edge }]} />
        <View style={[s.notch, { left: -7 }]} />
        <View style={[s.notch, { right: -7 }]} />
      </View>

      <View style={s.stubFoot}>
        <Text style={[s.stubDate, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {p.dateText}
        </Text>
        {hasGroupOf(p.group) ? (
          <Text style={[s.stubGroup, { color: label }]}>Group of {p.group}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ============================ blaze ================================ */
// Own hikes get a white blaze (the main trail), shared hikes a blue one (a side trail).

function BlazeFace(p: HikeCardFaceProps) {
  const paint = p.canEdit ? '#F4F1E8' : '#5B8DEF';
  const showFoot = hasGroupOf(p.group) || !p.canEdit;

  return (
    <View style={s.blazeRoot}>
      <View style={[s.blazePaint, { backgroundColor: paint }]} />
      <View style={s.blazeBody}>
        <View style={s.blazeTop}>
          <Text style={s.blazeDate} numberOfLines={1}>
            {p.dateText}
          </Text>
          {p.weather ? <Ionicons name={p.weather.name as any} size={12} color={p.weather.color} /> : null}
        </View>

        <Text style={s.blazeTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {p.timePrimary}
        </Text>
        <Text style={s.blazeSub} numberOfLines={1}>
          {p.timeSecondary}
        </Text>

        {showFoot ? (
          <>
            <View style={s.blazeRule} />
            <View style={s.blazeFoot}>
              {hasGroupOf(p.group) ? (
                <View style={s.inline}>
                  <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.55)" />
                  <Text style={s.blazeFootText}>{p.group}</Text>
                </View>
              ) : (
                <View />
              )}
              {!p.canEdit ? <Text style={[s.blazeFootText, { color: '#8FB0FF' }]}>Shared</Text> : null}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/* ============================ contour ============================== */

const RINGS = [
  { w: 36, rot: 8, a: 0.34 },
  { w: 66, rot: -14, a: 0.26 },
  { w: 98, rot: 10, a: 0.19 },
  { w: 132, rot: -6, a: 0.13 },
  { w: 168, rot: 14, a: 0.08 },
];

function ContourFace(p: HikeCardFaceProps) {
  const rgb = p.canEdit ? '143,184,154' : '124,168,255';
  const time = p.canEdit ? PAPER : '#D6E2FF';
  const showFoot = hasGroupOf(p.group) || !p.canEdit;

  return (
    <View style={s.contourRoot}>
      <View pointerEvents="none" style={s.contourAnchor}>
        {RINGS.map((r, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: -r.w / 2,
              top: -(r.w * 0.8) / 2,
              width: r.w,
              height: r.w * 0.8,
              borderRadius: r.w / 2,
              borderWidth: 1,
              borderColor: `rgba(${rgb},${r.a})`,
              transform: [{ rotate: `${r.rot}deg` }],
            }}
          />
        ))}
      </View>

      <View style={s.contourTop}>
        <Text style={[s.contourDate, { color: `rgba(${rgb},0.85)` }]} numberOfLines={1}>
          {p.dateText}
        </Text>
        {p.weather ? <Ionicons name={p.weather.name as any} size={12} color={p.weather.color} /> : null}
      </View>

      <Text style={[s.contourTime, { color: time }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {p.timePrimary}
      </Text>
      <Text style={s.contourSub} numberOfLines={1}>
        {p.timeSecondary}
      </Text>

      {showFoot ? (
        <View style={s.contourFoot}>
          {hasGroupOf(p.group) ? (
            <View style={s.inline}>
              <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.5)" />
              <Text style={s.contourFootText}>{p.group}</Text>
            </View>
          ) : null}
          {!p.canEdit ? <Text style={[s.contourFootText, { color: '#9DBBFF' }]}>Shared</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ============================ entry ================================ */

export function HikeCardFace(props: HikeCardFaceProps) {
  switch (props.variant) {
    case 'blaze':
      return <BlazeFace {...props} />;
    case 'contour':
      return <ContourFace {...props} />;
    default:
      return <StubFace {...props} />;
  }
}

const s = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  /* stub */
  stubTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingTop: 9,
  },
  stubNo: { fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }), fontSize: 8, letterSpacing: 0.5 },
  stubBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingTop: 3,
    paddingBottom: 9,
    gap: 6,
  },
  stubTime: { fontFamily: SERIF, fontSize: 25, fontWeight: '700', letterSpacing: -0.3 },
  stubSub: { fontFamily: SERIF, fontSize: 10.5, fontStyle: 'italic', marginTop: -1 },
  sharedStamp: {
    borderWidth: 1.5,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    opacity: 0.85,
    transform: [{ rotate: '-9deg' }],
  },
  sharedStampText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  perfRow: { height: 14, justifyContent: 'center' },
  perfLine: { marginHorizontal: 9, borderTopWidth: 1.5, borderStyle: 'dotted' },
  notch: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: SCREEN_BG,
  },
  stubFoot: { paddingHorizontal: 11, paddingTop: 6, paddingBottom: 9, gap: 1 },
  stubDate: { fontFamily: SERIF, fontSize: 12, fontWeight: '700' },
  stubGroup: { fontFamily: SERIF, fontSize: 10, fontStyle: 'italic' },

  /* blaze */
  blazeRoot: { flexDirection: 'row', padding: 10, gap: 9 },
  blazePaint: { width: 6, height: 20, borderRadius: 1.5, marginTop: 1 },
  blazeBody: { flex: 1, minWidth: 0 },
  blazeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  blazeDate: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  blazeTime: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  blazeSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: -1 },
  blazeRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 10 },
  blazeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  blazeFootText: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' },

  /* contour */
  contourRoot: { padding: 11 },
  contourAnchor: { position: 'absolute', right: 6, bottom: 4, width: 0, height: 0 },
  contourTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  contourDate: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  contourTime: {
    fontSize: 27,
    fontWeight: '300',
    letterSpacing: -0.6,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  contourSub: { color: 'rgba(242,232,208,0.5)', fontSize: 11, marginTop: -1 },
  contourFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  contourFootText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600' },
});