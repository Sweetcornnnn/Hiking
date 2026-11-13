// components/events/TrailKit.tsx
// Hiker-facing primitives for the events screens. Replaces DesktopKit for these screens.
// Principles: readable type (13px minimum), 44px+ touch targets, plain-language labels,
// one clear primary action per screen, serif titles for warmth.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import { CHAT_BG, CHAT_BORDER, TEXT_PRIMARY } from '../../theme/designTokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Tokens ───────────────────────────────────────────────
export const T = {
  bg: CHAT_BG,
  card: '#101925',
  border: CHAT_BORDER,
  ctrl: 'rgba(255,255,255,0.06)',
  ctrlBorder: 'rgba(255,255,255,0.12)',
  text: TEXT_PRIMARY,
  body: 'rgba(255,255,255,0.84)',
  muted: 'rgba(255,255,255,0.64)', // was 0.5, too dim to read outdoors
  faint: 'rgba(255,255,255,0.45)',
  gold: '#C9A96E',
  goldSoft: 'rgba(201,169,110,0.14)',
  goldLine: 'rgba(201,169,110,0.38)',
  green: '#3FD69D',
  orange: '#E67E22',
  red: '#E07070',
} as const;

export const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
}) as string;

/** Easy reads green, Expert reads red, so level is understood at a glance. */
export const difficultyColor = (d: string) => {
  switch (d) {
    case 'Easy':
      return T.green;
    case 'Hard':
      return T.orange;
    case 'Expert':
      return T.red;
    default:
      return T.gold;
  }
};

// ── Date helpers ─────────────────────────────────────────
export const toLocalISO = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
export const todayISO = () => toLocalISO(new Date());
export const plusDaysISO = (days: number) => toLocalISO(new Date(Date.now() + days * 86400_000));
export const parseISO = (iso: string) => new Date(iso + 'T00:00:00');

export const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
};

