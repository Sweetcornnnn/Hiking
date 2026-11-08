import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/* ------------------------------------------------------------------ */
/* Hike card faces                                                     */
/*  stub    - a paper permit stub, same family as HikePermitModal      */
/*  blaze   - trail-register entry marked with a painted trail blaze   */
/*  contour - dark forest card with topographic rings                  */
/* Only the look lives here. Tap / hold-to-delete stays in Hikes.tsx.  */
/*                                                                     */
/* The stub is real paper: folds, flecks and loose fibres like the     */
/* permit, and it ages. A hike that is still ahead of you, or ended    */
/* today, is fresh. Every day after that wears it a little more, until */
/* a month on it is yellowed, stained, creased to death and mended.    */
/* ------------------------------------------------------------------ */

export type CardVariant = 'stub' | 'blaze' | 'contour';

/** Flip this to compare the three looks. */
export const CARD_VARIANT: CardVariant = 'stub';

/** A hike this many days past its (last) day looks as old as the card ever gets. */
export const AGE_FULL_DAYS = 30;

const SCREEN_BG = '#0A111A';
const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

// Permit palette (same values as HikePermitModal.tsx)
const PAPER = '#F2E8D0';
const PAPER_EDGE = '#CDB88A';
const INK = '#1B2433';

// Hikes other people put on the calendar are written in blue ballpoint on cooler paper
const SHARED_PAPER = '#DDE3EC';
const SHARED_PAPER_EDGE = '#A9B4C4';
const SHARED_INK = '#2B4A8C';

export interface CardWeather {
  /** Ionicons name */
  name: string;
  /** OpenWeather code, e.g. '10d' */
  code?: string;
  /** Colour that reads on the dark card faces */
  color: string;
}

type DateLike = string | number | Date | null | undefined;

export interface HikeCardFaceProps {
  variant: CardVariant;
  canEdit: boolean;
  hikeId: string;
  timePrimary: string;
  timeSecondary: string;
  dateText: string;
  group?: number | string | null;
  weather: CardWeather | null;
  /** The hike's date ('YYYY-MM-DD' or a Date). Hikes in the past make the stub look older. */
  hikeDate?: DateLike;
  /** Last day of a multi-day hike. The card starts ageing the day after this. */
  endDate?: DateLike;
  /** 0 = brand new, 1 = a month old. Overrides hikeDate. Handy for previewing the look. */
  age?: number;
}

/* ============================ ageing =============================== */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

const endOfLocalDay = (v: DateLike): Date | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
};

/** 0 for a hike that is today or still ahead, rising to 1 once it is AGE_FULL_DAYS in the past. */
export const getHikeAge = (hikeDate: DateLike, endDate?: DateLike): number => {
  const end = endOfLocalDay(endDate) ?? endOfLocalDay(hikeDate);
  if (!end) return 0;
  const days = (Date.now() - end.getTime()) / 86400000;
  return clamp01(days / AGE_FULL_DAYS);
};

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = rgbOf(a);
  const B = rgbOf(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
/** Three colours, blended across t = 0 .. 1 (fresh, middle-aged, ancient). */
const mix3 = (fresh: string, mid: string, old: string, t: number) =>
  t < 0.5 ? mix(fresh, mid, t * 2) : mix(mid, old, (t - 0.5) * 2);

/** All the colours a stub uses at a given age. */
const agePalette = (canEdit: boolean, t: number) => {
  const labelRgb = canEdit ? '90,70,35' : '43,74,140';
  const labelAlpha = (canEdit ? 0.7 : 0.65) - 0.26 * t;
  return canEdit
    ? {
        paper: mix3(PAPER, '#E7D4A4', '#C8AA70', t),
        edge: mix3(PAPER_EDGE, '#B59D69', '#8A6C3C', t),
        ink: mix3(INK, '#312E29', '#4E4334', t),
        label: `rgba(${labelRgb},${labelAlpha})`,
        perf: `rgba(110,80,35,${0.45 + 0.2 * t})`,
        flap: mix3('#F7EFDB', '#EEDDB4', '#DCC593', t),
      }
    : {
        paper: mix3(SHARED_PAPER, '#D4D4C6', '#C2BA9D', t),
        edge: mix3(SHARED_PAPER_EDGE, '#A2A290', '#857D65', t),
        ink: mix3(SHARED_INK, '#465A82', '#5E6F8C', t),
        label: `rgba(${labelRgb},${labelAlpha})`,
        perf: `rgba(43,74,140,${0.4 + 0.2 * t})`,
        flap: mix3('#E8EDF4', '#E0DFD1', '#D0C8AB', t),
      };
};

/** Container look for each variant. Padding lives in the faces so the stub can bleed to the edges. */
export const getCardShell = (variant: CardVariant, canEdit: boolean, age = 0): ViewStyle => {
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
    default: {
      const pal = agePalette(canEdit, clamp01(age));
      return { borderRadius: 4, borderColor: pal.edge, backgroundColor: pal.paper };
    }
  }
};

