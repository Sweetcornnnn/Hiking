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
  const W = Math.min(width - 48, 380);
  const H = Math.round(Math.max(170, Math.min(W * 0.58, height - 130)));
  const stampSize = Math.round(Math.min(112, H * 0.52));
  const permitNo = useMemo(() => details.permitNo ?? makePermitNo(), [details.permitNo]);

  // Animation values
  const enter = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(2.6)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const bloom = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const rip = useRef(new Animated.Value(0)).current;
  const teethOpacity = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const scheduleClose = () => {
      if (autoCloseMs > 0) later(() => onDoneRef.current(), autoCloseMs);
    };
    const showCaption = () =>
      Animated.timing(caption, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

    // Permit slides in
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (mode === 'approved') {
      // Stamp slams down
      later(() => {
        Animated.parallel([
          Animated.timing(stampOpacity, { toValue: 0.92, duration: 90, useNativeDriver: true }),
          Animated.timing(stampScale, {
            toValue: 1,
            duration: 190,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (!finished) return;
          // Impact: buzz, shake the permit, ink bloom, small settle
          safeVibrate(35);
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0.5, duration: 50, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start();
          Animated.timing(bloom, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
          Animated.sequence([
            Animated.timing(stampScale, { toValue: 0.95, duration: 70, useNativeDriver: true }),
            Animated.timing(stampScale, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start();
          later(showCaption, 150);
          scheduleClose();
        });
      }, 620);
    } else {
      // Permit trembles, then rips in two
      later(() => {
        safeVibrate([0, 25, 45, 40]);
        teethOpacity.setValue(1);
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 90, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0.6, duration: 70, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished) return;
          Animated.timing(rip, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start();
          later(showCaption, 450);
          scheduleClose();
          // scheduleClose counts from here; the rip itself takes ~1s
        });
      }, 1000);
    }

    return () => {
      timers.forEach(clearTimeout);
      [enter, stampScale, stampOpacity, bloom, shake, wiggle, rip, teethOpacity, caption].forEach((v) =>
        v.stopAnimation()
      );
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
    };
    // Runs once per mount; useHikePermit re-mounts this for every show().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) },
    ],
  };

  // Ripped halves
  const ripOpacity = rip.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const leftHalf = {
    opacity: ripOpacity,
    transform: [
      { translateX: rip.interpolate({ inputRange: [0, 1], outputRange: [0, -W * 0.12] }) },
      { translateY: rip.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.16] }) },
      {
        rotate: Animated.add(Animated.multiply(wiggle, 1.5), Animated.multiply(rip, -12)).interpolate({
          inputRange: [-60, 60],
          outputRange: ['-60deg', '60deg'],
        }),
      },
    ],
  };
  const rightHalf = {
    opacity: ripOpacity,
    transform: [
      { translateX: rip.interpolate({ inputRange: [0, 1], outputRange: [0, W * 0.12] }) },
      { translateY: rip.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.19] }) },
      {
        rotate: Animated.add(Animated.multiply(wiggle, 1.5), Animated.multiply(rip, 12)).interpolate({
          inputRange: [-60, 60],
          outputRange: ['-60deg', '60deg'],
        }),
      },
    ],
  };

  const staticStamp = (
    <View style={{ opacity: 0.9, transform: [{ rotate: '-12deg' }] }}>
      <StampMark size={stampSize} ink={inkColor} logoSource={logoSource} />
    </View>
  );

  const approved = mode === 'approved';

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
          <Animated.View style={[{ width: W, height: H }, cardStyle]}>
            {approved ? (
              <>
                <PermitFace W={W} H={H} details={details} permitNo={permitNo} stampSize={stampSize} />
                <View
                  pointerEvents="none"
                  style={[styles.stampSlot, { width: stampSize, height: stampSize }]}
                >
                  {/* ink bloom ring on impact */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: stampSize / 2,
                        borderWidth: 2,
                        borderColor: inkColor,
                        opacity: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                        transform: [
                          { scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={{
                      opacity: stampOpacity,
                      transform: [{ rotate: '-12deg' }, { scale: stampScale }],
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
              </>
            )}
          </Animated.View>

          <Animated.View
            style={[
              styles.captionWrap,
              {
                opacity: caption,
                transform: [
                  { translateY: caption.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.captionTitle}>{approved ? 'Hike scheduled' : 'Hike cancelled'}</Text>
            <Text style={styles.captionSub}>
              {approved ? 'Added to your calendar.' : 'Permit voided.'}
            </Text>
            <Text style={styles.captionHint}>Tap to continue</Text>
          </Animated.View>
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
  },
  teeth: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 10,
  },

  /* caption */
  captionWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  captionTitle: {
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  captionSub: {
    color: 'rgba(201,169,110,0.9)',
    fontFamily: SERIF,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 3,
  },
  captionHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 10,
  },
});