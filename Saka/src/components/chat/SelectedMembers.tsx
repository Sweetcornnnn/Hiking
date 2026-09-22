// SelectedMembers.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TEXT_PRIMARY, TEXT_MUTED } from '../../theme/designTokens';

export default function SelectedMembers({
  members,
  onRemove,
}: {
  members: any[];
  onRemove: (id: string) => void;
}) {
  if (members.length === 0) return null;

  const getInitials = (name: string) =>
    name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[parseInt(id) % colors.length];
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Selected ({members.length})</Text>
      <View style={styles.chipContainer}>
        {members.map((m) => {
          const color = getRandomColor(m.id);
          return (
            <View key={m.id} style={[styles.chip, { borderColor: color + '55' }]}>
              <View style={[styles.chipAvatar, { backgroundColor: color }]}>
                <Text style={styles.chipAvatarText}>{getInitials(m.name)}</Text>
              </View>
              <Text style={styles.chipName} numberOfLines={1}>
                {m.name}
              </Text>
              <TouchableOpacity
                onPress={() => onRemove(m.id)}
                style={styles.removeBtn}
                hitSlop={6}
              >
                <Ionicons name="close" size={12} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TEXT_MUTED,
    marginBottom: 8,
    opacity: 0.75,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    maxWidth: 200,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
  chipName: { fontSize: 12.5, fontWeight: '600', color: TEXT_PRIMARY, flexShrink: 1 },
  removeBtn: { padding: 2, marginLeft: 2 },
});