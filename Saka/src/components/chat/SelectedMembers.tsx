// SelectedMembers.tsx - Enhanced with better visuals
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BG_PANEL, TEXT_PRIMARY, TEXT_MUTED, RADIUS_PILL } from '../../theme/designTokens';

export default function SelectedMembers({ members, onRemove }: { members: any[]; onRemove: (id: string) => void }) {
  if (members.length === 0) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Selected Members ({members.length})</Text>
      <View style={styles.chipContainer}>
        {members.map((m) => (
          <View key={m.id} style={[styles.chip, { backgroundColor: getRandomColor(m.id) + '20' }]}>
            <View style={[styles.chipAvatar, { backgroundColor: getRandomColor(m.id) }]}>
              <Text style={styles.chipAvatarText}>{getInitials(m.name)}</Text>
            </View>
            <Text style={[styles.chipName, { color: TEXT_PRIMARY }]}>{m.name}</Text>
            <TouchableOpacity onPress={() => onRemove(m.id)} style={styles.removeBtn}>
              <Ionicons name="close" size={14} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.gap / 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 8,
    opacity: 0.7,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeBtn: {
    padding: 2,
  },
});