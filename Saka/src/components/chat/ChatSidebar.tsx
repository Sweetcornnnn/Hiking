// components/chat/ChatSidebar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_PANEL,
  CHAT_BORDER,
} from '../../theme/designTokens';

export type ChatSidebarTab = 'world' | 'private';

export default function ChatSidebar({
  active,
  onChange,
  onCreateGroup,
  onSettings,
  onBack,
}: {
  active: ChatSidebarTab;
  onChange: (tab: ChatSidebarTab) => void;
  onCreateGroup: () => void;
  onSettings: () => void;
  onBack: () => void;
}) {
  const NavItem = ({
    id,
    icon,
    label,
    onPress,
    accent,
  }: {
    id?: ChatSidebarTab;
    icon: any;
    label: string;
    onPress?: () => void;
    accent?: boolean;
  }) => {
    const isActive = id !== undefined && active === id;
    return (
      <TouchableOpacity
        style={[styles.navItem, isActive && styles.navItemActive]}
        onPress={onPress ?? (id ? () => onChange(id) : undefined)}
        activeOpacity={0.85}
      >
        <Ionicons
          name={icon}
          size={14}
          color={isActive ? CHAT_BG : accent ? ACCENT_GOLD : TEXT_MUTED}
        />
        <Text
          style={[
            styles.navLabel,
            isActive && styles.navLabelActive,
            accent && !isActive && { color: TEXT_PRIMARY },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Back to home */}
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        activeOpacity={0.85}
        hitSlop={6}
      >
        <Ionicons name="arrow-back" size={16} color={TEXT_PRIMARY} />
        <Text style={styles.backLabel} numberOfLines={1}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Ionicons name="chatbubble" size={13} color={CHAT_BG} />
        </View>
        <Text style={styles.brandText} numberOfLines={1}>
          SAKA<Text style={styles.brandAccent}> CHAT</Text>
        </Text>
      </View>

      {/* Nav */}
      <View style={styles.nav}>
        <NavItem id="world" icon="globe-outline" label="World Chat" />
        <NavItem id="private" icon="people" label="Private Chat" />
        <NavItem icon="add" label="Create Group" onPress={onCreateGroup} accent />
      </View>

      <View style={{ flex: 1 }} />

      {/* Footer */}
      <TouchableOpacity
        style={styles.footer}
        onPress={onSettings}
        activeOpacity={0.85}
      >
        <Ionicons name="settings-outline" size={14} color={TEXT_MUTED} />
        <Text style={styles.footerText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 156,
    height: '100%',
    backgroundColor: CHAT_PANEL,
    borderRightWidth: 1,
    borderRightColor: CHAT_BORDER,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: 0.1,
    flexShrink: 1,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: TEXT_PRIMARY,
    flexShrink: 1,
  },
  brandAccent: { color: ACCENT_GOLD },

  nav: { gap: 3 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navItemActive: { backgroundColor: ACCENT_GOLD },
  navLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  navLabelActive: { color: CHAT_BG, fontWeight: '800' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
});