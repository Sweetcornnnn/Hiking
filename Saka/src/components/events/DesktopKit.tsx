// components/events/DesktopKit.tsx
// Compact desktop-style primitives for landscape screens, matching ChatScreen / Calendar:
// three-pane shell, 1px hairline borders, #0E1520 panels, small type.
// Replaces the earlier BoardKit.tsx (you can delete that file).
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import {
  CHAT_BG,
  CHAT_ONLINE,
  CHAT_BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../theme/designTokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Tokens ───────────────────────────────────────────────
export const D = {
  bg: CHAT_BG,
  panel: '#0E1520',
  border: CHAT_BORDER,
  ctrl: 'rgba(255,255,255,0.05)',
  ctrlBorder: 'rgba(255,255,255,0.08)',
  text: TEXT_PRIMARY,
  muted: TEXT_MUTED,
  faint: 'rgba(255,255,255,0.35)',
  gold: '#C9A96E',
  goldSoft: 'rgba(201,169,110,0.12)',
  goldLine: 'rgba(201,169,110,0.3)',
  green: '#3FD69D',
  orange: '#E67E22',
  red: '#E07070',
  online: CHAT_ONLINE,
  sidebarW: 196,
  paneW: 228,
} as const;

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

// ── Shell ────────────────────────────────────────────────
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={k.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={k.shell}>{children}</View>
    </SafeAreaView>
  );
}

export function Sidebar({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={k.sidebar}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={k.sidebarContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={k.sidebarFooter}>{footer}</View> : null}
    </View>
  );
}

export function Center({ children }: { children: React.ReactNode }) {
  return <View style={k.center}>{children}</View>;
}

export function RightPane({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={k.pane}>
      <View style={k.paneContent}>{children}</View>
      {footer ? <View style={k.paneFooter}>{footer}</View> : null}
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
    <SafeAreaView style={[k.screen, k.centered]} edges={['top', 'bottom', 'left', 'right']}>
      {loading ? <ActivityIndicator color={D.gold} /> : null}
      <Text style={k.msgText}>{message}</Text>
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} onPress={onAction} fullWidth={false} />
      ) : null}
    </SafeAreaView>
  );
}

// ── Header bits ──────────────────────────────────────────
export function IconBtn({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={k.iconBtn}
      hitSlop={8}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={D.text} />
    </TouchableOpacity>
  );
}

