// components/chat/UserListItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  CHAT_BG,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

export default function UserListItem({
  user,
  onPress,
  showAdd = false,
}: {
  user: any;
  onPress?: (u: any) => void;
  showAdd?: boolean;
}) {
  const initials = getInitials(user.name || '');
  const color = getAvatarColor(user.id);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress?.(user)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      {showAdd && (
        <View style={styles.addBadge}>
          <Ionicons name="add" size={14} color={CHAT_BG} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '700', color: '#fff', fontSize: 13 },
  info: { marginLeft: 10, flex: 1, minWidth: 0 },
  name: { fontWeight: '600', fontSize: 12.5, color: TEXT_PRIMARY },
  email: { fontSize: 10, color: TEXT_MUTED, opacity: 0.75, marginTop: 1 },
  addBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
});