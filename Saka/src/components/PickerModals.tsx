import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/* ------------------------------------------------------------------ */
/* Shared styled pickers: DatePickerModal (calendar) + TimePickerModal */
/* Used by HikeFormModal and OrgCreateEvent so both look identical.    */
/* ------------------------------------------------------------------ */

const GOLD = '#C9A96E';
const NAVY = '#0E1520';
const CARD = '#131C2A';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ----------------------------- helpers ----------------------------- */

export const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

// Local date (toISOString is UTC and can be off by a day for UTC+8 users).
export const todayISO = () => {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
};

export const formatDisplayDate = (iso: string) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

type Period = 'AM' | 'PM';

export const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
  let h = 8;
  let min = 0;
  if (match) {
    h = Math.min(23, Number(match[1]));
    min = Math.min(59, Number(match[2]));
  }
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12, min, period };
};

const toTimeValue = (h12: number, min: number, period: Period) =>
  `${pad((h12 % 12) + (period === 'PM' ? 12 : 0))}:${pad(min)}`;

// "16:30" -> "4:30 PM" ('' if the value isn't a time)
export const formatDisplayTime = (value: string) => {
  if (!/^\d{1,2}:\d{2}/.test(value || '')) return '';
  const { h12, min, period } = parseTime(value);
  return `${h12}:${pad(min)} ${period}`;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
};

/* ============================ DATE PICKER ========================== */

interface DatePickerModalProps {
  visible: boolean;
  title?: string;
  /** Currently selected ISO date ('' = none) */
  value: string;
  /** Days before this ISO date can't be picked */
  minDate?: string;
  /** Optional ISO date drawn with a gold outline (e.g. the hike's start date).
   *  Tapping it calls onClear, so "same day" is one tap. */
  rangeStart?: string;
  /** If provided, shows a ghost button with this label that calls onClear */
  clearLabel?: string;
  onSelect: (iso: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

export function DatePickerModal(props: DatePickerModalProps) {
  const { visible, onClose } = props;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Mounted only while open so it always starts on the right month */}
        {visible && <CalendarCard {...props} />}
      </View>
    </Modal>
  );
}

