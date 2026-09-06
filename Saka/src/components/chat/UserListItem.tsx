// UserListItem.tsx - Enhanced with better design
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BG_PANEL, TEXT_PRIMARY, TEXT_MUTED } from '../../theme/designTokens';

export default function UserListItem({ user, onPress, showAdd = false }: { user: any; onPress?: (u: any) => void; showAdd?: boolean }) {
  const initials = (user.name || '').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  
  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C94'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  return (
    <TouchableOpacity 
      style={[styles.row, { backgroundColor: BG_PANEL }]} 
      onPress={() => onPress?.(user)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: getRandomColor(user.id) }]}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: TEXT_PRIMARY }]}>{user.name}</Text>
        <Text style={[styles.email, { color: TEXT_MUTED }]}>{user.email}</Text>
      </View>
      {showAdd && (
        <View style={styles.addBadge}>
          <Ionicons name="add" size={18} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.gap,
    borderRadius: 12,
    marginVertical: 2,
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  initials: { 
    fontWeight: '700', 
    color: '#fff',
    fontSize: 16,
  },
  info: { 
    marginLeft: SPACING.gap / 2,
    flex: 1,
  },
  name: { 
    fontWeight: '600',
    fontSize: 15,
  },
  email: { 
    fontSize: 12,
    opacity: 0.6,
  },
  addBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
});