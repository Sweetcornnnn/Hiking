import React, { useMemo } from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TipsAndTricks from '../../components/mountainInfo/TipsAndTricks';
import ContourMark from '../../components/mountainInfo/ContourMark';
import { MOUNTAIN_TIPS } from '../../data/mountainTips';
import { ACCENT_GOLD, BG_CARD, TEXT_PRIMARY } from '../../theme/designTokens';

const GOLD_SOFT = 'rgba(201,169,110,0.12)';
const GOLD_LINE = 'rgba(201,169,110,0.35)';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalize(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

type EmptyStateProps = {
  mountainName?: string;
  onBack: () => void;
};

function EmptyState({ mountainName, onBack }: EmptyStateProps) {
  const hasName = Boolean(mountainName);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.emptyRoot}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={ACCENT_GOLD} />
        </Pressable>

        <View style={styles.emptyBody}>
          <ContourMark size={180} summit style={styles.contour} />
          <Text style={styles.title} accessibilityRole="header">
            {hasName ? `No guide for ${mountainName} yet` : 'Choose a mountain first'}
          </Text>
          <Text style={styles.description}>
            {hasName
              ? 'We haven’t written trail tips for this mountain. Check back after the next update.'
              : 'Open a mountain from the list to see its trail tips.'}
          </Text>
        </View>

        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>
            {hasName ? 'Back to mountain' : 'Back to mountains'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function TipsAndTricksScreen() {
  const router = useRouter();
  const { mountainId: mountainIdParam, mountainName: mountainNameParam } = useLocalSearchParams<{
    mountainId?: string | string[];
    mountainName?: string | string[];
  }>();

  const mountainId = firstParam(mountainIdParam);
  const mountainName = firstParam(mountainNameParam);

  const mountainTips = useMemo(() => {
    const byId = mountainId ? MOUNTAIN_TIPS.find((tips) => tips.id === mountainId) : undefined;
    if (byId) return byId;

    const target = normalize(mountainName);
    if (!target) return undefined;
    return MOUNTAIN_TIPS.find((tips) => normalize(tips.mountainName) === target);
  }, [mountainId, mountainName]);

  const goBack = () => router.back();

  // TipsAndTricks manages its own safe area, so it is not wrapped again here.
  if (mountainTips) {
    return (
      <View style={styles.screen}>
        <TipsAndTricks mountainTips={mountainTips} onBack={goBack} />
      </View>
    );
  }

  return <EmptyState mountainName={mountainName} onBack={goBack} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_CARD,
  },
  emptyRoot: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GOLD_SOFT,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  contour: {
    marginBottom: 36,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: TEXT_PRIMARY,
    opacity: 0.68,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: BG_CARD,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});