import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from './ModalScrim';
import { formatDisplayDate, formatDisplayTime } from './PickerModals';

/* ------------------------------------------------------------------ */
/* Hike permit modal                                                   */
/*  - mode "approved":  permit slides in, SAKA stamp slams onto it     */
/*  - mode "cancelled": permit appears, then is ripped in half         */
/* Replaces the normal "Hike scheduled" toast.                         */
/* ------------------------------------------------------------------ */

const PAPER = '#F2E8D0';
const PAPER_EDGE = '#CDB88A';
const INK_DARK = '#1B2433';
const LABEL = 'rgba(90,70,35,0.7)';
const DEFAULT_INK = '#2E6B4A'; // stamp ink (forest green). Try '#B3261E' for classic red.
const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });
const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });
const TILT = '-2.4deg'; // the permit lands on the "table" slightly crooked

// Layout. Wide screens (landscape / tablet): permit on the left, details on the right.
// Narrow screens: permit centred, caption hanging under it.
const SIDE_BY_SIDE_MIN_WIDTH = 640;
const PANEL_GAP = 48; // room between the permit and the details (also clears the tilt + shadow)
const CAPTION_GAP = 34; // stacked layout: clears the paper's shadow and tilted corners
const RIP_DROP = 0.18; // stacked layout: how far (x card height) the pile reaches below the card
// Moves ONLY where the ripped pile ENDS UP. The permit still starts and tears at its normal spot,
// then the pile settles here as the halves drop. Positive x = right, positive y = down.
const RIPPED_PERMIT_OFFSET = { x: 0, y: -30 };
const OVERLAP = 1; // px the left half tucks under the right one, so no hairline shows along the fold

/* ---- tuning ---- */
// How the two torn halves settle into the pile.
// Lower stiffness = slower. Lower damping = more bounce. (Old values felt like ~0.3s, this is ~1s.)
const RIP_SPRING = { stiffness: 24, damping: 7.5, mass: 1 };
const CAPTION_AFTER_RIP = 900; // ms after the halves let go before the text fades in

export type PermitMode = 'approved' | 'cancelled';

export interface PermitDetails {
  mountain?: string;
  dateLabel: string;
  timeLabel: string;
  groupLabel?: string;
  permitNo?: string;
}

export interface SavedHikeLike {
  date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  tagalongs?: number;
}

/** Turns a saved hike into the text shown on the permit. */
export const buildPermitDetails = (
  hike: SavedHikeLike,
  mountainName?: string | null
): PermitDetails => {
  const hasRange = !!hike.end_date && hike.end_date !== hike.date;
  const start = formatDisplayTime(hike.start_time);
  const end = formatDisplayTime(hike.end_time);
  return {
    mountain: mountainName ?? undefined,
    dateLabel: hasRange
      ? `${formatDisplayDate(hike.date)} → ${formatDisplayDate(hike.end_date as string)}`
      : formatDisplayDate(hike.date),
    timeLabel: start && end ? `${start} – ${end}` : start || end || '',
    groupLabel: hike.tagalongs ? `Group of ${hike.tagalongs}` : undefined,
  };
};

