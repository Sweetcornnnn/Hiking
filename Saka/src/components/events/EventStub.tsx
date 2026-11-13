// components/events/EventStub.tsx
// An event listing drawn as the same paper permit stub used for hikes:
// cream paper, serif ink, typed number, dotted perforation with punched notches,
// a rubber stamp for difficulty, and the same wear. Events that are over look older.
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PaperUnderlay,
  PaperOverlay,
  agePalette,
  getHikeAge,
  hashSeed,
  clamp01,
} from '../HikeCardFace';

const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });
const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });
const SCREEN_BG = '#0A111A';

// Stamp inks: faded, like a rubber stamp on paper
const STAMP_INK: Record<string, string> = {
  Easy: '#3F6B4C',
  Moderate: '#2B4A8C',
  Hard: '#A5521F',
  Expert: '#9B2C2C',
};

const shortNo = (id: string) => `EV-${String(id).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`;

export interface EventStubProps {
  eventId: string;
  title: string;
  /** "Mt. Pulag, 5:00 AM" */
  where: string;
  /** "Sat, Nov 14" */
  dateText: string;
  organizer: string;
  verified?: boolean;
  difficulty: string;
  /** "8 spots left", "Full", ... */
  status: string;
  /** Strong status (full / nearly full) is written darker. */
  statusStrong?: boolean;
  hikeDate: string;
  endDate?: string | null;
  label: string;
  onPress: () => void;
  style?: any;
}

export function EventStub(p: EventStubProps) {
  const t = clamp01(getHikeAge(p.hikeDate, p.endDate));
  const pal = useMemo(() => agePalette(true, t), [t]);
  const seed = useMemo(() => hashSeed(String(p.eventId)), [p.eventId]);
  const tilt = useMemo(() => ((seed % 15) - 7) / 10, [seed]); // -0.7 .. +0.7 degrees, like paper on a board
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const fade = 1 - 0.2 * t;
  const stampInk = STAMP_INK[p.difficulty] ?? pal.ink;

  return (
    <Animated.View style={[s.lift, p.style, { transform: [{ rotate: `${tilt}deg` }, { scale }] }]}>
      <Pressable
        onPress={p.onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={p.label}
        style={[s.paper, { backgroundColor: pal.paper, borderColor: pal.edge }]}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          const h = Math.round(e.nativeEvent.layout.height);
          setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
        }}
      >
        {box.w > 0 ? <PaperUnderlay W={box.w} H={box.h} t={t} seed={seed} /> : null}

        <View style={s.top}>
          <Text style={[s.no, { color: pal.label }]}>No. {shortNo(p.eventId)}</Text>
          <Text
            style={[s.status, { color: p.statusStrong ? pal.ink : pal.label, fontWeight: p.statusStrong ? '700' : '400' }]}
            numberOfLines={1}
          >
            {p.status}
          </Text>
        </View>

        <View style={s.body}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.title, { color: pal.ink, opacity: fade }]} numberOfLines={2}>
              {p.title}
            </Text>
            <Text style={[s.where, { color: pal.label }]} numberOfLines={1}>
              {p.where}
            </Text>
          </View>
          <View style={[s.stamp, { borderColor: stampInk, opacity: 0.85 - 0.35 * t }]}>
            <Text style={[s.stampText, { color: stampInk }]}>{p.difficulty.toUpperCase()}</Text>
          </View>
        </View>

        {/* perforation, with punched half-circles on both edges */}
        <View style={s.perfRow}>
          <View style={[s.perfLine, { borderColor: pal.perf }]} />
          <View style={[s.notch, { left: -7 }]} />
          <View style={[s.notch, { right: -7 }]} />
        </View>

        <View style={s.foot}>
          <Text style={[s.date, { color: pal.ink, opacity: fade }]} numberOfLines={1}>
            {p.dateText}
          </Text>
          <View style={s.orgRow}>
            {p.verified ? <Ionicons name="shield-checkmark" size={11} color={pal.label} /> : null}
            <Text style={[s.org, { color: pal.label }]} numberOfLines={1}>
              {p.organizer}
            </Text>
          </View>
        </View>

        {box.w > 0 ? (
          <PaperOverlay W={box.w} H={box.h} t={t} seed={seed} paper={pal.paper} flap={pal.flap} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // soft shadow so the paper sits on the board
  lift: {
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  paper: { borderRadius: 4, borderWidth: 1, overflow: 'hidden' },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  no: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.5 },
  status: { fontFamily: SERIF, fontSize: 12, fontStyle: 'italic', flexShrink: 1 },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 3,
    paddingBottom: 8,
  },
  title: { fontFamily: SERIF, fontSize: 18, lineHeight: 21, fontWeight: '700', letterSpacing: -0.2 },
  where: { fontFamily: SERIF, fontSize: 13, fontStyle: 'italic', marginTop: 1 },

  stamp: {
    borderWidth: 1.5,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    transform: [{ rotate: '-8deg' }],
  },
  stampText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

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

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: 9,
  },
  date: { fontFamily: SERIF, fontSize: 14, fontWeight: '700' },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  org: { fontFamily: SERIF, fontSize: 12, fontStyle: 'italic', flexShrink: 1 },
});