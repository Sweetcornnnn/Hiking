// components/chat/ChatTabs.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_BG,
  CHAT_RADIUS_BTN,
} from '../../theme/designTokens';

export default function ChatTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (s: any) => void;
}) {
  const Tab = ({
    id,
    icon,
    label,
  }: {
    id: 'world' | 'private';
    icon: any;
    label: string;
  }) => {
    const isActive = active === id;
    return (
      <TouchableOpacity
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => onChange(id)}
        activeOpacity={0.85}
      >
        <Ionicons
          name={icon}
          size={13}
          color={isActive ? CHAT_BG : TEXT_MUTED}
        />
        <Text
          style={[styles.tabLabel, isActive && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Tab id="world" icon="globe-outline" label="World" />
        <Tab id="private" icon="chatbubbles-outline" label="Private" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 8 },
  bar: {
    flexDirection: 'row',
    backgroundColor: CHAT_SUBTLE,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: CHAT_RADIUS_BTN - 2,
  },
  tabActive: { backgroundColor: ACCENT_GOLD },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
  },
  tabLabelActive: { color: CHAT_BG, fontWeight: '800' },
});