// ── Frame ────────────────────────────────────────────────
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={k.screen} edges={['top', 'bottom', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function TopBar({
  onBack,
  a11yLabel,
  backIcon = 'chevron-back',
  backLabel,
  title,
  subtitle,
  right,
}: {
  onBack: () => void;
  a11yLabel: string;
  backIcon?: IconName;
  backLabel?: string; // omit for an icon-only button
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={k.topBar}>
      <TouchableOpacity
        onPress={onBack}
        style={backLabel ? k.backBtn : k.backBtnIcon}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        <Ionicons name={backIcon} size={backLabel ? 22 : 20} color={T.gold} />
        {backLabel ? <Text style={k.backText}>{backLabel}</Text> : null}
      </TouchableOpacity>
      {title ? (
        <View style={k.titleWrap}>
          <Text style={k.topTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={k.topSub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={k.topRight}>{right}</View>
    </View>
  );
}

export function CenterMessage({
  loading,
  message,
  actionLabel,
  onAction,
}: {
  loading?: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Screen>
      <View style={k.centered}>
        {loading ? <ActivityIndicator color={T.gold} /> : null}
        <Text style={k.msgText}>{message}</Text>
        {actionLabel && onAction ? (
          <View style={{ width: 200 }}>
            <Button label={actionLabel} onPress={onAction} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

// ── Controls ─────────────────────────────────────────────
export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View style={k.field}>
      <Ionicons name="search" size={16} color={T.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.faint}
        style={k.fieldInput}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={16} color={T.faint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SelectButton({
  icon,
  text,
  selected,
  onPress,
  onClear,
}: {
  icon: IconName;
  text: string;
  selected: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[k.field, selected && k.fieldActive]}
      accessibilityRole="button"
      accessibilityLabel={`Mountain: ${text}`}
    >
      <Ionicons name={icon} size={16} color={selected ? T.gold : T.faint} />
      <Text style={[k.fieldText, selected && { color: T.text }]} numberOfLines={1}>
        {text}
      </Text>
      {selected ? (
        <TouchableOpacity onPress={onClear} hitSlop={10} accessibilityLabel="Clear mountain">
          <Ionicons name="close-circle" size={16} color={T.muted} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-down" size={16} color={T.faint} />
      )}
    </TouchableOpacity>
  );
}

export function Chip({
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
      onPress={onPress}
      activeOpacity={0.8}
      style={[k.chip, active && k.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[k.chipText, active && k.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  const on = count > 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[k.filterBtn, on && k.fieldActive]}
      accessibilityRole="button"
      accessibilityLabel={on ? `Filters, ${count} active` : 'Filters'}
    >
      <Ionicons name="options-outline" size={16} color={on ? T.gold : T.body} />
      <Text style={[k.filterText, on && { color: T.gold }]}>Filters</Text>
      {on ? (
        <View style={k.badge}>
          <Text style={k.badgeText}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Applied filter, tap to remove. */
export function RemovableTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity
      onPress={onRemove}
      activeOpacity={0.8}
      style={k.tag}
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
    >
      <Text style={k.tagText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="close" size={14} color={T.gold} />
    </TouchableOpacity>
  );
}

export function Button({
  label,
  icon,
  variant = 'primary',
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'quiet' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const fg = variant === 'primary' ? '#0E1520' : variant === 'danger' ? T.red : T.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        k.btn,
        variant === 'primary' && { backgroundColor: T.gold },
        variant === 'quiet' && { backgroundColor: T.ctrl, borderWidth: 1, borderColor: T.ctrlBorder },
        variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(224,112,112,0.45)' },
        disabled && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[k.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Content bits ─────────────────────────────────────────
export function Pill({ label, color = T.gold, icon }: { label: string; color?: string; icon?: IconName }) {
  return (
    <View style={[k.pill, { backgroundColor: `${color}24`, borderColor: `${color}59` }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[k.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** One fact the hiker needs: a clear icon, a short question-style label, the answer. */
export function InfoLine({
  icon,
  label,
  text,
  sub,
}: {
  icon: IconName;
  label: string;
  text: string;
  sub?: string;
}) {
  return (
    <View style={k.infoLine}>
      <View style={k.infoIcon}>
        <Ionicons name={icon} size={16} color={T.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={k.infoLabel}>{label}</Text>
        <Text style={k.infoText}>{text}</Text>
        {sub ? <Text style={k.infoSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <View style={k.meter}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 4,
        }}
      />
    </View>
  );
}

// ── Picker ───────────────────────────────────────────────
/** Shared modal shell for sheets (used by PickerSheet and the Filters sheet). */
export function SheetShell({
  visible,
  title,
  onClose,
  onBack,
  headerRight,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={onBack ?? onClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={k.backdrop} onPress={onClose}>
        <ModalScrim color="rgba(0,0,0,0.6)" />
        <Pressable style={k.sheet} onPress={() => {}}>
          <View style={k.sheetHeader}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityLabel="Back to filters" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chevron-back" size={20} color={T.gold} />
                <Text style={k.sheetTitle}>{title}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={k.sheetTitle}>{title}</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {headerRight}
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={T.muted} />
              </TouchableOpacity>
            </View>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function PickerSheet({
  visible,
  title,
  allLabel,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  allLabel: string;
  items: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const data = [{ id: '__all__', name: allLabel }, ...items];
  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={k.backdrop} onPress={onClose}>
        <ModalScrim color="rgba(0,0,0,0.6)" />
        <Pressable style={k.sheet} onPress={() => {}}>
          <View style={k.sheetHeader}>
            <Text style={k.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={T.muted} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => {
              const isAll = item.id === '__all__';
              const active = isAll ? selectedId === null : selectedId === item.id;
              return (
                <TouchableOpacity
                  style={[k.sheetRow, active && { backgroundColor: T.goldSoft }]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onSelect(isAll ? null : item.id);
                    onClose();
                  }}
                >
                  <Text style={[k.sheetRowText, active && { color: T.gold, fontWeight: '700' }]}>
                    {item.name}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={20} color={T.gold} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const k = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msgText: { color: T.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingRight: 6 },
  backBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  backText: { color: T.gold, fontSize: 14, fontWeight: '600' },
  titleWrap: { flexShrink: 1 },
  topTitle: { color: T.text, fontFamily: SERIF, fontSize: 19 },
  topSub: { color: T.muted, fontSize: 12 },
  topRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },

  field: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  fieldActive: { borderColor: T.goldLine, backgroundColor: T.goldSoft },
  fieldInput: { flex: 1, color: T.text, fontSize: 14, paddingVertical: 0 },
  fieldText: { flex: 1, color: T.muted, fontSize: 14 },

  filterBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  filterText: { color: T.body, fontSize: 14, fontWeight: '600' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.gold,
  },
  badgeText: { color: '#0E1520', fontSize: 11, fontWeight: '800' },

  tag: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 15,
    backgroundColor: T.goldSoft,
    borderWidth: 1,
    borderColor: T.goldLine,
    maxWidth: 200,
  },
  tagText: { color: T.gold, fontSize: 13, fontWeight: '600', flexShrink: 1 },

  chip: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: T.ctrl,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
  },
  chipActive: { backgroundColor: T.goldSoft, borderColor: T.goldLine },
  chipText: { color: T.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: T.gold },

  btn: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  btnText: { fontSize: 15, fontWeight: '700' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.goldSoft,
  },
  infoLabel: { color: T.muted, fontSize: 12 },
  infoText: { color: T.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  infoSub: { color: T.body, fontSize: 13, marginTop: 1 },

  meter: { height: 6, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 3, overflow: 'hidden' },

  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: {
    width: 560,
    maxWidth: '100%',
    maxHeight: '94%',
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 46,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  sheetTitle: { color: T.text, fontFamily: SERIF, fontSize: 17 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  sheetRowText: { color: T.text, fontSize: 14 },
});