function CalendarCard({
  title = 'Select date',
  value,
  minDate,
  rangeStart,
  clearLabel,
  onSelect,
  onClear,
  onClose,
}: DatePickerModalProps) {
  const { height } = useWindowDimensions();
  const cellHeight = Math.max(22, Math.min(28, Math.floor((height - 170) / 6)));
  const dotSize = Math.min(cellHeight - 2, 26);
  const today = todayISO();

  const base = parseISO(value || rangeStart || minDate || today);
  const min = minDate ? parseISO(minDate) : null;
  const [view, setView] = useState({ y: base.y, m: base.m });

  const weeks = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return chunk(cells, 7);
  }, [view]);

  const canGoPrev = !min || view.y > min.y || (view.y === min.y && view.m > min.m);

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const n = m + delta;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });

  const choose = (iso: string) => {
    if (rangeStart && iso === rangeStart && onClear) {
      onClear();
    } else {
      onSelect(iso);
    }
    onClose();
  };

  return (
    <View style={[styles.card, styles.calendarCard]}>
      <View style={styles.calHeader}>
        <TouchableOpacity
          onPress={() => canGoPrev && shiftMonth(-1)}
          disabled={!canGoPrev}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.calNavBtn, !canGoPrev && styles.calNavBtnDisabled]}
        >
          <Ionicons name="chevron-back" size={16} color={GOLD} />
        </TouchableOpacity>
        <View style={styles.calTitleWrap}>
          <Text style={styles.calTitle}>
            {MONTHS[view.m]} {view.y}
          </Text>
          <Text style={styles.calSub}>{title}</Text>
        </View>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.calNavBtn}
        >
          <Ionicons name="chevron-forward" size={16} color={GOLD} />
        </TouchableOpacity>
      </View>

      <View style={styles.calWeekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.calWeekday}>
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.calWeek}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={{ flex: 1, height: cellHeight }} />;
            const iso = toISO(view.y, view.m, day);
            const disabled = !!minDate && iso < minDate;
            const isStart = !!rangeStart && iso === rangeStart;
            const isSelected = !!value && iso === value;
            const isToday = iso === today;
            const inRange = !!rangeStart && !!value && iso > rangeStart && iso < value;
            return (
              <TouchableOpacity
                key={di}
                disabled={disabled}
                activeOpacity={0.7}
                onPress={() => choose(iso)}
                style={[styles.calCell, { height: cellHeight }, inRange && styles.calCellInRange]}
              >
                <View
                  style={[
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    isStart && styles.calDayStart,
                    isSelected && styles.calDaySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      isToday && styles.calDayTextToday,
                      disabled && styles.calDayTextDisabled,
                      isStart && !isSelected && styles.calDayTextStart,
                      isSelected && styles.calDayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.footerRow}>
        {clearLabel && onClear ? (
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => {
              onClear();
              onClose();
            }}
          >
            <Text style={styles.ghostText}>{clearLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================ TIME PICKER ========================== */

interface TimePickerModalProps {
  visible: boolean;
  title?: string;
  /** 24h "HH:MM" ('' = none, starts at 8:00 AM) */
  value: string;
  /** Called with 24h "HH:MM" */
  onSelect: (value: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePickerModal(props: TimePickerModalProps) {
  const { visible, onClose } = props;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {visible && <TimeCard {...props} />}
      </View>
    </Modal>
  );
}

function TimeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TimeCard({ title = 'Select time', value, onSelect, onClose }: TimePickerModalProps) {
  const { width } = useWindowDimensions();
  const sideBySide = width >= 560; // landscape / wide: hours and minutes side by side
  const [t, setT] = useState(() => parseTime(value));

  const hourGrid = (
    <View style={styles.timeCol}>
      <Text style={styles.colLabel}>Hour</Text>
      {chunk(HOURS, 6).map((row, i) => (
        <View key={i} style={styles.chipRow}>
          {row.map((h) => (
            <TimeChip
              key={h}
              label={String(h)}
              active={t.h12 === h}
              onPress={() => setT((p) => ({ ...p, h12: h }))}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const minuteGrid = (
    <View style={styles.timeCol}>
      <Text style={styles.colLabel}>Minute</Text>
      {chunk(MINUTES, 6).map((row, i) => (
        <View key={i} style={styles.chipRow}>
          {row.map((m) => (
            <TimeChip
              key={m}
              label={pad(m)}
              active={t.min === m}
              onPress={() => setT((p) => ({ ...p, min: m }))}
            />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.card, { maxWidth: sideBySide ? 460 : 320 }]}>
      <View style={styles.timeHeader}>
        <View>
          <Text style={styles.calSubLeft}>{title}</Text>
          <Text style={styles.timeBig}>
            {t.h12}:{pad(t.min)}
            <Text style={styles.timeBigPeriod}> {t.period}</Text>
          </Text>
        </View>
        <View style={styles.periodToggle}>
          {(['AM', 'PM'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              activeOpacity={0.8}
              onPress={() => setT((prev) => ({ ...prev, period: p }))}
              style={[styles.periodBtn, t.period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, t.period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={sideBySide ? styles.timeColsRow : undefined}>
        {hourGrid}
        {minuteGrid}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.setBtn}
          onPress={() => {
            onSelect(toTimeValue(t.h12, t.min, t.period));
            onClose();
          }}
        >
          <Text style={styles.setText}>Set time</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================== styles ============================= */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(5,9,14,0.6)',
  },
  card: {
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  calendarCard: {
    maxWidth: 280,
  },

  /* shared footer buttons */
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ghostBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.35)',
  },
  ghostText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  setBtn: {
    flex: 1.4,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: GOLD,
  },
  setText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: '700',
  },

  /* calendar */
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)',
  },
  calNavBtnDisabled: {
    opacity: 0.25,
  },
  calTitleWrap: {
    alignItems: 'center',
  },
  calTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  calSub: {
    color: 'rgba(201,169,110,0.7)',
    fontSize: 10,
    marginTop: 1,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '600',
  },
  calWeek: {
    flexDirection: 'row',
  },
  calCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellInRange: {
    backgroundColor: 'rgba(201,169,110,0.14)',
  },
  calDayStart: {
    borderWidth: 1,
    borderColor: GOLD,
  },
  calDaySelected: {
    backgroundColor: GOLD,
  },
  calDayText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  calDayTextToday: {
    color: GOLD,
    fontWeight: '700',
  },
  calDayTextDisabled: {
    color: 'rgba(255,255,255,0.18)',
  },
  calDayTextStart: {
    color: GOLD,
    fontWeight: '700',
  },
  calDayTextSelected: {
    color: NAVY,
    fontWeight: '700',
  },

  /* time picker */
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calSubLeft: {
    color: 'rgba(201,169,110,0.75)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  timeBig: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 2,
  },
  timeBigPeriod: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '700',
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 9,
    padding: 2,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  periodBtnActive: {
    backgroundColor: GOLD,
  },
  periodText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
  },
  periodTextActive: {
    color: NAVY,
  },
  timeColsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  timeCol: {
    flex: 1,
    marginBottom: 6,
  },
  colLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 5,
  },
  chip: {
    flex: 1,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: NAVY,
    fontWeight: '700',
  },
});