// Pale sky colours vanish on paper, so the stub gets inkier ones
const paperWeatherColor = (code: string | undefined, fallback: string) => {
  if (!code) return fallback;
  if (code.startsWith('01')) return '#B7791F';
  if (code.startsWith('02')) return '#A8803A';
  if (code.startsWith('09') || code.startsWith('10')) return '#2F6DB5';
  if (code.startsWith('11')) return '#6B3FB0';
  if (code.startsWith('13')) return '#5B8FB0';
  return '#6B7785';
};

const shortNo = (id: string) => `SK-${String(id).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`;
const hasGroupOf = (g?: number | string | null) => Number(g) > 0;

/* ============================ paper texture ======================== */

// Small deterministic random so every card has its own wear that stays put between renders
const seeded = (start: number) => {
  let seed = start;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};
const hashSeed = (id: string) => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 233280;
  return h || 1;
};

const SEG = 28;

/** One fold line: soft shade, dark crease, bright ridge, soft light. Uneven wear along its length. */
function Crease({
  at,
  length,
  vertical,
  strength,
  seed,
}: {
  at: number;
  length: number;
  vertical?: boolean;
  strength: number;
  seed: number;
}) {
  const wear = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: Math.ceil(length / SEG) }, () => 0.5 + rnd() * 0.5);
  }, [length, seed]);

  const band = (offset: number, size: number, color: string): ViewStyle =>
    vertical
      ? { position: 'absolute', top: 0, bottom: 0, left: offset, width: size, backgroundColor: color }
      : { position: 'absolute', left: 0, right: 0, top: offset, height: size, backgroundColor: color };

  return (
    <View
      pointerEvents="none"
      style={
        vertical
          ? { position: 'absolute', top: 0, left: at - 6, width: 12, height: length }
          : { position: 'absolute', left: 0, top: at - 6, height: 12, width: length, flexDirection: 'row' }
      }
    >
      {wear.map((k, i) => {
        const a = Math.min(1.35, strength) * k;
        return (
          <View key={i} style={vertical ? { width: 12, height: SEG } : { height: 12, width: SEG }}>
            <View style={band(0, 5, `rgba(80,55,20,${0.05 * a})`)} />
            <View style={band(5, 1, `rgba(70,45,15,${0.24 * a})`)} />
            <View style={band(6, 1, `rgba(255,255,255,${0.55 * a})`)} />
            <View style={band(7, 5, `rgba(255,255,255,${0.14 * a})`)} />
          </View>
        );
      })}
    </View>
  );
}

/** A soft stain: stacked translucent discs, squashed into an oval, with a darker tide line. */
function Stain({
  cx,
  cy,
  r,
  tilt,
  squash,
  a,
}: {
  cx: number;
  cy: number;
  r: number;
  tilt: number;
  squash: number;
  a: number;
}) {
  const disc = (d: number, alpha: number, ring?: boolean) => (
    <View
      style={{
        position: 'absolute',
        left: -d / 2,
        top: -d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: ring ? 'transparent' : `rgba(150,100,40,${alpha})`,
        borderWidth: ring ? 1.5 : 0,
        borderColor: `rgba(130,85,32,${alpha})`,
      }}
    />
  );
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        width: 0,
        height: 0,
        transform: [{ rotate: `${tilt}deg` }, { scaleY: squash }],
      }}
    >
      {disc(r * 2, 0.05 * a)}
      {disc(r * 1.55, 0.055 * a)}
      {disc(r * 1.1, 0.065 * a)}
      {disc(r * 2, 0.2 * a, true)}
    </View>
  );
}

