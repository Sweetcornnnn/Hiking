// ChatTabs.tsx - Fixed with transparent background
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ACCENT_GOLD, TEXT_MUTED, TEXT_PRIMARY, BG_PANEL } from '../../theme/designTokens';
import { Ionicons } from '@expo/vector-icons';

export default function ChatTabs({ active, onChange }: { active: string; onChange: (s: any) => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.tabsWrapper}>
        <TouchableOpacity 
          style={[styles.tab, active === 'world' && styles.activeTab]} 
          onPress={() => onChange('world')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Ionicons name="globe-outline" size={20} color={TEXT_PRIMARY} />
            <Text style={[styles.tabLabel, active === 'world' ? styles.activeLabel : styles.inactiveLabel]}>
              World
            </Text>
            {active === 'world' && <View style={styles.activeIndicator} />}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, active === 'private' && styles.activeTab]} 
          onPress={() => onChange('private')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Ionicons name="chatbubbles-outline" size={20} color={TEXT_PRIMARY} />
            <Text style={[styles.tabLabel, active === 'private' ? styles.activeLabel : styles.inactiveLabel]}>
              Private
            </Text>
            {active === 'private' && <View style={styles.activeIndicator} />}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent', // Changed from BG_PANEL
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: ACCENT_GOLD,
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  tabIcon: {
    fontSize: 13,
    opacity: 0.5,
  },
  activeIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  activeLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inactiveLabel: {
    color: TEXT_MUTED,
    opacity: 0.6,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});