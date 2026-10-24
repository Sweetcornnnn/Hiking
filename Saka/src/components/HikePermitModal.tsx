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

/* ============================ stamp ================================ */

function StampMark({
  size,
  ink,
  logoSource,
}: {
  size: number;
  ink: string;
  logoSource?: ImageSourcePropType;
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
    <View style={[styles.face, { width: W, height: H }]}>
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
  opacity: Animated.Value;
}) {
  const teeth = useMemo(() => {
    const rnd = seeded(side === 'left' ? 5 : 23);
    const out: { y: number; s: number }[] = [];
    for (let y = side === 'left' ? 4 : 0; y < H; y += 9) {
      out.push({ y, s: 6 + rnd() * 6 });
    }
    return out;
  }, [H, side]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.teeth, side === 'right' ? { right: -5 } : { left: -5 }, { opacity }]}
    >
      {teeth.map((t, i) => (
        <View
          key={i}
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

export function HikePermitModal({
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
  const H = Math.round(Math.max(170, Math.min(W * 0.58, height - 130)));
  const rowW = Math.min(width - 48, W * 2 + PANEL_GAP);
  const infoW = rowW - W - PANEL_GAP;
  const stampSize = Math.round(Math.min(112, H * 0.52));
  const permitNo = useMemo(() => details.permitNo ?? makePermitNo(), [details.permitNo]);

  // Animation values
  const enter = useRef(new Animated.Value(0)).current; // permit drops in (spring, overshoots)
  const press = useRef(new Animated.Value(0)).current; // paper dips under the stamp
  const tense = useRef(new Animated.Value(0)).current; // cancel: paper tightens before it tears
  const stampLift = useRef(new Animated.Value(0)).current; // 0 held high -> 0.35 hovering -> 1 slammed
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampSquash = useRef(new Animated.Value(1)).current; // squash + rebound on impact
  const bloom = useRef(new Animated.Value(0)).current;
  const bloom2 = useRef(new Animated.Value(0)).current;
  const splat = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const rip = useRef(new Animated.Value(0)).current;
  const bits = useRef(new Animated.Value(0)).current;
  const teethOpacity = useRef(new Animated.Value(0)).current;
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

  // Scraps of paper that fall out of the tear
  const bitSpecs = useMemo(() => {
    const rnd = seeded(41);
    return Array.from({ length: 14 }, () => ({
      x: W / 2 + (rnd() - 0.5) * 16,
      y: rnd() * H,
      s: 3 + rnd() * 4,
      fall: 50 + rnd() * 100,
      drift: (rnd() - 0.5) * 60,
      rot: (rnd() - 0.5) * 540,
      edge: rnd() > 0.5,
    }));
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
      later(() => {
        // Stamp: lifts and hovers, holds a beat, then slams
        Animated.sequence([
          Animated.parallel([
            Animated.timing(stampLift, {
              toValue: 0.35,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(stampOpacity, { toValue: 0.6, duration: 240, useNativeDriver: true }),
          ]),
          Animated.delay(110),
          Animated.parallel([
            Animated.timing(stampLift, {
              toValue: 1,
              duration: 130,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(stampOpacity, { toValue: 0.94, duration: 90, useNativeDriver: true }),
          ]),
        ]).start(({ finished }) => {
          if (!finished) return;
          // IMPACT
          safeVibrate([0, 40, 25, 12]);
          // paper dips under the stamp, then springs back
          Animated.sequence([
            Animated.timing(press, { toValue: 1, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(press, { toValue: 0, tension: 180, friction: 7, useNativeDriver: true }),
          ]).start();
          // the whole permit rings like a struck bell: damped oscillation
          shake.setValue(1);
          Animated.spring(shake, { toValue: 0, tension: 260, friction: 4.2, useNativeDriver: true }).start();
          // stamp squashes flat, then rebounds
          stampSquash.setValue(0.9);
          Animated.spring(stampSquash, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }).start();
          // two ink rings and a spray of flecks
          Animated.timing(bloom, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
          Animated.sequence([
            Animated.delay(90),
            Animated.timing(bloom2, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start();
          Animated.timing(splat, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
          later(showCaption, 180);
          scheduleClose();
        });
      }, 820);
    } else {
      later(() => {
        // Anticipation: the paper tightens and trembles harder and harder
        safeVibrate(18);
        teethOpacity.setValue(1);
        const amp = [0.3, -0.45, 0.6, -0.8, 0.95, -1, 0.7, 0];
        Animated.parallel([
          Animated.timing(tense, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence(
            amp.map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true }))
          ),
          Animated.sequence(
            amp.map((v) => Animated.timing(wiggle, { toValue: v, duration: 50, useNativeDriver: true }))
          ),
        ]).start(({ finished }) => {
          if (!finished) return;
          // TEAR: splits a little (resistance), a beat, then the halves slide together into a pile
          safeVibrate([0, 30, 35, 45]);
          Animated.parallel([
            Animated.sequence([
              Animated.timing(rip, { toValue: 0.3, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.delay(40),
              Animated.spring(rip, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
            ]),
            Animated.timing(tense, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(bits, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start();
          later(showCaption, 560);
          scheduleClose();
        });
      }, 1000);
    }

    return () => {
      timers.forEach(clearTimeout);
      [
        enter, press, tense, stampLift, stampOpacity, stampSquash, bloom, bloom2,
        splat, shake, wiggle, rip, bits, teethOpacity, caption,
      ].forEach((v) => v.stopAnimation());
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
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] });
  const tenseScale = tense.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  const cardStyle = {
    opacity: enter.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
      { scale: Animated.multiply(Animated.multiply(enterScale, pressScale), tenseScale) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) },
      { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', TILT] }) },
    ],
  };

  // Ripped halves: a small resisting split first (rip 0 -> 0.3), then they slide together and
  // settle in a loose pile centred on the permit's own box, so nothing spills into the text panel.
  // Each half is W/2 wide, so moving by W/4 puts its centre at the middle of the box.
  // The right half is last in the tree, so it lands on top.
  const leftHalf = {
    transform: [
      {
        translateX: rip.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, -W * 0.015, W * 0.25 - W * 0.03],
        }),
      },
      { translateY: rip.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, H * 0.02, H * 0.1] }) },
      {
        rotate: Animated.add(
          Animated.multiply(wiggle, 1.5),
          rip.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -2, -9] })
        ).interpolate({ inputRange: [-60, 60], outputRange: ['-60deg', '60deg'] }),
      },
    ],
  };
  const rightHalf = {
    transform: [
      {
        translateX: rip.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, W * 0.015, -W * 0.25 + W * 0.025],
        }),
      },
      { translateY: rip.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, H * 0.03, H * 0.07] }) },
      {
        rotate: Animated.add(
          Animated.multiply(wiggle, 1.5),
          rip.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 2, 6] })
        ).interpolate({ inputRange: [-60, 60], outputRange: ['-60deg', '60deg'] }),
      },
    ],
  };

  // Stamp: big and high -> hovering -> slammed flat, twisting into place as it falls
  const stampScale = stampLift.interpolate({ inputRange: [0, 0.35, 1], outputRange: [2.6, 2.05, 1] });
  const stampRotate = stampLift.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: ['-30deg', '-24deg', '-12deg'],
  });

  const staticStamp = (
    <View style={{ opacity: 0.9, transform: [{ rotate: '-12deg' }] }}>
      <StampMark size={stampSize} ink={inkColor} logoSource={logoSource} />
    </View>
  );

  const card = (
          <Animated.View style={[{ width: W, height: H }, cardStyle]}>
            {approved ? (
              <>
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
                        opacity: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                        transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
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
                        opacity: bloom2.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                        transform: [{ scale: bloom2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
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
                      opacity: stampOpacity,
                      transform: [{ rotate: stampRotate }, { scale: Animated.multiply(stampScale, stampSquash) }],
                    }}
                  >
                    <StampMark size={stampSize} ink={inkColor} logoSource={logoSource} />
                  </Animated.View>
                </View>
              </>
            ) : (
              <>
                <Animated.View style={[styles.half, { left: 0, width: W / 2, height: H }, leftHalf]}>
                  <View style={{ width: W / 2, height: H, overflow: 'hidden' }}>
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
                        opacity: bits.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                        transform: [
                          { translateX: bits.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
                          { translateY: bits.interpolate({ inputRange: [0, 1], outputRange: [0, b.fall] }) },
                          { rotate: bits.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.rot}deg`] }) },
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
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => onDone()}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={() => onDone()}>
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
    </Modal>
  );
}

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
    backgroundColor: 'rgba(5,9,14,0.78)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
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
  half: {
    position: 'absolute',
    top: 0,
    borderRadius: 6,
    backgroundColor: PAPER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
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