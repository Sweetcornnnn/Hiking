// components/chat/SelectedMembers.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TEXT_PRIMARY, TEXT_MUTED } from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';

export default function SelectedMembers({
  members,
  onRemove,
}: {
  members: any[];
  onRemove: (id: string) => void;
}) {
  if (members.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Selected ({members.length})</Text>
      <View style={styles.chipContainer}>
        {members.map((m) => {
          const color = getAvatarColor(m.id);
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
                <Ionicons name="close" size={11} color="rgba(255,255,255,0.65)" />
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
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_MUTED,
    marginBottom: 6,
    opacity: 0.75,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 3,
    paddingRight: 6,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    maxWidth: 180,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  chipName: { fontSize: 11.5, fontWeight: '600', color: TEXT_PRIMARY, flexShrink: 1 },
  removeBtn: { padding: 1, marginLeft: 1 },
});