/** Everything that lies on the paper, under the writing. */
function PaperUnderlay({ W, H, t, seed }: { W: number; H: number; t: number; seed: number }) {
  const g = useMemo(() => {
    const rnd = seeded(seed);
    const area = W * H;
    return {
      specks: Array.from({ length: clamp(Math.round(area / 2800), 4, 30) }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        s: 1 + rnd() * 2.2,
        o: 0.08 + rnd() * 0.14,
      })),
      fibres: Array.from({ length: clamp(Math.round(area / 9000), 2, 9) }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        l: 6 + rnd() * 12,
        r: rnd() * 180,
        o: 0.07 + rnd() * 0.08,
      })),
      // foxing: the brown pin-pricks old paper breaks out in
      fox: Array.from({ length: clamp(Math.round(area / 900), 8, 44) }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        s: 1 + rnd() * 2.4,
        o: 0.14 + rnd() * 0.24,
        big: rnd() > 0.86,
      })),
      stain: {
        cx: W * (0.22 + rnd() * 0.5),
        cy: H * (0.3 + rnd() * 0.45),
        r: Math.min(W, H) * (0.4 + rnd() * 0.18),
        tilt: rnd() * 60 - 30,
        squash: 0.72 + rnd() * 0.15,
      },
      ring: {
        cx: W * (0.15 + rnd() * 0.55),
        cy: H * (0.4 + rnd() * 0.4),
        d: Math.min(W, H) * (0.5 + rnd() * 0.12),
        tilt: rnd() * 180,
      },
    };
  }, [W, H, seed]);

  const foxN = Math.round(g.fox.length * clamp01(t * 1.15));
  const stainA = clamp01((t - 0.2) / 0.6);
  const ringA = clamp01((t - 0.55) / 0.35);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* worn, darkened rim: gets heavier with age */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 3,
          borderWidth: 4 + 4 * t,
          borderColor: `rgba(139,101,45,${0.07 + 0.2 * t})`,
        }}
      />
      {t > 0.3 ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: 3,
            borderWidth: 10 + 6 * t,
            borderColor: `rgba(120,80,30,${0.05 * t})`,
          }}
        />
      ) : null}

      {stainA > 0 ? <Stain {...g.stain} a={stainA} /> : null}

      {ringA > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: g.ring.cx - g.ring.d / 2,
            top: g.ring.cy - g.ring.d / 2,
            width: g.ring.d,
            height: g.ring.d,
            borderRadius: g.ring.d / 2,
            borderWidth: 2.4,
            borderColor: `rgba(105,65,25,${0.24 * ringA})`,
            backgroundColor: `rgba(150,100,40,${0.045 * ringA})`,
            transform: [{ rotate: `${g.ring.tilt}deg` }, { scaleY: 0.94 }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 3,
              top: 3,
              right: 3,
              bottom: 3,
              borderRadius: g.ring.d / 2,
              borderWidth: 1,
              borderColor: `rgba(105,65,25,${0.11 * ringA})`,
            }}
          />
        </View>
      ) : null}

      {g.specks.map((sp, i) => (
        <View
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: sp.x,
            top: sp.y,
            width: sp.s,
            height: sp.s,
            borderRadius: sp.s / 2,
            backgroundColor: `rgba(120,85,35,${sp.o})`,
          }}
        />
      ))}
      {g.fox.slice(0, foxN).map((f, i) => {
        const s = f.big ? f.s * 2 : f.s;
        return (
          <View
            key={`x${i}`}
            style={{
              position: 'absolute',
              left: f.x,
              top: f.y,
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: `rgba(128,76,28,${f.o * (f.big ? 0.6 : 1)})`,
            }}
          />
        );
      })}
      {g.fibres.map((f, i) => (
        <View
          key={`f${i}`}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: f.l,
            height: 0.8,
            backgroundColor: `rgba(120,85,35,${f.o})`,
            transform: [{ rotate: `${f.r}deg` }],
          }}
        />
      ))}

      {/* folds: two from the start, more as it gets handled */}
      <Crease vertical at={W / 2} length={H} strength={0.8 * (1 + 0.7 * t)} seed={seed + 3} />
      <Crease at={H * 0.46} length={W} strength={0.42 * (1 + 0.9 * t)} seed={seed + 9} />
      {t > 0.3 ? <Crease vertical at={W * 0.27} length={H} strength={0.7 * t} seed={seed + 15} /> : null}
      {t > 0.55 ? <Crease at={H * 0.76} length={W} strength={0.75 * t} seed={seed + 21} /> : null}
      {t > 0.8 ? <Crease vertical at={W * 0.76} length={H} strength={0.8 * t} seed={seed + 27} /> : null}
    </View>
  );
}

