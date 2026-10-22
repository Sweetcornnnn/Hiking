/**
 * Shared landscape layout + small UI kit for the organizer screens.
 * Desktop-app styling to match ChatScreen / Calendar:
 *
 *   - SIDEBAR (~24% width, clamped 188-232): back pill, identity (eyebrow / title /
 *     badge) and summary/filter content in a scroll area, with the screen's main
 *     actions in a footer FIXED to the bottom.
 *   - MAIN PANEL (the rest): its own scroll view holding the screen's content.
 *
 * Type scale (FS): 9 labels / 10 captions / 11 body / 12 controls / 14 titles.
 * Same exports and props as before, so existing screens keep working unchanged.
 * Put this file at src/components/organizations/OrgLandscapeShell.tsx.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  RefreshControlProps,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHAT_BG, CHAT_BORDER, TEXT_PRIMARY } from '../../theme/designTokens';

// ── Design tokens ───────────────────────────────────────────────────────────
export const PC = {
  bgScreen:      CHAT_BG,
  bgRail:        CHAT_BG,
  bgPanel:       '#0E1520',
  bgSubtle:      'rgba(255,255,255,0.05)',
  border:        CHAT_BORDER,
  borderSoft:    'rgba(255,255,255,0.07)',
  borderCtrl:    'rgba(255,255,255,0.08)',
  borderGold:    'rgba(201,169,110,0.3)',
  gold:          '#C9A96E',
  goldSoft:      'rgba(201,169,110,0.12)',
  green:         '#3FD69D',
  danger:        '#E07070',
  orange:        '#E67E22',
  textPrimary:   TEXT_PRIMARY,
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted:     'rgba(255,255,255,0.5)',
  textBody:      'rgba(255,255,255,0.78)',
  textMeta:      'rgba(255,255,255,0.6)',
  textFaint:     'rgba(255,255,255,0.4)',
  radius:        12,
  radiusBtn:     10,
  radiusControl: 9,
};

export const SP = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20 } as const;
export const FS = { micro: 9, small: 10, body: 11, base: 12, title: 14 } as const;
export const HIT = { top: 6, bottom: 6, left: 6, right: 6 };

export const RAIL_WIDTH_RATIO = 0.24;

/** Status colors shared by event + RSVP pills. */
export const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'rgba(201,169,110,0.18)', text: '#C9A96E', label: 'Draft' },
  published: { bg: 'rgba(29,143,106,0.2)',   text: '#3FD69D', label: 'Published' },
  full:      { bg: 'rgba(230,126,34,0.2)',   text: '#E67E22', label: 'Full' },
  cancelled: { bg: 'rgba(224,112,112,0.18)', text: '#E07070', label: 'Cancelled' },
  completed: { bg: 'rgba(106,127,149,0.2)',  text: '#8FA4BA', label: 'Completed' },
  confirmed: { bg: 'rgba(29,143,106,0.2)',   text: '#3FD69D', label: 'Confirmed' },
  pending:   { bg: 'rgba(201,169,110,0.18)', text: '#C9A96E', label: 'Pending' },
  waitlist:  { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E', label: 'Waitlist' },
};
export const getStatusMeta = (status: string) =>
  STATUS_META[status] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', label: status };

// ── Shell ───────────────────────────────────────────────────────────────────
interface ShellProps {
  onBack?: () => void;
  backLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  eyebrow?: string;
  title: string;
  titleLines?: number;
  subtitle?: string;
  badge?: React.ReactNode;
  /** Small icon buttons shown at the top-right of the rail. */
  headerActions?: React.ReactNode;
  /** Rail content under the identity block (stats, filters, banners…). */
  rail?: React.ReactNode;
  /** Rail content fixed to the bottom (primary actions). Never scrolls away. */
  railFooter?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  children: React.ReactNode;
}

