import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TipsAndTricks from '../../components/mountainInfo/TipsAndTricks';
import { MOUNTAIN_TIPS } from '../../data/mountainTips';
import { ACCENT_GOLD, BG_CARD, TEXT_PRIMARY } from '../../theme/designTokens';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function TipsAndTricksScreen() {
  const router = useRouter();
  const { mountainId: mountainIdParam, mountainName: mountainNameParam } = useLocalSearchParams<{
    mountainId?: string | string[];
    mountainName?: string | string[];
  }>();
  const mountainId = firstParam(mountainIdParam);
  const mountainName = firstParam(mountainNameParam);
  const normalizedName = mountainName?.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mountainTips = MOUNTAIN_TIPS.find((tips) =>
    tips.id === mountainId ||
    (normalizedName && tips.mountainName.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName)
  );

  if (mountainTips) {
    return (
      <SafeAreaView style={styles.fullScreen}>
        <TipsAndTricks mountainTips={mountainTips} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={styles.emptyState}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close tips and tricks"
        >
          <View style={styles.backIconCircle}>
            <Ionicons name="chevron-back" size={14} color={ACCENT_GOLD} />
          </View>
        </TouchableOpacity>
        <View style={styles.message}>
          <Text style={styles.title}>Guide not available</Text>
          <Text style={styles.description}>Tips for this mountain are not available yet.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: BG_CARD,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: BG_CARD,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  backIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201,169,110,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: 'center',
  },
});