import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  getMountainAlertKey,
  getUnreadMountainAlertKeys,
  markMountainAlertRead,
} from '../../services/mountainAlertReadService';
import type { Alert, MountainTips } from '../../data/mountainTips';
import { Text, StyleSheet, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TipsAndTricks from '../../components/mountainInfo/TipsAndTricks';
import ContourMark from '../../components/mountainInfo/ContourMark';
import { SERIF } from '../../components/events/TrailKit';
import { Skeleton } from '../../components/organizations/Skeleton';
import { ACCENT_GOLD, BG_CARD, BG_PANEL, BORDER_DEFAULT, MI_MAX_WIDTH, MI_RADIUS, MI_SPACE, TEXT_PRIMARY } from '../../theme/designTokens';
import { managerService } from '../../services/managerService';

const GOLD_SOFT = 'rgba(201,169,110,0.12)';
const GOLD_LINE = 'rgba(201,169,110,0.35)';
const EMPTY_ALERT_KEYS = new Set<string>();

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasGuideContent(tips: MountainTips) {
  return tips.preparation.length > 0
    || tips.safety.length > 0
    || tips.transportation.length > 0
    || tips.trailTips.length > 0
    || tips.etiquette.length > 0
    || tips.alerts.length > 0
    || Boolean(tips.preparationGuide || tips.safetyGuide || tips.transportGuide || tips.trailGuide || tips.etiquetteGuide);
}

type EmptyStateProps = {
  mountainName?: string;
  title?: string;
  description?: string;
  onBack: () => void;
};

function EmptyState({ mountainName, title, description, onBack }: EmptyStateProps) {
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
            {title ?? (hasName ? `No guide for ${mountainName} yet` : 'Choose a mountain first')}
          </Text>
          <Text style={styles.description}>
            {description ?? (hasName
              ? 'We haven’t written trail tips for this mountain. Check back after the next update.'
              : 'Open a mountain from the list to see its trail tips.')}
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

function GuideSkeleton({ mountainName, onBack }: { mountainName?: string; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.skeletonContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.skeletonStack}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading mountain guide"
        >
          <View style={styles.skeletonHeader}>
            <Pressable
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [styles.guideHeaderBack, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back to mountain"
            >
              <Ionicons name="home-outline" size={18} color={ACCENT_GOLD} />
            </Pressable>
            <View style={styles.skeletonHeaderText}>
              {mountainName
                ? <Text style={styles.skeletonMountainName} numberOfLines={1}>{mountainName} Hiking Guide</Text>
                : <Skeleton width="70%" height={20} />}
              <Skeleton width="46%" height={12} />
              <Skeleton width="34%" height={12} />
            </View>
            <View style={styles.guideHeaderSpacer} />
          </View>

          <View style={styles.skeletonColumn}>
            <View style={styles.skeletonBanner}>
              <Skeleton width={44} height={44} radius={14} />
              <View style={styles.skeletonBannerText}>
                <Skeleton width="66%" height={14} />
                <Skeleton width="88%" height={11} />
              </View>
              <Skeleton width={16} height={16} radius={8} />
            </View>

            <View style={styles.skeletonHero}>
              {[0, 1].map((item) => (
                <View key={item} style={styles.skeletonHeroTile}>
                  <View style={styles.skeletonHeroTop}>
                    <Skeleton width={56} height={56} radius={16} />
                    <Skeleton width={42} height={16} radius={8} />
                  </View>
                  <Skeleton width="62%" height={14} />
                  <Skeleton width="92%" height={10} />
                  <Skeleton width="78%" height={10} />
                </View>
              ))}
            </View>

            <GuideRowSkeleton />
            <GuideRowSkeleton compact />
            <GuideRowSkeleton compact />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GuideRowSkeleton({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? 48 : 64;

  return (
    <View style={[styles.skeletonRow, compact && styles.skeletonRowCompact]}>
      <Skeleton width={iconSize} height={iconSize} radius={14} />
      <View style={styles.skeletonRowText}>
        <Skeleton width="38%" height={13} />
        <Skeleton width="76%" height={11} />
        {!compact && <Skeleton width="54%" height={10} />}
      </View>
      <Skeleton width={16} height={16} radius={8} />
    </View>
  );
}

export default function TipsAndTricksScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { mountainId: mountainIdParam, mountainName: mountainNameParam } = useLocalSearchParams<{
    mountainId?: string | string[];
    mountainName?: string | string[];
  }>();

  const mountainId = firstParam(mountainIdParam);
  const mountainName = firstParam(mountainNameParam);

  const [tipsState, setTipsState] = useState<{
    mountainId: string | null;
    tips: MountainTips | null;
    error: string | null;
  }>({ mountainId: null, tips: null, error: null });
  const [unreadAlertState, setUnreadAlertState] = useState<{
    userId: string | null;
    mountainId: string | null;
    keys: Set<string>;
  }>({ userId: null, mountainId: null, keys: new Set() });
  const displayedMountainTips = tipsState.mountainId === mountainId ? tipsState.tips : null;
  const tipsError = tipsState.mountainId === mountainId ? tipsState.error : null;
  const tipsLoading = Boolean(mountainId) && tipsState.mountainId !== mountainId;
  const unreadAlertKeys = user && displayedMountainTips
    && unreadAlertState.userId === user.id
    && unreadAlertState.mountainId === displayedMountainTips.id
    ? unreadAlertState.keys
    : EMPTY_ALERT_KEYS;

  useEffect(() => {
    let active = true;
    if (!mountainId) return () => { active = false; };
    void managerService.fetchContent(mountainId, mountainName ?? 'Mountain')
      .then((content) => {
        if (active) setTipsState({ mountainId, tips: content.tips_data, error: null });
      })
      .catch((error: unknown) => {
        console.warn('[TipsAndTricks] Failed to load official mountain information:', error);
        if (active) setTipsState({
          mountainId,
          tips: null,
          error: error instanceof Error ? error.message : 'Unable to load mountain tips.',
        });
      });
    return () => { active = false; };
  }, [mountainId, mountainName]);

  useEffect(() => {
    let active = true;
    if (!user || !displayedMountainTips) return () => { active = false; };

    void getUnreadMountainAlertKeys(user.id, displayedMountainTips)
      .then((keys) => {
        if (active) setUnreadAlertState({
          userId: user.id,
          mountainId: displayedMountainTips.id,
          keys,
        });
      })
      .catch((error) => {
        console.warn('[TipsAndTricks] Failed to load unread alerts:', error);
      });

    return () => {
      active = false;
    };
  }, [displayedMountainTips, user]);

  const goBack = () => router.back();
  const handleAlertViewed = useCallback(async (alert: Alert) => {
    if (!user || !displayedMountainTips) return;
    const key = getMountainAlertKey(displayedMountainTips, alert);
    if (!unreadAlertKeys.has(key)) return;
    try {
      await markMountainAlertRead(user.id, displayedMountainTips, alert);
      setUnreadAlertState((current) => {
        if (current.userId !== user.id || current.mountainId !== displayedMountainTips.id) return current;
        const next = new Set(current.keys);
        next.delete(key);
        return { ...current, keys: next };
      });
    } catch (error) {
      console.warn('[TipsAndTricks] Failed to save read alert:', error);
    }
  }, [displayedMountainTips, unreadAlertKeys, user]);

  // TipsAndTricks manages its own safe area, so it is not wrapped again here.
  if (displayedMountainTips && hasGuideContent(displayedMountainTips)) {
    return (
      <View style={styles.screen}>
        <TipsAndTricks
          mountainTips={displayedMountainTips}
          unreadAlertKeys={unreadAlertKeys}
          onAlertViewed={handleAlertViewed}
          onBack={goBack}
        />
      </View>
    );
  }

  if (tipsLoading) {
    return <GuideSkeleton mountainName={mountainName} onBack={goBack} />;
  }
  if (tipsError) {
    return <EmptyState mountainName={mountainName} title="Couldn’t load mountain guide" description={tipsError} onBack={goBack} />;
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
  skeletonContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    gap: MI_SPACE.sm,
    paddingBottom: MI_SPACE.lg,
  },
  skeletonStack: {
    width: '100%',
    gap: MI_SPACE.sm,
  },
  skeletonColumn: {
    width: '100%',
    maxWidth: MI_MAX_WIDTH + MI_SPACE.screen * 2,
    alignSelf: 'center',
    paddingHorizontal: MI_SPACE.screen,
    gap: MI_SPACE.sm,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: MI_SPACE.screen,
    minHeight: 40,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },
  guideHeaderBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: 24 }],
  },
  guideHeaderSpacer: {
    width: 36,
  },
  skeletonHeaderText: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  skeletonMountainName: {
    color: TEXT_PRIMARY,
    fontFamily: SERIF,
    fontSize: 20,
    textAlign: 'center',
  },
  skeletonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    borderRadius: MI_RADIUS.card,
    backgroundColor: BG_PANEL,
  },
  skeletonBannerText: {
    flex: 1,
    gap: 7,
  },
  skeletonHero: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    borderRadius: MI_RADIUS.card,
    backgroundColor: BG_PANEL,
    overflow: 'hidden',
  },
  skeletonHeroTile: {
    flex: 1,
    minWidth: 0,
    padding: MI_SPACE.md,
    gap: 7,
  },
  skeletonHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    borderRadius: MI_RADIUS.card,
    backgroundColor: BG_PANEL,
  },
  skeletonRowCompact: {
    padding: 8,
    gap: 10,
  },
  skeletonRowText: {
    flex: 1,
    gap: 6,
  },
  pressed: {
    opacity: 0.75,
  },
});