export function SidebarHeader({
  onBack,
  backLabel,
  title,
  status,
}: {
  onBack: () => void;
  backLabel: string;
  title: string;
  status?: string;
}) {
  return (
    <View style={k.sbHeader}>
      <IconBtn icon="arrow-back" onPress={onBack} label={`Back to ${backLabel}`} />
      <View style={{ flex: 1 }}>
        <Text style={k.sbTitle} numberOfLines={1}>
          {title}
        </Text>
        {status ? (
          <View style={k.statusRow}>
            <View style={k.statusDot} />
            <Text style={k.statusText} numberOfLines={1}>
              {status}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={k.sectionLabel}>{children}</Text>;
}

// ── Controls ─────────────────────────────────────────────
export function SearchField({
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
      <Ionicons name="search-outline" size={13} color={D.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.28)"
        style={k.fieldInput}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={14} color={D.faint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SelectField({
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[k.field, selected && k.fieldActive]}>
      <Ionicons name={icon} size={13} color={selected ? D.gold : D.faint} />
      <Text style={[k.fieldText, selected && { color: D.text }]} numberOfLines={1}>
        {text}
      </Text>
      {selected ? (
        <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityLabel="Clear mountain">
          <Ionicons name="close-circle" size={14} color={D.faint} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-down" size={12} color={D.faint} />
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

export function LinkButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={k.linkBtn}>
      <Ionicons name={icon} size={13} color={D.gold} />
      <Text style={k.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ActionButton({
  label,
  icon,
  variant = 'primary',
  loading,
  disabled,
  onPress,
  fullWidth = true,
}: {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  const fg = variant === 'primary' ? '#0E1520' : variant === 'danger' ? D.red : D.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        k.btn,
        fullWidth && { alignSelf: 'stretch' },
        variant === 'primary' && { backgroundColor: D.gold },
        variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(224,112,112,0.4)' },
        variant === 'ghost' && { backgroundColor: D.ctrl, borderWidth: 1, borderColor: D.ctrlBorder },
        disabled && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
          <Text style={[k.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Content bits ─────────────────────────────────────────
export function Panel({
  style,
  children,
}: {
  style?: any;
  children: React.ReactNode;
}) {
  return <View style={[k.panel, style]}>{children}</View>;
}

export function Badge({
  label,
  color = D.gold,
  bg = D.goldSoft,
  border = D.goldLine,
  icon,
}: {
  label: string;
  color?: string;
  bg?: string;
  border?: string;
  icon?: IconName;
}) {
  return (
    <View style={[k.badge, { backgroundColor: bg, borderColor: border }]}>
      {icon ? <Ionicons name={icon} size={10} color={color} /> : null}
      <Text style={[k.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function MetaRow({
  icon,
  text,
  color = D.muted,
  iconColor = D.faint,
  lines = 1,
}: {
  icon: IconName;
  text: string;
  color?: string;
  iconColor?: string;
  lines?: number;
}) {
  return (
    <View style={k.metaRow}>
      <Ionicons name={icon} size={12} color={iconColor} style={{ marginTop: 1 }} />
      <Text style={[k.metaText, { color }]} numberOfLines={lines}>
        {text}
      </Text>
    </View>
  );
}

export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <View style={k.meter}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

// ── Picker ───────────────────────────────────────────────
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
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={k.backdrop} onPress={onClose}>
        <ModalScrim color="rgba(0,0,0,0.6)" />
        <Pressable style={k.sheet} onPress={() => {}}>
          <View style={k.sheetHeader}>
            <Text style={k.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={16} color={D.muted} />
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
                  style={[k.sheetRow, active && { backgroundColor: D.goldSoft }]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onSelect(isAll ? null : item.id);
                    onClose();
                  }}
                >
                  <Text style={[k.sheetRowText, active && { color: D.gold }]}>{item.name}</Text>
                  {active ? <Ionicons name="checkmark" size={14} color={D.gold} /> : null}
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
  screen: { flex: 1, backgroundColor: D.bg },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: D.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  msgText: { color: D.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },

  sidebar: {
    width: D.sidebarW,
    borderRightWidth: 1,
    borderRightColor: D.border,
  },
  sidebarContent: { padding: 10, gap: 8 },
  sidebarFooter: { padding: 10, paddingTop: 6, gap: 8, borderTopWidth: 1, borderTopColor: D.border },

  center: { flex: 1, minWidth: 0, backgroundColor: D.bg },

  pane: {
    width: D.paneW,
    borderLeftWidth: 1,
    borderLeftColor: D.border,
  },
  paneContent: { flex: 1, padding: 10, gap: 8 },
  paneFooter: { padding: 10, paddingTop: 6, gap: 8, borderTopWidth: 1, borderTopColor: D.border },

  sbHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sbTitle: { fontSize: 13, fontWeight: '700', color: D.text, letterSpacing: -0.1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: D.online },
  statusText: { fontSize: 9.5, color: D.muted, fontWeight: '500', letterSpacing: 0.2 },

  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.ctrl,
    borderWidth: 1,
    borderColor: D.ctrlBorder,
  },

  sectionLabel: { color: D.faint, fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginTop: 4 },

  field: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: D.ctrl,
    borderWidth: 1,
    borderColor: D.ctrlBorder,
  },
  fieldActive: { borderColor: D.goldLine, backgroundColor: D.goldSoft },
  fieldInput: { flex: 1, color: D.text, fontSize: 11, paddingVertical: 0 },
  fieldText: { flex: 1, color: D.muted, fontSize: 11 },

  chip: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: D.ctrl,
    borderWidth: 1,
    borderColor: D.ctrlBorder,
  },
  chipActive: { backgroundColor: D.goldSoft, borderColor: D.goldLine },
  chipText: { color: D.muted, fontSize: 10.5, fontWeight: '600' },
  chipTextActive: { color: D.gold },

  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  linkText: { color: D.gold, fontSize: 11, fontWeight: '600' },

  btn: {
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  btnText: { fontSize: 12, fontWeight: '700' },

  panel: {
    backgroundColor: D.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 9.5, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  metaText: { flex: 1, fontSize: 10.5, lineHeight: 14 },

  meter: { height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' },

  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: 320,
    maxWidth: '100%',
    maxHeight: '90%',
    backgroundColor: D.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.ctrlBorder,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  sheetTitle: { color: D.text, fontSize: 12, fontWeight: '700' },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 36,
  },
  sheetRowText: { color: D.text, fontSize: 12 },
});