export function OrgLandscapeShell({
  onBack,
  backLabel = 'Back',
  icon,
  eyebrow,
  title,
  titleLines = 3,
  subtitle,
  badge,
  headerActions,
  rail,
  railFooter,
  refreshControl,
  children,
}: ShellProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 0);
  const bottom = Math.max(insets.bottom, 0);
  const railWidth =
    Math.min(Math.max(Math.round(width * RAIL_WIDTH_RATIO), 188), 232) + insets.left;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <View style={[s.rail, { width: railWidth }]}>
        <ScrollView
          style={s.railScroll}
          contentContainerStyle={[
            s.railContent,
            {
              paddingLeft: insets.left + SP.md,
              paddingTop: top + SP.md,
              paddingBottom: railFooter ? SP.md : bottom + SP.md,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {onBack || headerActions ? (
            <View style={s.railTopRow}>
              {onBack ? (
                <TouchableOpacity
                  onPress={onBack}
                  style={s.backBtn}
                  activeOpacity={0.8}
                  hitSlop={HIT}
                  accessibilityRole="button"
                  accessibilityLabel={`Back to ${backLabel}`}
                >
                  <Ionicons name="chevron-back" size={13} color={PC.textPrimary} />
                  <Text style={s.backText} numberOfLines={1}>{backLabel}</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              {headerActions ? <View style={s.headerActions}>{headerActions}</View> : null}
            </View>
          ) : null}

          <View style={s.identity}>
            {icon ? (
              <View style={s.iconBox}>
                <Ionicons name={icon} size={15} color={PC.gold} />
              </View>
            ) : null}
            {eyebrow ? <Text style={s.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
            <Text style={s.title} numberOfLines={titleLines}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            {badge ? <View style={s.badgeWrap}>{badge}</View> : null}
          </View>

          {rail}
        </ScrollView>

        {railFooter ? (
          <View
            style={[
              s.railFooter,
              { paddingLeft: insets.left + SP.md, paddingBottom: bottom + SP.md },
            ]}
          >
            {railFooter}
          </View>
        ) : null}
      </View>

      {/* ── MAIN PANEL ──────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={s.panel}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.panel}
          contentContainerStyle={[
            s.panelContent,
            {
              paddingRight: insets.right + SP.md,
              paddingTop: top + SP.md,
              paddingBottom: bottom + SP.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'gold' | 'danger';

const VARIANTS: Record<Variant, { bg: string; border: string; fg: string }> = {
  primary:   { bg: PC.gold,                  border: PC.gold,                  fg: '#0E1520' },
  secondary: { bg: PC.bgSubtle,              border: PC.borderCtrl,            fg: PC.textPrimary },
  gold:      { bg: 'rgba(201,169,110,0.08)', border: PC.borderGold,             fg: PC.gold },
  danger:    { bg: 'rgba(224,112,112,0.06)', border: 'rgba(224,112,112,0.32)', fg: PC.danger },
};

export function RailButton({
  icon,
  label,
  onPress,
  variant = 'secondary',
  disabled,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const v = VARIANTS[variant];
  return (
    <TouchableOpacity
      style={[
        s.btn,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && !loading && s.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          <Ionicons name={icon} size={14} color={v.fg} />
          <Text style={[s.btnText, { color: v.fg }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function RailIconButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={s.iconButton}
      activeOpacity={0.7}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={color} />
    </TouchableOpacity>
  );
}

export function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, active && s.chipActive, disabled && s.btnDisabled]}
      activeOpacity={0.8}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Full-width selectable row (filter lists in the rail). */
export function OptionRow({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.optionRow, active && s.optionRowActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[s.optionText, active && s.optionTextActive]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[s.optionCount, active && s.optionTextActive]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Feedback & state ────────────────────────────────────────────────────────
export function CenteredState({
  message,
  loading,
  actionLabel,
  onAction,
}: {
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.centered}>
      {loading ? (
        <ActivityIndicator color={PC.gold} />
      ) : (
        <Ionicons name="alert-circle-outline" size={24} color={PC.danger} />
      )}
      <Text style={s.centeredText}>{message}</Text>
      {!loading && actionLabel && onAction ? (
        <TouchableOpacity
          style={s.retryBtn}
          onPress={onAction}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={s.retryText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type BannerTone = 'info' | 'error' | 'success';
const BANNER: Record<BannerTone, { bg: string; border: string; fg: string; accent: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info:    { bg: 'rgba(201,169,110,0.07)', border: 'rgba(201,169,110,0.22)', fg: '#E8D7AE', accent: PC.gold,   icon: 'information-circle-outline' },
  error:   { bg: 'rgba(224,112,112,0.08)', border: 'rgba(224,112,112,0.28)', fg: PC.danger, accent: PC.danger, icon: 'alert-circle-outline' },
  success: { bg: 'rgba(63,214,157,0.07)',  border: 'rgba(63,214,157,0.28)',  fg: PC.green,  accent: PC.green,  icon: 'checkmark-circle' },
};

export function Banner({
  tone = 'info',
  icon,
  children,
  style,
}: {
  tone?: BannerTone;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = BANNER[tone];
  return (
    <View
      style={[s.banner, { backgroundColor: t.bg, borderColor: t.border }, style]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
    >
      <Ionicons name={icon ?? t.icon} size={14} color={t.accent} style={s.bannerIcon} />
      <Text style={[s.bannerText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={22} color="rgba(255,255,255,0.25)" />
      <Text style={s.emptyTitle}>{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────
export function Card({
  children,
  onPress,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const st = [s.card, padded && s.cardPad, style];
  if (onPress) {
    return (
      <TouchableOpacity style={st} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={st}>{children}</View>;
}

export function Pill({
  label,
  bg,
  color,
  border,
  icon,
  uppercase = true,
}: {
  label: string;
  bg: string;
  color: string;
  border?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  uppercase?: boolean;
}) {
  return (
    <View style={[s.pill, { backgroundColor: bg }, border ? { borderWidth: 1, borderColor: border } : null]}>
      {icon ? <Ionicons name={icon} size={9} color={color} /> : null}
      <Text
        style={[
          s.pillText,
          { color },
          uppercase && { textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '800' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const m = getStatusMeta(status);
  return <Pill label={m.label} bg={m.bg} color={m.text} />;
}

/** Icon + one line of meta text (mountain, date, organizer…). */
export function MetaRow({
  icon,
  text,
  iconColor = 'rgba(255,255,255,0.45)',
  textColor = PC.textMeta,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text?: string;
  iconColor?: string;
  textColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.metaRow}>
      <Ionicons name={icon} size={12} color={iconColor} />
      {text !== undefined ? (
        <Text style={[s.metaText, { color: textColor }]} numberOfLines={1}>{text}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
      <Text style={[s.statValue, accent ? { color: accent } : null]} numberOfLines={1}>
        {value}
        {sub ? <Text style={s.statSub}>{sub}</Text> : null}
      </Text>
    </View>
  );
}

export function InfoRow({
  icon,
  label,
  value,
  lines = 2,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  lines?: number;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={12} color={PC.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={lines}>{value}</Text>
      </View>
    </View>
  );
}

export function Block({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <View style={[s.block, accent ? { borderColor: accent } : null]}>
      <Text style={s.blockLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────
/**
 * Equal-width columns with an exact gap (no percentage rounding). The last row
 * stays left-aligned when the item count is odd.
 */
export function Grid({
  children,
  columns = 2,
  gap = SP.sm,
}: {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}) {
  const [w, setW] = useState(0);
  const items = React.Children.toArray(children);
  const itemW = w > 0 ? Math.floor((w - gap * (columns - 1)) / columns) : undefined;

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
    >
      {items.map((c, i) => (
        <View
          key={React.isValidElement(c) && c.key != null ? String(c.key) : i}
          style={{ width: itemW ?? (`${Math.floor(100 / columns) - 2}%` as any) }}
        >
          {c}
        </View>
      ))}
    </View>
  );
}

/** Side-by-side form fields. `weights` sets relative widths (default: equal). */
export function FormRow({
  children,
  weights,
}: {
  children: React.ReactNode;
  weights?: number[];
}) {
  const items = React.Children.toArray(children);
  return (
    <View style={s.formRow}>
      {items.map((c, i) => (
        <View key={i} style={{ flex: weights?.[i] ?? 1, minWidth: 0 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

// ── Form controls ───────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel} numberOfLines={1}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

export function FormInput({ style, onFocus, onBlur, multiline, editable = true, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="rgba(255,255,255,0.28)"
      {...rest}
      multiline={multiline}
      editable={editable}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        s.input,
        multiline && s.textarea,
        focused && s.inputFocused,
        !editable && s.inputDisabled,
        style,
      ]}
    />
  );
}

export function SelectField({
  icon,
  text,
  selected,
  onPress,
  onClear,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  selected?: boolean;
  onPress: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.select, disabled && s.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Ionicons name={icon} size={13} color={selected ? PC.gold : 'rgba(255,255,255,0.4)'} />
      <Text style={[s.selectText, selected && s.selectTextOn]} numberOfLines={1}>{text}</Text>
      {selected && onClear ? (
        <TouchableOpacity onPress={onClear} hitSlop={HIT} accessibilityLabel="Clear selection">
          <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.3)" />
      )}
    </TouchableOpacity>
  );
}

// ── Picker modal (mountains etc.) ───────────────────────────────────────────
export interface PickerItem {
  id: string;
  name: string;
  difficulty?: string;
  elevationDisplay?: string;
}

export function PickerModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  emptyText = 'Nothing to show.',
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  emptyText?: string;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={s.modalClose}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: SP.sm }}
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              const sub = [item.difficulty, item.elevationDisplay].filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  style={[s.modalRow, active && s.modalRowActive]}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalRowTitle}>{item.name}</Text>
                    {sub ? <Text style={s.modalRowSub}>{sub}</Text> : null}
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'chevron-forward'}
                    size={active ? 15 : 12}
                    color={active ? PC.gold : 'rgba(255,255,255,0.3)'}
                  />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={s.modalEmpty}>{emptyText}</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: PC.bgScreen },

  // Sidebar
  rail: {
    height: '100%',
    backgroundColor: PC.bgRail,
    borderRightWidth: 1,
    borderRightColor: PC.border,
  },
  railScroll: { flex: 1 },
  railContent: { paddingRight: SP.md, gap: SP.md },
  railTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
    paddingLeft: 6,
    paddingRight: SP.md,
    borderRadius: 9,
    backgroundColor: PC.bgSubtle,
    borderWidth: 1,
    borderColor: PC.borderCtrl,
    maxWidth: '70%',
  },
  backText: { color: PC.textPrimary, fontSize: FS.body, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: PC.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PC.borderCtrl,
  },

  identity: { gap: 3 },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: PC.goldSoft,
    borderWidth: 1,
    borderColor: PC.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  eyebrow: { color: PC.textFaint, fontSize: FS.small, fontWeight: '500', letterSpacing: 0.2 },
  title: { color: PC.textPrimary, fontSize: FS.title, fontWeight: '700', lineHeight: 18, letterSpacing: -0.1 },
  subtitle: { color: PC.textMuted, fontSize: FS.small, lineHeight: 14, marginTop: 2 },
  badgeWrap: { marginTop: SP.sm, alignSelf: 'flex-start' },

  railFooter: {
    gap: SP.sm,
    paddingTop: SP.md,
    paddingRight: SP.md,
    borderTopWidth: 1,
    borderTopColor: PC.border,
    backgroundColor: PC.bgRail,
  },

  // Buttons
  btn: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderRadius: PC.radiusBtn,
    borderWidth: 1,
  },
  btnText: { fontSize: FS.base, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  chip: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PC.borderCtrl,
    backgroundColor: PC.bgSubtle,
  },
  chipActive: { backgroundColor: PC.goldSoft, borderColor: PC.borderGold },
  chipText: { color: PC.textMuted, fontSize: FS.body - 0.5, fontWeight: '600' },
  chipTextActive: { color: PC.gold },

  optionRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: { backgroundColor: PC.goldSoft, borderColor: PC.borderGold },
  optionText: { color: PC.textMuted, fontSize: FS.base - 0.5, fontWeight: '600' },
  optionTextActive: { color: PC.gold },
  optionCount: { color: PC.textFaint, fontSize: FS.small, fontWeight: '700' },

  // States
  centered: {
    flex: 1,
    backgroundColor: PC.bgScreen,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SP.md,
    paddingHorizontal: SP.xl,
  },
  centeredText: { color: PC.textMuted, fontSize: FS.base, textAlign: 'center' },
  retryBtn: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: PC.gold,
    borderRadius: PC.radiusBtn,
  },
  retryText: { color: '#0E1520', fontWeight: '700', fontSize: FS.body },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SP.sm,
    paddingVertical: 8,
    paddingHorizontal: SP.md,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
  },
  bannerIcon: { marginTop: 1 },
  bannerText: { flex: 1, fontSize: FS.body, lineHeight: 15, fontWeight: '500' },

  empty: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: SP.xl,
    paddingHorizontal: SP.lg,
    alignItems: 'center',
    gap: 3,
  },
  emptyTitle: { color: PC.textSecondary, fontSize: FS.base, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  emptyHint: { color: PC.textMuted, fontSize: FS.body, textAlign: 'center', lineHeight: 15 },

  // Surfaces
  card: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.borderSoft,
  },
  cardPad: { padding: SP.md },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 18,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: FS.micro + 0.5, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FS.body, flexShrink: 1 },

  stat: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 2,
  },
  statLabel: { color: PC.textFaint, fontSize: FS.micro + 0.5, fontWeight: '600' },
  statValue: { color: PC.textPrimary, fontSize: 16, fontWeight: '800' },
  statSub: { color: PC.textMuted, fontSize: FS.body, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: 7,
    paddingHorizontal: SP.md,
  },
  infoIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: PC.goldSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  infoLabel: { color: PC.textFaint, fontSize: FS.micro + 0.5, fontWeight: '600' },
  infoValue: { color: PC.textPrimary, fontSize: FS.base - 0.5, fontWeight: '600', marginTop: 1 },

  block: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    padding: SP.md,
    gap: 5,
  },
  blockLabel: { color: PC.textFaint, fontSize: FS.micro, fontWeight: '700', letterSpacing: 0.6 },

  // Forms
  formRow: { flexDirection: 'row', gap: SP.sm },
  field: { gap: 4 },
  fieldLabel: { color: PC.textFaint, fontSize: FS.micro, fontWeight: '600', letterSpacing: 0.5 },
  fieldHint: { color: PC.textFaint, fontSize: FS.micro },
  input: {
    minHeight: 32,
    backgroundColor: PC.bgSubtle,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderCtrl,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    color: PC.textPrimary,
    fontSize: FS.body,
  },
  inputFocused: { borderColor: PC.gold },
  inputDisabled: { opacity: 0.6 },
  textarea: { minHeight: 58, textAlignVertical: 'top', paddingTop: 8 },

  select: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: PC.bgSubtle,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderCtrl,
    paddingHorizontal: SP.md,
    paddingVertical: 5,
  },
  selectText: { flex: 1, color: PC.textMuted, fontSize: FS.body },
  selectTextOn: { color: PC.textPrimary, fontWeight: '600' },

  // Picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SP.md,
    paddingHorizontal: SP.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    backgroundColor: PC.bgPanel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PC.borderCtrl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.lg,
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
  },
  modalTitle: { color: PC.textPrimary, fontSize: FS.base, fontWeight: '700' },
  modalClose: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: PC.bgSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalRowActive: { backgroundColor: PC.goldSoft },
  modalRowTitle: { color: PC.textPrimary, fontSize: FS.base, fontWeight: '600' },
  modalRowSub: { color: PC.textFaint, fontSize: FS.small, marginTop: 1 },
  modalEmpty: { color: PC.textFaint, fontSize: FS.body, textAlign: 'center', padding: SP.xl },

  // Panel
  panel: { flex: 1 },
  panelContent: { paddingLeft: SP.md, gap: SP.sm },
});