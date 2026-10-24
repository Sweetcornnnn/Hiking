// components/events/BoardKit.tsx
// Shared tokens + small primitives for the hiker "announcement board" screens.
// Intentionally self-contained (no dependency on OrgLandscapeShell).
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  Platform,
  type StyleProp,
  type ViewStyle,
  type RefreshControlProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Tokens ───────────────────────────────────────────────
export const B = {
  bg: '#0A111A',
  panel: '#0E1520',
  ink: '#F3EFE7', // warm off-white for titles
  body: 'rgba(255,255,255,0.78)',
  muted: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  hair: 'rgba(255,255,255,0.07)',
  hairStrong: 'rgba(255,255,255,0.12)',
  gold: '#C9A96E',
  goldSoft: 'rgba(201,169,110,0.10)',
  goldLine: 'rgba(201,169,110,0.35)',
  green: '#3FD69D',
  orange: '#E67E22',
  red: '#E07070',
  railW: 268,
  panelW: 272,
} as const;

export const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
}) as string;

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

// ── Layout ───────────────────────────────────────────────
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={s.back}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
    >
      <Ionicons name="chevron-back" size={16} color={B.gold} />
      <Text style={s.backText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Landscape frame: quiet left rail + scrolling main area. */
export function BoardFrame({
  rail,
  railFooter,
  children,
  refreshControl,
  mainWidth = 720,
}: {
  rail: React.ReactNode;
  railFooter?: React.ReactNode;
  children: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  mainWidth?: number;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.frame}>
        <View style={s.rail}>
          <ScrollView
            contentContainerStyle={s.railContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {rail}
          </ScrollView>
          {railFooter ? <View style={s.railFooter}>{railFooter}</View> : null}
        </View>

        <ScrollView
          style={s.main}
          contentContainerStyle={s.mainContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: mainWidth }}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export function BoardMessage({
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
    <SafeAreaView style={[s.screen, s.center]} edges={['top', 'left', 'right']}>
      {loading ? <ActivityIndicator color={B.gold} /> : null}
      <Text style={s.messageText}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} style={s.messageBtn}>
          <Text style={s.messageBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

// ── Controls ─────────────────────────────────────────────
export function FilterLabel({ children }: { children: string }) {
  return <Text style={s.filterLabel}>{children}</Text>;
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
      activeOpacity={0.75}
      style={[s.chip, active && s.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function OptionRow({
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
      activeOpacity={0.7}
      style={s.optionRow}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={[s.optionDot, active && s.optionDotActive]} />
      <Text style={[s.optionText, active && s.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SelectRow({
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={s.selectRow}>
      <Ionicons name={icon} size={15} color={selected ? B.gold : B.muted} />
      <Text style={[s.selectText, selected && { color: B.ink }]} numberOfLines={1}>
        {text}
      </Text>
      {selected ? (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={10}
          accessibilityLabel="Clear mountain filter"
        >
          <Ionicons name="close-circle" size={16} color={B.faint} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-down" size={14} color={B.faint} />
      )}
    </TouchableOpacity>
  );
}

export function BoardButton({
  label,
  icon,
  variant = 'primary',
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const primary = variant === 'primary';
  const fg = primary ? '#0E1520' : B.red;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        s.btn,
        primary ? s.btnPrimary : s.btnDanger,
        disabled && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          <Text style={[s.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />;
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: B.hairStrong }, style]} />;
}

// ── Picker (landscape-friendly centered sheet) ───────────
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
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={B.muted} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(i) => i.id}
            ItemSeparatorComponent={() => <Hairline />}
            renderItem={({ item }) => {
              const isAll = item.id === '__all__';
              const active = isAll ? selectedId === null : selectedId === item.id;
              return (
                <TouchableOpacity
                  style={s.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(isAll ? null : item.id);
                    onClose();
                  }}
                >
                  <Text style={[s.sheetRowText, active && { color: B.gold }]}>{item.name}</Text>
                  {active ? <Ionicons name="checkmark" size={16} color={B.gold} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: B.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  frame: { flex: 1, flexDirection: 'row' },

  rail: {
    width: B.railW,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: B.hairStrong,
  },
  railContent: { padding: 20, paddingBottom: 12, gap: 6 },
  railFooter: { paddingHorizontal: 20, paddingVertical: 14 },

  main: { flex: 1 },
  mainContent: { paddingHorizontal: 32, paddingTop: 22, paddingBottom: 40, alignItems: 'flex-start' },

  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: B.gold, fontSize: 13, fontWeight: '600' },

  messageText: { color: B.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  messageBtn: {
    paddingHorizontal: 20,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: B.gold,
  },
  messageBtnText: { color: '#0E1520', fontWeight: '700', fontSize: 13 },

  filterLabel: { color: B.faint, fontSize: 11, fontWeight: '600', marginTop: 14, marginBottom: 4 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: B.hairStrong,
  },
  chipActive: { borderColor: B.goldLine, backgroundColor: B.goldSoft },
  chipText: { color: B.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: B.gold },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  optionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: B.faint,
  },
  optionDotActive: { backgroundColor: B.gold, borderColor: B.gold },
  optionText: { color: B.muted, fontSize: 13 },
  optionTextActive: { color: B.ink, fontWeight: '600' },

  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: B.hairStrong,
  },
  selectText: { flex: 1, color: B.muted, fontSize: 13 },

  btn: {
    minHeight: 44,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  btnPrimary: { backgroundColor: B.gold },
  btnDanger: { borderWidth: 1, borderColor: 'rgba(224,112,112,0.4)' },
  btnText: { fontSize: 14, fontWeight: '700' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: 380,
    maxWidth: '100%',
    maxHeight: '88%',
    backgroundColor: B.panel,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: B.hairStrong,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: B.hairStrong,
  },
  sheetTitle: { color: B.ink, fontFamily: SERIF, fontSize: 17 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  sheetRowText: { color: B.body, fontSize: 14 },
});