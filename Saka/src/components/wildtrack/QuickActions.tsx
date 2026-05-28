import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  ACCENT_GREEN,
} from '../../theme/designTokens';

const { width, height } = Dimensions.get('window');
const isLandscape = width >= height;

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
            <Ionicons name={action.icon} size={24} color="#2C3E50" />
          </View>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isLandscape ? 14 : 12,
    marginBottom: isLandscape ? 16 : 20,
  },
  actionButton: {
    flex: 1,
    minWidth: isLandscape ? '30%' : '45%',
    backgroundColor: BG_PANEL,
    borderRadius: 16,
    padding: isLandscape ? 18 : 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  iconContainer: {
    backgroundColor: BG_SUBTLE,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
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
