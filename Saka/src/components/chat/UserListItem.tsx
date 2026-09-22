// UserListItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TEXT_PRIMARY, TEXT_MUTED, ACCENT_GOLD } from '../../theme/designTokens';

export default function UserListItem({
  user,
  onPress,
  showAdd = false,
}: {
  user: any;
  onPress?: (u: any) => void;
  showAdd?: boolean;
}) {
  const initials = (user.name || '')
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C94'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress?.(user)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: getRandomColor(user.id) }]}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
      </View>
      {showAdd && (
        <View style={styles.addBadge}>
          <Ionicons name="add" size={17} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '700', color: '#fff', fontSize: 15 },
  info: { marginLeft: 12, flex: 1, minWidth: 0 },
  name: { fontWeight: '600', fontSize: 14.5, color: TEXT_PRIMARY },
  email: { fontSize: 12, color: TEXT_MUTED, opacity: 0.75, marginTop: 1 },
  addBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
});