const makePermitNo = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SK-${stamp}-${rand}`;
};

// Small deterministic random so the ink gaps / torn teeth are stable between renders
const seeded = (start: number) => {
  let seed = start;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

const safeVibrate = (pattern: number | number[]) => {
  try {
    Vibration.vibrate(pattern);
  } catch {
    /* vibration is optional */
  }
};

/* ===================== stamp timeline (one native clock) ===================== */
/*
 * The whole stamp (lift, hover, slam, paper dip, ring-out, ink rings, flecks) used to be a
 * chain of separate Animated.sequence / .start() callbacks. Each hand-off goes through the
 * JS thread, so the impact effects started a few frames AFTER the stamp landed = choppy.
 *
 * Now it is ONE linear 0 -> 1 timing running natively. Every moving part is a pre-sampled
 * curve (one keyframe per frame) of that single clock, so nothing waits on JS mid-slam.
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

// RN's tension/friction -> real spring numbers, so the curves match the old Animated.spring feel
const origami = (tension: number, friction: number) => ({
  stiffness: (tension - 30) * 3.62 + 194,
  damping: (friction - 8) * 3 + 25,
});

/** Where a spring released from `x0` (at rest) is after `ms`, relative to its target (0). */
const springDisp = (ms: number, cfg: { stiffness: number; damping: number }, x0: number) => {
  const t = ms / 1000;
  const w0 = Math.sqrt(cfg.stiffness);
  const z = cfg.damping / (2 * w0);
  if (z >= 1) return x0 * Math.exp(-w0 * t) * (1 + w0 * t);
  const wd = w0 * Math.sqrt(1 - z * z);
  return x0 * Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
};

const STAMP_STEP = 16; // ms between keyframes (about one frame)
const STAMP_LIFT_END = 256; // stamp rises and hovers...
const STAMP_HOLD_END = 384; // ...holds a beat...
const STAMP_IMPACT = 544; // ...then slams down (160 ms)
const STAMP_TOTAL = 1264; // everything has finished ringing out

const PRESS_SPRING = origami(180, 7);
const SHAKE_SPRING = origami(260, 4.2);
const SQUASH_SPRING = origami(200, 5);

const sinceImpact = (ms: number) => Math.max(0, ms - STAMP_IMPACT);

/** 0 held high -> 0.35 hovering -> 1 slammed */
const liftAt = (ms: number) => {
  if (ms <= STAMP_LIFT_END) return 0.35 * easeOutCubic(ms / STAMP_LIFT_END);
  if (ms <= STAMP_HOLD_END) return 0.35;
  if (ms < STAMP_IMPACT) {
    return 0.35 + 0.65 * easeInCubic((ms - STAMP_HOLD_END) / (STAMP_IMPACT - STAMP_HOLD_END));
  }
  return 1;
};
const lerp3 = (v: number, a: number, b: number, c: number) =>
  v <= 0.35 ? a + (b - a) * (v / 0.35) : b + (c - b) * ((v - 0.35) / 0.65);

const stampOpacityAt = (ms: number) => {
  // never exactly 0, so the stamp is already drawn (logo decoded) before it becomes visible
  if (ms <= STAMP_LIFT_END) return Math.max(0.003, 0.6 * smooth(ms / STAMP_LIFT_END));
  if (ms <= STAMP_HOLD_END) return 0.6;
  return 0.6 + 0.34 * smooth(clamp01((ms - STAMP_HOLD_END) / 96));
};
const squashAt = (ms: number) =>
  ms <= STAMP_IMPACT ? 1 : 1 + springDisp(sinceImpact(ms), SQUASH_SPRING, -0.1);
const pressAt = (ms: number) => {
  if (ms <= STAMP_IMPACT) return 0;
  const t = sinceImpact(ms);
  return t <= 48 ? easeOutQuad(t / 48) : springDisp(t - 48, PRESS_SPRING, 1);
};
const shakeAt = (ms: number) => (ms <= STAMP_IMPACT ? 0 : springDisp(sinceImpact(ms), SHAKE_SPRING, 1));
const ring1At = (ms: number) => easeOutQuad(clamp01(sinceImpact(ms) / 520));
const ring2At = (ms: number) => easeOutQuad(clamp01((sinceImpact(ms) - 90) / 620));
const splatAt = (ms: number) => easeOutCubic(clamp01(sinceImpact(ms) / 560));

const buildStampTracks = (clock: Animated.Value) => {
  const make = (fn: (ms: number) => number) => {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    for (let ms = 0; ms <= STAMP_TOTAL; ms += STAMP_STEP) {
      inputRange.push(ms / STAMP_TOTAL);
      outputRange.push(fn(ms));
    }
    return clock.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  };
  return {
    opacity: make(stampOpacityAt),
    scale: make((ms) => lerp3(liftAt(ms), 2.6, 2.05, 1) * squashAt(ms)),
    rotate: make((ms) => lerp3(liftAt(ms), -30, -24, -12)).interpolate({
      inputRange: [-90, 90],
      outputRange: ['-90deg', '90deg'],
    }),
    pressScale: make((ms) => 1 - 0.025 * pressAt(ms)), // paper dips under the stamp
    shake: make(shakeAt), // the whole permit rings like a struck bell
    // two ink rings: invisible until the moment of impact
    ring1Opacity: make((ms) => (ms <= STAMP_IMPACT ? 0 : 0.55 * (1 - ring1At(ms)))),
    ring1Scale: make((ms) => 1 + 0.7 * ring1At(ms)),
    ring2Opacity: make((ms) => (ms <= STAMP_IMPACT ? 0 : 0.35 * (1 - ring2At(ms)))),
    ring2Scale: make((ms) => 1 + 1.2 * ring2At(ms)),
    splat: make(splatAt), // 0 -> 1 progress of the flung ink flecks
  };
};

/* ===================== soft shadow (no native shadow) ===================== */
/*
 * Native shadows (shadow* props / elevation) are computed from everything inside the view.
 * The permit has ~150 child views, so every animated frame re-did that work, and on Android
 * elevation also re-sorts sibling draw order. This is a stack of faint rounded rects instead:
 * static, cheap, identical on both platforms. The halves use one-sided versions so a half
 * never casts a shadow across the fold onto its neighbour.
 */
function SoftShadow({
  W,
  H,
  spreadLeft = true,
  spreadRight = true,
}: {
  W: number;
  H: number;
  spreadLeft?: boolean;
  spreadRight?: boolean;
}) {
  const LIFT = 10;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      {Array.from({ length: 8 }, (_, i) => {
        const spread = i * 2.2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: spreadLeft ? -spread : 0,
              right: spreadRight ? -spread : 0,
              top: LIFT - spread,
              bottom: -(LIFT + spread),
              borderRadius: 6 + spread,
              backgroundColor: 'rgba(0,0,0,0.05)',
            }}
          />
        );
      })}
    </View>
  );
}

/* ============================ stamp ================================ */

function StampMark({
  size,
  ink,
  logoSource,
  onReady,
}: {
  size: number;
  ink: string;
  logoSource?: ImageSourcePropType;
  /** Called once the logo has loaded (immediately when there is no logo file). */
  onReady?: () => void;
}) {
  // Little gaps in the ink make it read as a real rubber stamp
  const specks = useMemo(() => {
    const rnd = seeded(11);
    return Array.from({ length: 18 }, () => ({
      x: rnd() * size,
      y: rnd() * size,
      s: 2 + rnd() * 4,
      o: 0.7 + rnd() * 0.3,
    }));
  }, [size]);

  const logoSize = size * 1.34;
  const inner = size - 14;

  // no logo file to wait for -> the text fallback is ready straight away
  useEffect(() => {
    if (!logoSource) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: ink,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 7,
          left: 7,
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: 1.5,
          borderColor: ink,
        }}
      />

      <View style={[styles.stampLogoWrap, { top: 0, width: size, height: size, justifyContent: 'center' }]}>
        {logoSource ? (
          <Image
            source={logoSource}
            style={{
              width: logoSize,
              height: logoSize,
              tintColor: ink,
              transform: [{ translateX: -0.9 }, { translateY: -10 }],
            }}
            resizeMode="contain"
            fadeDuration={0} // Android fades images in over 300ms by default: the logo would pop in mid-slam
            onLoad={onReady}
            onError={onReady}
          />
        ) : (
          <Text style={{ color: ink, fontWeight: '900', fontSize: size * 0.24, letterSpacing: 2 }}>
            SAKA
          </Text>
        )}
      </View>

      <View style={[styles.stampBanner, { top: size * 0.69, borderColor: ink }]}>
        <Text style={[styles.stampBannerText, { color: ink, fontSize: size * 0.105 }]}>
          APPROVED
        </Text>
      </View>

      {specks.map((sp, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: sp.x,
            top: sp.y,
            width: sp.s,
            height: sp.s,
            borderRadius: sp.s / 2,
            backgroundColor: PAPER,
            opacity: sp.o,
          }}
        />
      ))}
    </View>
  );
}

/* ============================ paper texture ======================== */

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

  // offset / size are measured across the 12px-wide crease band
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
        const a = strength * k;
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

/** Worn rim, paper flecks, loose fibres and two folds. The vertical fold sits exactly where the permit tears. */
function PaperTexture({ W, H }: { W: number; H: number }) {
  const { specks, fibres } = useMemo(() => {
    const rnd = seeded(77);
    return {
      specks: Array.from({ length: 30 }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        s: 1 + rnd() * 2.2,
        o: 0.08 + rnd() * 0.14,
      })),
      fibres: Array.from({ length: 9 }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        l: 6 + rnd() * 12,
        r: rnd() * 180,
        o: 0.07 + rnd() * 0.08,
      })),
    };
  }, [W, H]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.edgeWear} />
      {specks.map((sp, i) => (
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
      {fibres.map((f, i) => (
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
      <Crease vertical at={W / 2} length={H} strength={1} seed={3} />
      <Crease at={H / 2} length={W} strength={0.55} seed={9} />
    </View>
  );
}

/* ============================ permit face ========================== */

function PermitField({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value || '—'}
      </Text>
    </View>
  );
}

function PermitFace({
  W,
  H,
  details,
  permitNo,
  stampSize,
  stamp,
}: {
  W: number;
  H: number;
  details: PermitDetails;
  permitNo: string;
  stampSize: number;
  stamp?: React.ReactNode;
}) {
  return (
    <View
      style={[styles.face, { width: W, height: H }]}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <View style={styles.faceFrame} pointerEvents="none" />
      <PaperTexture W={W} H={H} />

      <View style={styles.faceHeader}>
        <View>
          <Text style={styles.brand}>SAKA</Text>
          <Text style={styles.docTitle}>Hiking Permit</Text>
        </View>
        <Text style={styles.permitNo}>No. {permitNo}</Text>
      </View>

      <View style={styles.perforation} />

      <View style={[styles.fields, { paddingRight: stampSize - 4 }]}>
        <PermitField label="Mountain" value={details.mountain ?? ''} />
        <PermitField label="Date" value={details.dateLabel} />
        <PermitField
          label={details.groupLabel ? 'Time · Group' : 'Time'}
          value={details.groupLabel ? `${details.timeLabel}  ·  ${details.groupLabel}` : details.timeLabel}
        />
      </View>

      <Text style={styles.footnote}>Be home by your end time. Hike safe.</Text>

      {stamp ? <View style={[styles.stampSlot, { width: stampSize, height: stampSize }]}>{stamp}</View> : null}
    </View>
  );
}

/* ============================ torn edge ============================ */

function Teeth({
  H,
  side,
  opacity,
}: {
  H: number;
  side: 'left' | 'right';
  /** One fade for the whole edge: it is ragged from the very first pull, never a clean cut. */
  opacity: ReturnType<Animated.Value['interpolate']>;
}) {
  const teeth = useMemo(() => {
    const rnd = seeded(side === 'left' ? 5 : 23);
    const out: { y: number; s: number; fibre: number; fa: number; fy: number }[] = [];
    for (let y = side === 'left' ? 4 : 0; y < H; y += 9) {
      out.push({ y, s: 6 + rnd() * 6, fibre: 3 + rnd() * 5, fa: (rnd() - 0.5) * 50, fy: rnd() * 6 });
    }
    return out;
  }, [H, side]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.teeth, side === 'right' ? { right: -5 + OVERLAP } : { left: -5 }, { opacity }]}
    >
      {teeth.map((t, i) => (
        <React.Fragment key={i}>
          <View
            style={{
              position: 'absolute',
              left: 5 - t.s / 2,
              top: t.y - t.s / 2,
              width: t.s,
              height: t.s,
              backgroundColor: PAPER,
              transform: [{ rotate: '45deg' }],
            }}
          />
          {/* a loose fibre of the paper's pale core, pulled out of the tear */}
          <View
            style={{
              position: 'absolute',
              left: side === 'right' ? 5 : 5 - t.fibre,
              top: t.y + t.fy - 3,
              width: t.fibre,
              height: 0.8,
              backgroundColor: 'rgba(255,252,240,0.85)',
              transform: [{ rotate: `${t.fa}deg` }],
            }}
          />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

/* ============================ details panel ======================== */

/** Each block fades up on its own slice of the 0 -> 1 progress, so the panel reads top to bottom. */
const reveal = (progress: Animated.Value, start: number, end: number) => ({
  opacity: progress.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
  transform: [
    {
      translateY: progress.interpolate({ inputRange: [start, end], outputRange: [14, 0], extrapolate: 'clamp' }),
    },
  ],
});

function InfoPanel({
  approved,
  details,
  permitNo,
  compact,
  progress,
}: {
  approved: boolean;
  details: PermitDetails;
  permitNo: string;
  compact: boolean;
  progress: Animated.Value;
}) {
  const rows = (
    [
      ['Permit no.', permitNo],
      ['Mountain', details.mountain],
      ['Date', details.dateLabel],
      ['Time', details.timeLabel],
      ['Group', details.groupLabel],
    ] as [string, string | undefined][]
  ).filter(([, v]) => !!v) as [string, string][];

  return (
    <View>
      <Animated.View style={reveal(progress, 0, 0.4)}>
        <Text style={styles.infoTitle}>{approved ? 'Hike scheduled' : 'Hike cancelled'}</Text>
      </Animated.View>
      <Animated.View style={reveal(progress, 0.1, 0.5)}>
        <Text style={[styles.infoStatus, { color: approved ? '#8FC4A0' : '#E49A8C' }]}>
          {approved ? 'Added to your calendar' : 'Permit voided'}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.infoRule, reveal(progress, 0.2, 0.55)]} />

      <Animated.View style={reveal(progress, 0.3, 0.7)}>
        <Text style={styles.infoBody}>
          {approved
            ? 'Your permit is stamped and saved to the calendar. Tap the hike any time to change the time or the group, or hold it to cancel.'
            : 'This hike is off the calendar and its permit is voided. You can plan another hike for this day whenever you are ready.'}
        </Text>
      </Animated.View>

      {!compact && rows.length > 0 ? (
        <View style={styles.infoRows}>
          {rows.map(([label, value], i) => (
            <Animated.View
              key={label}
              style={[styles.infoRow, reveal(progress, 0.42 + i * 0.07, 0.8 + i * 0.04)]}
            >
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={[styles.infoValue, !approved && styles.infoValueVoid]} numberOfLines={2}>
                {value}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}

      <Animated.View style={reveal(progress, 0.7, 1)}>
        <Text style={styles.infoHint}>Tap anywhere to continue</Text>
      </Animated.View>
    </View>
  );
}

/* ============================ the modal ============================ */

interface HikePermitModalProps {
  visible: boolean;
  mode: PermitMode;
  details: PermitDetails;
  /** The SAKA logo. A transparent PNG works best (it is drawn in stamp ink). */
  logoSource?: ImageSourcePropType;
  inkColor?: string;
  /** Closes by itself this many ms after the animation ends. Default 0 = only closes when tapped. */
  autoCloseMs?: number;
  onDone: () => void;
}

function HikePermitModalImpl({
  visible,
  mode,
  details,
  logoSource,
  inkColor = DEFAULT_INK,
  autoCloseMs = 0,
  onDone,
}: HikePermitModalProps) {
  const { width, height } = useWindowDimensions();
  const approved = mode === 'approved';
  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH;

  // Original permit size. Only in side-by-side does it give up a little width, and
  // only when the details panel would otherwise get too narrow to read.
  let W = Math.min(width - 48, 380);
  if (sideBySide) W = Math.min(W, Math.max(260, width - 48 - PANEL_GAP - 220));
  W = Math.floor(W / 2) * 2; // even, so the two halves meet on a whole pixel
  const H = Math.round(Math.max(170, Math.min(W * 0.58, height - 130)));
  const rowW = Math.min(width - 48, W * 2 + PANEL_GAP);
  const infoW = rowW - W - PANEL_GAP;
  const stampSize = Math.round(Math.min(112, H * 0.52));
  const permitNo = useMemo(() => details.permitNo ?? makePermitNo(), [details.permitNo]);

  // Animation values
  const enter = useRef(new Animated.Value(0)).current; // permit drops in (spring, overshoots)
  const tense = useRef(new Animated.Value(0)).current; // cancel: paper tightens before it tears
  // approved: the stamp runs on ONE native clock; lift, slam, dip, rings and flecks are curves of it
  const stampT = useRef(new Animated.Value(0)).current;
  const stamp = useMemo(() => buildStampTracks(stampT), [stampT]);
  const logoReady = useRef(!logoSource); // the stamp waits (briefly) for the logo to be decoded
  const shake = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const tear = useRef(new Animated.Value(0)).current; // cancel: how far the tear has travelled down the fold
  const rip = useRef(new Animated.Value(0)).current; // cancel: the halves part and drop into a pile
  const bits = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;

  // Ink flecks thrown off by the stamp
  const splatSpecs = useMemo(() => {
    const rnd = seeded(19);
    return Array.from({ length: 12 }, (_, i) => ({
      a: (i / 12) * Math.PI * 2 + rnd() * 0.4,
      dist: 12 + rnd() * 24,
      s: 2.5 + rnd() * 3,
    }));
  }, []);

  // Scraps of paper that fall out of the tear, each one as the tear passes its height
  const bitSpecs = useMemo(() => {
    const rnd = seeded(41);
    return Array.from({ length: 18 }, () => {
      const y = rnd() * H;
      return {
        x: W / 2 + (rnd() - 0.5) * 16,
        y,
        start: (y / H) * 0.6, // where on the 0 -> 1 fall timeline this scrap lets go
        s: 3 + rnd() * 4,
        fall: 50 + rnd() * 100,
        drift: (rnd() - 0.5) * 60,
        rot: (rnd() - 0.5) * 540,
        edge: rnd() > 0.5,
      };
    });
  }, [W, H]);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const scheduleClose = () => {
      if (autoCloseMs > 0) later(() => onDoneRef.current(), autoCloseMs);
    };
    // Long ease-out: fast start, very soft landing
    const showCaption = () =>
      Animated.timing(caption, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();

    // Permit drops onto the table: a spring, so it overshoots and settles instead of stopping dead
    later(() => {
      Animated.spring(enter, { toValue: 1, tension: 55, friction: 8.5, useNativeDriver: true }).start();
    }, 60);

    if (mode === 'approved') {
      const runStamp = () => {
        Animated.timing(stampT, {
          toValue: 1,
          duration: STAMP_TOTAL,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
        // haptics + caption only need to land roughly on the impact; the visuals are already scheduled natively
        later(() => safeVibrate([0, 40, 25, 12]), STAMP_IMPACT);
        later(showCaption, STAMP_IMPACT + 180);
        later(scheduleClose, STAMP_IMPACT);
      };
      // never slam an undecoded logo: wait for it (max ~0.7s more), so it does not pop in mid-flight
      let waited = 0;
      const tryStart = () => {
        if (logoReady.current || waited >= 700) {
          runStamp();
          return;
        }
        waited += 50;
        later(tryStart, 50);
      };
      later(tryStart, 820);
    } else {
      later(() => {
        // 1. Anticipation: the paper tightens and trembles harder and harder
        safeVibrate(18);
        const amp = [0.3, -0.45, 0.6, -0.8, 0.95, -1, 0.7, -0.5, 0];
        Animated.parallel([
          Animated.timing(tense, { toValue: 1, duration: 720, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence(
            amp.map((v) => Animated.timing(shake, { toValue: v, duration: 80, useNativeDriver: true }))
          ),
          Animated.sequence(
            amp.map((v) => Animated.timing(wiggle, { toValue: v, duration: 80, useNativeDriver: true }))
          ),
        ]).start(({ finished }) => {
          if (!finished) return;

          // 2. The tear travels down the fold in three pulls. It starts reluctantly, the hand
          //    regrips, it rips steadily, regrips again, then the last fibres give way.
          const jerk = (strength: number) => {
            shake.setValue(strength);
            Animated.spring(shake, { toValue: 0, tension: 240, friction: 5, useNativeDriver: true }).start();
          };
          safeVibrate([0, 22]);
          jerk(0.5);
          // scraps start falling as the tear reaches them
          Animated.timing(bits, {
            toValue: 1,
            duration: 2500,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start();
          later(() => {
            safeVibrate([0, 20]);
            jerk(0.7);
          }, 660);
          later(() => {
            safeVibrate([0, 16, 24, 16]);
            jerk(0.9);
          }, 1420);

          Animated.sequence([
            Animated.timing(tear, { toValue: 0.2, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.delay(140),
            Animated.timing(tear, { toValue: 0.58, duration: 680, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.delay(80),
            Animated.timing(tear, { toValue: 1, duration: 460, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]).start(({ finished: torn }) => {
            if (!torn) return;

            // 3. The last fibres snap and the halves drop onto the table, settling slowly
            safeVibrate([0, 35, 40, 55]);
            Animated.parallel([
              Animated.spring(rip, { toValue: 1, ...RIP_SPRING, useNativeDriver: true }),
              Animated.timing(tense, { toValue: 0, duration: 700, useNativeDriver: true }),
            ]).start();
            later(showCaption, CAPTION_AFTER_RIP);
            scheduleClose();
          });
        });
      }, 1100);
    }

    return () => {
      timers.forEach(clearTimeout);
      [enter, tense, stampT, shake, wiggle, tear, rip, bits, caption].forEach((v) => v.stopAnimation());
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
    };
    // Runs once per mount; useHikePermit re-mounts this for every show().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const pressScale = stamp.pressScale;
  const tenseScale = tense.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  const cardStyle = {
    opacity: enter.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [
      { translateX: rip.interpolate({ inputRange: [0, 1], outputRange: [0, RIPPED_PERMIT_OFFSET.x] }) },
      { translateY: rip.interpolate({ inputRange: [0, 1], outputRange: [0, RIPPED_PERMIT_OFFSET.y] }) },
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
      { scale: Animated.multiply(Animated.multiply(enterScale, pressScale), tenseScale) },
      { translateX: Animated.add(shake, stamp.shake).interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) },
      { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', TILT] }) },
    ],
  };

  // Ripped halves. A real tear opens like a V: both halves stay joined at the bottom of the fold
  // while the top pulls apart, so each half hinges on the bottom of the fold (W/2, H). When the
  // tear reaches the bottom they drop and settle into a loose pile in the middle of the box.
  // The right half is last in the tree, so it lands on top.
  const HINGE = 15; // degrees the halves open to just before the last fibres give way
  const LEFT_END = -9; // final tilt of each half in the pile
  const RIGHT_END = 6;

  // Where a half ends up if it is turned by `deg` about the hinge: the shift needed so its centre
  // lands on (cx, cy). Both halves hinge on the card point (W/2, H).
  const settle = (c0x: number, deg: number, cx: number, cy: number) => {
    const a = (deg * Math.PI) / 180;
    const vx = c0x - W / 2;
    const vy = H / 2 - H;
    const x = W / 2 + vx * Math.cos(a) - vy * Math.sin(a);
    const y = H + vx * Math.sin(a) + vy * Math.cos(a);
    return { x: cx - x, y: cy - y };
  };
  const leftEnd = settle(W / 4, LEFT_END, W * 0.47, H * 0.6);
  const rightEnd = settle((W * 3) / 4, RIGHT_END, W * 0.525, H * 0.57);

  // How wide the V is as the tear travels: slow at first, wider as it gets going
  const tearAngle = (sign: number) =>
    tear.interpolate({
      inputRange: [0, 0.2, 0.58, 1],
      outputRange: [0, sign * HINGE * 0.27, sign * HINGE * 0.67, sign * HINGE],
    });
  const pull = W * 0.02; // each hand drifts outward a little as it pulls

  const half = (side: 'left' | 'right') => {
    const sign = side === 'left' ? -1 : 1;
    const end = side === 'left' ? leftEnd : rightEnd;
    const endDeg = side === 'left' ? LEFT_END : RIGHT_END;
    const dx = side === 'left' ? W / 4 - OVERLAP / 2 : -W / 4; // from the half's centre to the hinge
    return {
      transform: [
        {
          translateX: Animated.add(
            tear.interpolate({ inputRange: [0, 1], outputRange: [0, sign * pull] }),
            rip.interpolate({ inputRange: [0, 1], outputRange: [0, end.x - sign * pull] })
          ),
        },
        { translateY: rip.interpolate({ inputRange: [0, 1], outputRange: [0, end.y] }) },
        { translateX: dx },
        { translateY: H / 2 },
        {
          rotate: Animated.add(
            Animated.add(tearAngle(sign), Animated.multiply(wiggle, 1.2)),
            rip.interpolate({ inputRange: [0, 1], outputRange: [0, endDeg - sign * HINGE] })
          ).interpolate({ inputRange: [-60, 60], outputRange: ['-60deg', '60deg'] }),
        },
        { translateY: -H / 2 },
        { translateX: -dx },
      ],
    };
  };
  const leftHalf = half('left');
  const rightHalf = half('right');

  const { splat } = stamp;

  // The torn edge is ragged from the very first pull (no clean straight cut ever shows).
  // Shadows hand over from the whole sheet to the two halves as they come apart.
  const teethOpacity = tear.interpolate({ inputRange: [0, 0.06], outputRange: [0, 1], extrapolate: 'clamp' });
  const sheetShadowFade = tear.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
  const halfShadowFade = tear.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const staticStamp = (
    <View style={{ opacity: 0.9, transform: [{ rotate: '-12deg' }] }}>
      <StampMark size={stampSize} ink={inkColor} logoSource={logoSource} />
    </View>
  );

  const card = (
          <Animated.View style={[{ width: W, height: H }, cardStyle]}>
            {approved ? (
              <>
                <SoftShadow W={W} H={H} />
                <PermitFace W={W} H={H} details={details} permitNo={permitNo} stampSize={stampSize} />
                <View
                  pointerEvents="none"
                  style={[styles.stampSlot, { width: stampSize, height: stampSize }]}
                >
                  {/* two ink rings on impact */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: stampSize / 2,
                        borderWidth: 2.5,
                        borderColor: inkColor,
                        opacity: stamp.ring1Opacity,
                        transform: [{ scale: stamp.ring1Scale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: stampSize / 2,
                        borderWidth: 1.5,
                        borderColor: inkColor,
                        opacity: stamp.ring2Opacity,
                        transform: [{ scale: stamp.ring2Scale }],
                      },
                    ]}
                  />
                  {/* ink flecks flung off the stamp */}
                  {splatSpecs.map((d, i) => {
                    const r0 = stampSize * 0.46;
                    return (
                      <Animated.View
                        key={i}
                        style={{
                          position: 'absolute',
                          left: stampSize / 2 - d.s / 2,
                          top: stampSize / 2 - d.s / 2,
                          width: d.s,
                          height: d.s,
                          borderRadius: d.s / 2,
                          backgroundColor: inkColor,
                          opacity: splat.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.85, 0] }),
                          transform: [
                            {
                              translateX: splat.interpolate({
                                inputRange: [0, 1],
                                outputRange: [Math.cos(d.a) * r0, Math.cos(d.a) * (r0 + d.dist)],
                              }),
                            },
                            {
                              translateY: splat.interpolate({
                                inputRange: [0, 1],
                                outputRange: [Math.sin(d.a) * r0, Math.sin(d.a) * (r0 + d.dist)],
                              }),
                            },
                            { scale: splat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
                          ],
                        }}
                      />
                    );
                  })}
                  <Animated.View
                    style={{
                      opacity: stamp.opacity,
                      transform: [{ rotate: stamp.rotate }, { scale: stamp.scale }],
                    }}
                  >
                    <StampMark
                      size={stampSize}
                      ink={inkColor}
                      logoSource={logoSource}
                      onReady={() => {
                        logoReady.current = true;
                      }}
                    />
                  </Animated.View>
                </View>
              </>
            ) : (
              <>
                {/* whole-sheet shadow: fades out as the halves come apart */}
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { opacity: sheetShadowFade }]}
                >
                  <SoftShadow W={W} H={H} />
                </Animated.View>
                <Animated.View style={[styles.half, { left: 0, width: W / 2 + OVERLAP, height: H }, leftHalf]}>
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: halfShadowFade }]}>
                    <SoftShadow W={W / 2 + OVERLAP} H={H} spreadRight={false} />
                  </Animated.View>
                  <View style={{ width: W / 2 + OVERLAP, height: H, overflow: 'hidden' }}>
                    <PermitFace
                      W={W}
                      H={H}
                      details={details}
                      permitNo={permitNo}
                      stampSize={stampSize}
                      stamp={staticStamp}
                    />
                  </View>
                  <Teeth H={H} side="right" opacity={teethOpacity} />
                </Animated.View>
                <Animated.View style={[styles.half, { left: W / 2, width: W / 2, height: H }, rightHalf]}>
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: halfShadowFade }]}>
                    <SoftShadow W={W / 2} H={H} spreadLeft={false} />
                  </Animated.View>
                  <View style={{ width: W / 2, height: H, overflow: 'hidden' }}>
                    <View style={{ marginLeft: -W / 2 }}>
                      <PermitFace
                        W={W}
                        H={H}
                        details={details}
                        permitNo={permitNo}
                        stampSize={stampSize}
                        stamp={staticStamp}
                      />
                    </View>
                  </View>
                  <Teeth H={H} side="left" opacity={teethOpacity} />
                </Animated.View>
                {/* scraps of paper falling out of the tear */}
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {bitSpecs.map((b, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: b.x,
                        top: b.y,
                        width: b.s,
                        height: b.s * 0.7,
                        backgroundColor: b.edge ? PAPER_EDGE : PAPER,
                        opacity: bits.interpolate({
                          inputRange: [0, b.start, b.start + 0.03, 0.85, 1],
                          outputRange: [0, 0, 1, 0.9, 0],
                        }),
                        transform: [
                          {
                            translateX: bits.interpolate({
                              inputRange: [0, b.start, 1],
                              outputRange: [0, 0, b.drift],
                            }),
                          },
                          {
                            translateY: bits.interpolate({
                              inputRange: [0, b.start, 1],
                              outputRange: [0, 0, b.fall],
                            }),
                          },
                          {
                            rotate: bits.interpolate({
                              inputRange: [0, b.start, 1],
                              outputRange: ['0deg', '0deg', `${b.rot}deg`],
                            }),
                          },
                        ],
                      }}
                    />
                  ))}
                </View>
              </>
            )}
          </Animated.View>
  );

  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      animationType="fade"
      visible={visible}
      onRequestClose={() => onDone()}
    >
      <View style={styles.overlay}>
        <ModalScrim color="rgba(5,9,14,0.78)" />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onDone()}>
        <View style={styles.center}>
          {sideBySide ? (
            <View style={[styles.panels, { width: rowW }]}>
              {/* left panel: the permit */}
              <View style={{ width: W, height: H }}>{card}</View>

              <View style={{ width: PANEL_GAP, height: H, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={[styles.panelDivider, { height: H * 0.72, opacity: caption }]} />
              </View>

              {/* right panel: what happened + details, centred on the permit's centre line */}
              <View pointerEvents="none" style={{ width: infoW, height: H, justifyContent: 'center' }}>
                <InfoPanel
                  approved={approved}
                  details={details}
                  permitNo={permitNo}
                  compact={height < 400}
                  progress={caption}
                />
              </View>
            </View>
          ) : (
            <>
              {card}
              {/* Anchored to the centre line of the screen: never moves the card, never clipped by it. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.captionWrap,
                  {
                    marginTop: H / 2 + CAPTION_GAP + (approved ? 0 : H * RIP_DROP),
                    opacity: caption,
                    transform: [
                      { translateY: caption.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                    ],
                  },
                ]}
              >
                <Text style={styles.captionTitle}>{approved ? 'Hike scheduled' : 'Hike cancelled'}</Text>
                <Text style={[styles.captionSub, { color: approved ? '#8FC4A0' : '#E49A8C' }]}>
                  {approved ? 'Added to your calendar' : 'Permit voided'}
                </Text>
                <Text style={styles.captionHint}>Tap anywhere to continue</Text>
              </Animated.View>
            </>
          )}
        </View>
        </Pressable>
      </View>
    </Modal>
  );
}

// memo: a parent re-render while the animation runs must not rebuild the animated nodes mid-flight
export const HikePermitModal = React.memo(HikePermitModalImpl);

/* ============================ hook ================================= */

/**
 * const permit = useHikePermit(require('../../assets/saka-logo.png'));
 * permit.show('approved', buildPermitDetails(savedHike, mountainName));
 * permit.show('cancelled', buildPermitDetails(hike, mountainName));
 * ...and render {permit.element} once in the screen.
 */
export function useHikePermit(logoSource?: ImageSourcePropType, inkColor?: string) {
  const [state, setState] = useState<{
    visible: boolean;
    mode: PermitMode;
    details: PermitDetails | null;
    key: number;
  }>({ visible: false, mode: 'approved', details: null, key: 0 });

  // Small delay so a form modal that is closing at the same moment has fully
  // dismissed first (iOS silently drops a modal presented mid-dismiss).
  const show = useCallback((mode: PermitMode, details: PermitDetails) => {
    setTimeout(() => setState((s) => ({ visible: true, mode, details, key: s.key + 1 })), 350);
  }, []);
  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const element = state.details ? (
    <HikePermitModal
      key={state.key}
      visible={state.visible}
      mode={state.mode}
      details={state.details}
      logoSource={logoSource}
      inkColor={inkColor}
      onDone={hide}
    />
  ) : null;

  return { show, hide, element };
}

/* ============================ styles =============================== */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  /* permit paper */
  face: {
    backgroundColor: PAPER,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PAPER_EDGE,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  edgeWear: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 5,
    borderWidth: 5,
    borderColor: 'rgba(139,101,45,0.07)',
  },
  faceFrame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(120,90,40,0.28)',
  },
  faceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    color: INK_DARK,
    fontFamily: SERIF,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },
  docTitle: {
    color: LABEL,
    fontFamily: SERIF,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  permitNo: {
    color: LABEL,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  perforation: {
    marginTop: 8,
    marginBottom: 8,
    borderTopWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: 'rgba(120,90,40,0.45)',
  },
  fields: {
    gap: 6,
  },
  fieldLabel: {
    color: LABEL,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: INK_DARK,
    fontFamily: SERIF,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  footnote: {
    position: 'absolute',
    left: 16,
    bottom: 10,
    color: LABEL,
    fontFamily: SERIF,
    fontSize: 9,
    fontStyle: 'italic',
  },

  /* stamp */
  stampSlot: {
    position: 'absolute',
    right: 12,
    bottom: 10,
  },
  stampLogoWrap: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
  },
  stampBanner: {
    position: 'absolute',
    left: 3,
    right: 3,
    paddingVertical: 1,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    backgroundColor: PAPER,
    alignItems: 'center',
  },
  stampBannerText: {
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  /* ripped halves */
  // no background / radius / shadow here: the clipped face supplies the paper, so the fold has no notch or shadow seam
  half: {
    position: 'absolute',
    top: 0,
  },
  teeth: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 10,
  },

  /* side-by-side panels */
  panels: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  infoTitle: {
    color: PAPER,
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoStatus: {
    fontFamily: SERIF,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
  infoRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 12,
    marginBottom: 10,
  },
  infoBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  infoRows: {
    marginTop: 12,
    gap: 5,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoLabel: {
    width: 70,
    color: 'rgba(201,169,110,0.8)',
    fontSize: 11,
  },
  infoValue: {
    flex: 1,
    color: PAPER,
    fontFamily: SERIF,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValueVoid: {
    color: 'rgba(242,232,208,0.45)',
    textDecorationLine: 'line-through',
  },
  infoHint: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    marginTop: 14,
  },

  /* caption (stacked layout) */
  captionWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 20,
    elevation: 20,
  },
  captionTitle: {
    color: PAPER,
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  captionSub: {
    fontFamily: SERIF,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },
  captionHint: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    marginTop: 22,
    textAlign: 'center',
  },
});