/** Everything that happens on top of the writing: rubbed-off ink, nicks, tape, the folded corner. */
function PaperOverlay({
  W,
  H,
  t,
  seed,
  paper,
  flap,
}: {
  W: number;
  H: number;
  t: number;
  seed: number;
  paper: string;
  flap: string;
}) {
  const g = useMemo(() => {
    const rnd = seeded(seed + 101);
    return {
      flakes: Array.from({ length: clamp(Math.round((W * H) / 1500), 4, 16) }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        s: 1.2 + rnd() * 1.8,
      })),
      nicks: [
        { x: W * (0.2 + rnd() * 0.3), edge: 'bottom' as const, s: 4 + rnd() * 3 },
        { x: H * (0.3 + rnd() * 0.3), edge: 'left' as const, s: 4 + rnd() * 3 },
        { x: W * (0.55 + rnd() * 0.15), edge: 'bottom' as const, s: 3 + rnd() * 3 },
      ],
    };
  }, [W, H, seed]);

  const flakeN = Math.round(g.flakes.length * clamp01((t - 0.25) / 0.75));
  const nickN = t > 0.7 ? (t > 0.88 ? 3 : 2) : 0;
  const ear = t > 0.5 ? 9 + 15 * clamp01((t - 0.5) / 0.5) : 0;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* ink rubbed off by years in a pocket */}
      {g.flakes.slice(0, flakeN).map((f, i) => (
        <View
          key={`k${i}`}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: f.s,
            height: f.s,
            borderRadius: f.s / 2,
            backgroundColor: paper,
            opacity: 0.6,
          }}
        />
      ))}

      {/* nicks bitten out of the edges */}
      {g.nicks.slice(0, nickN).map((n, i) => (
        <View
          key={`n${i}`}
          style={{
            position: 'absolute',
            left: n.edge === 'left' ? -n.s / 2 : n.x - n.s / 2,
            top: n.edge === 'left' ? n.x - n.s / 2 : H - n.s / 2,
            width: n.s,
            height: n.s,
            backgroundColor: SCREEN_BG,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}

      {/* mended with tape, right across the main fold */}
      {t > 0.85 ? (
        <View
          style={{
            position: 'absolute',
            left: W / 2 - 15,
            top: -4,
            width: 30,
            height: 13,
            backgroundColor: 'rgba(226,200,124,0.42)',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(150,120,50,0.45)',
            transform: [{ rotate: '-7deg' }],
          }}
        />
      ) : null}

      {/* bottom-right corner folded over */}
      {ear > 0 ? (
        <>
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 0,
              height: 0,
              borderLeftWidth: ear,
              borderBottomWidth: ear,
              borderLeftColor: 'transparent',
              borderBottomColor: SCREEN_BG,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: -1.5,
              bottom: -1.5,
              width: 0,
              height: 0,
              borderLeftWidth: ear,
              borderTopWidth: ear,
              borderLeftColor: 'rgba(40,25,8,0.28)',
              borderTopColor: 'transparent',
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 0,
              height: 0,
              borderLeftWidth: ear,
              borderTopWidth: ear,
              borderLeftColor: flap,
              borderTopColor: 'transparent',
            }}
          />
        </>
      ) : null}
    </View>
  );
}

/* ============================ stub ================================= */

function StubFace(p: HikeCardFaceProps) {
  const t = clamp01(p.age ?? getHikeAge(p.hikeDate, p.endDate));
  const pal = useMemo(() => agePalette(p.canEdit, t), [p.canEdit, t]);
  const seed = useMemo(() => hashSeed(String(p.hikeId)), [p.hikeId]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const fade = 1 - 0.2 * t; // ink thins out
  const weatherColor = paperWeatherColor(p.weather?.code, pal.label);

  return (
    <View
      style={[s.stubRoot, { backgroundColor: pal.paper }]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const h = Math.round(e.nativeEvent.layout.height);
        setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
      }}
    >
      {box.w > 0 ? <PaperUnderlay W={box.w} H={box.h} t={t} seed={seed} /> : null}

      <View style={s.stubTop}>
        <Text style={[s.stubNo, { color: pal.label }]}>No. {shortNo(p.hikeId)}</Text>
        {p.weather ? (
          <Ionicons name={p.weather.name as any} size={13} color={weatherColor} style={{ opacity: fade }} />
        ) : null}
      </View>

      <View style={s.stubBody}>
        <View style={{ flexShrink: 1 }}>
          <Text
            style={[s.stubTime, { color: pal.ink, opacity: fade }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {p.timePrimary}
          </Text>
          <Text
            style={[s.stubSub, { color: pal.label }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {p.timeSecondary}
          </Text>
        </View>
        {!p.canEdit ? (
          <View style={[s.sharedStamp, { borderColor: pal.ink, opacity: 0.85 - 0.35 * t }]}>
            <Text style={[s.sharedStampText, { color: pal.ink }]}>SHARED</Text>
          </View>
        ) : null}
      </View>

      {/* perforation, with punched half-circles on both edges */}
      <View style={s.perfRow}>
        <View style={[s.perfLine, { borderColor: pal.perf }]} />
        <View style={[s.notch, { left: -7 }]} />
        <View style={[s.notch, { right: -7 }]} />
      </View>

      <View style={s.stubFoot}>
        <Text
          style={[s.stubDate, { color: pal.ink, opacity: fade }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {p.dateText}
        </Text>
        {hasGroupOf(p.group) ? (
          <Text style={[s.stubGroup, { color: pal.label }]}>Group of {p.group}</Text>
        ) : null}
      </View>

      {box.w > 0 ? (
        <PaperOverlay W={box.w} H={box.h} t={t} seed={seed} paper={pal.paper} flap={pal.flap} />
      ) : null}
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
  stubRoot: { borderRadius: 3, overflow: 'hidden' },
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