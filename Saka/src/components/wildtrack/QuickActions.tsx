import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          onPress={action.onPress}
          style={styles.actionButton}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={action.icon} size={22} color="#2C3E50" />
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: BG_PANEL,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  iconContainer: {
    backgroundColor: BG_SUBTLE,
    padding: 11,
    borderRadius: 12,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
});