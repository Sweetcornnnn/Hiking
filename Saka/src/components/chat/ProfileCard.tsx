// components/chat/ProfileCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_BORDER,
  CHAT_ONLINE,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_MODAL,
  ACCENT_GREEN,
} from '../../theme/designTokens';
import { getAvatarColor, getInitials } from '../../utils/colors';
import { supabase } from '../../lib/supabase';
import { mountainService } from '../../services/mountainService';

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  created_at?: string | null;
  bio?: string | null;
};

// ── URL resolver ───────────────────────────────────────────
const toPublicUrl = (image: any): string => {
  if (!image) return '';
  const raw =
    typeof image === 'string'
      ? image
      : typeof image?.uri === 'string'
      ? image.uri
      : typeof image?.url === 'string'
      ? image.url
      : typeof image?.path === 'string'
      ? image.path
      : '';
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return supabase.storage.from('journal-images').getPublicUrl(raw).data.publicUrl;
};

// ── Image extractor ────────────────────────────────────────
const extractImages = (row: any): string[] => {
  if (!row) return [];
  const candidates = [
    row.images,
    row.image_urls,
    row.photos,
    row.photo_urls,
    row.media,
    row.image_url,
    row.image,
    row.photo,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      const urls = c.map(toPublicUrl).filter(Boolean);
      if (urls.length) return urls;
      continue;
    }
    if (typeof c === 'string') {
      const trimmed = c.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            const urls = parsed.map(toPublicUrl).filter(Boolean);
            if (urls.length) return urls;
          }
        } catch {}
      }
      if (trimmed.includes(',') && !trimmed.startsWith('http')) {
        const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        const urls = parts.map(toPublicUrl).filter(Boolean);
        if (urls.length > 1) return urls;
      }
      const url = toPublicUrl(trimmed);
      if (url) return [url];
    }
  }
  return [];
};

type MountainPhotoGroup = {
  mountainId: string;   // id or '__unassigned__'
  mountainName: string;
  photos: string[];
};

// ── Card geometry ──────────────────────────────────────────
const CARD_HEIGHT = 260;
const CARD_MAX_WIDTH = 460;
const CARD_H_MARGIN = 48;
const PANEL_PADDING = 14;
const COLLAGE_GAP = 4;
const COLLAGE_MAX_PREVIEW = 4;
const GRID_GAP = 8;
const GRID_COLS = 3;
const ALL_KEY = '__all__';

export default function ProfileCard({
  userId,
  visible,
  onClose,
  onMessagePress,
}: {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
  onMessagePress?: (userId: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Journal grouped by mountain, plus a flat "all" list
  const [photoGroups, setPhotoGroups] = useState<MountainPhotoGroup[]>([]);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [activeMountainId, setActiveMountainId] = useState<string>(ALL_KEY);

  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = Math.min(windowWidth - CARD_H_MARGIN, CARD_MAX_WIDTH);
  const leftPanelWidth = Math.max(
    140,
    Math.min(190, Math.round(cardWidth * 0.38))
  );

  const modalWidth = Math.min(windowWidth - 64, 380);
  const gridItemSize =
    (modalWidth - PANEL_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPhotoGroups([]);
    setAllPhotos([]);
    setActiveMountainId(ALL_KEY);
    setShowAllPhotos(false);
    setViewerIndex(null);

    (async () => {
      // ── 1. Profile ──
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, full_name, username, email, avatar_url, status, is_online, last_seen, created_at'
          )
          .eq('id', userId)
          .single();
        if (error) throw error;
        if (!cancelled) setProfile(data as Profile);
      } catch (e: any) {
        console.warn('[ProfileCard] profile load failed:', e?.message || e);
        if (!cancelled) setError('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }

      // ── 2. Public journal photos ──
      try {
        let { data, error } = await supabase
          .from('hiking_journals')
          .select('*')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && /user_id/i.test(error.message)) {
          const retry = await supabase
            .from('hiking_journals')
            .select('*')
            .eq('author_id', userId)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.warn('[ProfileCard] journal query failed:', error.message);
          return;
        }

        const rows = (data as any[]) || [];

        // Group photos by mountain_id
        const grouped = new Map<string, string[]>();
        const flat: string[] = [];
        for (const row of rows) {
          const urls = extractImages(row);
          if (!urls.length) continue;
          const key = row.mountain_id
            ? String(row.mountain_id)
            : '__unassigned__';
          const list = grouped.get(key) || [];
          list.push(...urls);
          grouped.set(key, list);
          flat.push(...urls);
        }

        // Dedup flat list for the "All" tab
        const uniqueAll = Array.from(new Set(flat));

        // Resolve mountain names for the tabs — build a lookup from
        // mountainService (it caches on first fetch, so it's fast).
        let mountains: { id: string; name: string }[] = [];
        try {
          const fetched = await mountainService.fetchMountains();
          mountains = (fetched || []).map((m: any) => ({
            id: String(m.id),
            name: m.name,
          }));
        } catch (e: any) {
          console.warn('[ProfileCard] mountainService fetch failed:', e?.message || e);
        }

        const nameById = new Map<string, string>();
        mountains.forEach((m) => nameById.set(m.id, m.name));

        // Build final groups, in the order returned by mountainService
        // so the ordering is stable and matches the rest of the app.
        const orderedGroups: MountainPhotoGroup[] = [];
        const consumed = new Set<string>();

        for (const m of mountains) {
          const photos = grouped.get(m.id);
          if (photos && photos.length) {
            orderedGroups.push({
              mountainId: m.id,
              mountainName: m.name,
              photos: Array.from(new Set(photos)),
            });
            consumed.add(m.id);
          }
        }

        // Any mountain IDs on entries that aren't in the service list —
        // append them at the end so no photos go missing.
        for (const [key, photos] of grouped.entries()) {
          if (consumed.has(key) || key === '__unassigned__') continue;
          orderedGroups.push({
            mountainId: key,
            mountainName: nameById.get(key) || 'Mountain',
            photos: Array.from(new Set(photos)),
          });
        }

        // Unassigned bucket
        const unassigned = grouped.get('__unassigned__');
        if (unassigned && unassigned.length) {
          orderedGroups.push({
            mountainId: '__unassigned__',
            mountainName: 'Mountain not selected',
            photos: Array.from(new Set(unassigned)),
          });
        }

        if (!cancelled) {
          setPhotoGroups(orderedGroups);
          setAllPhotos(uniqueAll);
        }
      } catch (e: any) {
        console.warn('[ProfileCard] journal threw:', e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  const name = profile?.full_name || profile?.username || 'Anonymous';
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(userId || '');
  const isOnline = !!profile?.is_online;

  const formatLastSeen = (ts: string | null) => {
    if (!ts) return 'Last seen unknown';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  };

  // ── Photos currently displayed in the collage ──
  const activePhotos = useMemo(() => {
    if (activeMountainId === ALL_KEY) return allPhotos;
    const g = photoGroups.find((p) => p.mountainId === activeMountainId);
    return g ? g.photos : [];
  }, [activeMountainId, allPhotos, photoGroups]);

  const hasJournal = allPhotos.length > 0;
  const previewPhotos = activePhotos.slice(0, COLLAGE_MAX_PREVIEW);
  const remainingCount = Math.max(0, activePhotos.length - COLLAGE_MAX_PREVIEW);
  const canSeeAll = activePhotos.length > COLLAGE_MAX_PREVIEW;

  // Tab carousel source — 'All' + every mountain with photos
  const tabSource = useMemo<MountainPhotoGroup[]>(() => {
    const tabs: MountainPhotoGroup[] = [];
    if (allPhotos.length) {
      tabs.push({
        mountainId: ALL_KEY,
        mountainName: 'All',
        photos: allPhotos,
      });
    }
    for (const g of photoGroups) tabs.push(g);
    return tabs;
  }, [allPhotos, photoGroups]);

  // ── Collage renderer (operates on previewPhotos) ───────
  const renderCollage = () => {
    const count = previewPhotos.length;

    if (count === 0) {
      return (
        <View style={styles.emptyGallery}>
          <Ionicons
            name="images-outline"
            size={22}
            color="rgba(201,169,110,0.45)"
          />
          <Text style={styles.emptyGalleryText}>No photos for this mountain</Text>
        </View>
      );
    }

    if (count === 1) {
      return (
        <Pressable
          style={[styles.collageSingle]}
          onPress={() => setViewerIndex(0)}
          android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
        >
          <Image
            source={{ uri: previewPhotos[0] }}
            style={styles.collageImage}
            resizeMode="cover"
          />
          <View pointerEvents="none" style={styles.collageHighlight} />
        </Pressable>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.collageRow}>
          {previewPhotos.map((url, i) => (
            <Pressable
              key={`${url}-${i}`}
              style={styles.collageHalf}
              onPress={() => setViewerIndex(i)}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            >
              <Image
                source={{ uri: url }}
                style={styles.collageImage}
                resizeMode="cover"
              />
              <View pointerEvents="none" style={styles.collageHighlight} />
            </Pressable>
          ))}
        </View>
      );
    }

    const rightColumnCount = count === 3 ? 2 : 3;
    const rightPhotos = previewPhotos.slice(1, 1 + rightColumnCount);

    return (
      <View style={styles.collageRow}>
        <Pressable
          style={styles.collageBig}
          onPress={() => setViewerIndex(0)}
          android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
        >
          <Image
            source={{ uri: previewPhotos[0] }}
            style={styles.collageImage}
            resizeMode="cover"
          />
          <View pointerEvents="none" style={styles.collageHighlight} />
        </Pressable>

        <View style={styles.collageColumn}>
          {rightPhotos.map((url, i) => {
            const realIndex = i + 1;
            const isLast = i === rightPhotos.length - 1;
            const showOverlay = isLast && remainingCount > 0;

            return (
              <Pressable
                key={`${url}-${realIndex}`}
                style={styles.collageStackItem}
                onPress={() =>
                  showOverlay ? setShowAllPhotos(true) : setViewerIndex(realIndex)
                }
                android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.collageImage}
                  resizeMode="cover"
                />
                <View pointerEvents="none" style={styles.collageHighlight} />

                {showOverlay && (
                  <View pointerEvents="none" style={styles.overlay}>
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      {/* ══════════ PROFILE CARD ══════════ */}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.card, { width: cardWidth }]}
            onPress={(e) => e.stopPropagation()}
          >
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={ACCENT_GOLD} />
                <Text style={styles.loadingText}>Loading profile…</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={26} color="#E07070" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.cardInner}>
                {/* ══ LEFT: profile ══ */}
                <View style={[styles.leftPanel, { width: leftPanelWidth }]}>
                  <View style={styles.identityRow}>
                    <View style={styles.avatarWrap}>
                      <View
                        style={[
                          styles.avatarRing,
                          {
                            backgroundColor: avatarColor + '22',
                            borderColor: avatarColor + '55',
                          },
                        ]}
                      >
                        <View
                          style={[styles.avatar, { backgroundColor: avatarColor }]}
                        >
                          <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                      </View>
                      {isOnline && (
                        <View style={styles.onlineDotOuter}>
                          <View style={styles.onlineDotInner} />
                        </View>
                      )}
                    </View>

                    <View style={styles.identityText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {name}
                      </Text>
                      {profile?.username && (
                        <Text style={styles.username} numberOfLines={1}>
                          @{profile.username}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.statusPill,
                          isOnline
                            ? styles.statusPillOnline
                            : styles.statusPillOffline,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isOnline
                                ? CHAT_ONLINE
                                : 'rgba(255,255,255,0.4)',
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: isOnline ? CHAT_ONLINE : TEXT_MUTED },
                          ]}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.detailsBlock}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>
                        {profile?.email || '—'}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>
                        {profile?.status ||
                          (isOnline
                            ? 'Active now'
                            : formatLastSeen(profile?.last_seen || null))}
                      </Text>
                    </View>

                    {profile?.created_at && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Joined</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>
                          {new Date(profile.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }} />

                  {onMessagePress && (
                    <Pressable
                      onPress={() => onMessagePress(profile!.id)}
                      style={({ pressed }) => [
                        styles.messageBtn,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                      ]}
                    >
                      <Ionicons name="chatbubble" size={11} color={CHAT_BG} />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </Pressable>
                  )}
                </View>

                {/* ══ RIGHT: mountain tabs + collage ══ */}
                <View style={styles.rightPanel}>
                  {/* Header: TRAIL JOURNAL + See all / count */}
                  <View style={styles.galleryHeader}>
                    <View style={styles.galleryHeaderLeft}>
                      <View style={styles.journalIconWell}>
                        <Ionicons
                          name="images-outline"
                          size={11}
                          color={ACCENT_GOLD}
                        />
                      </View>
                      <Text style={styles.journalLabel}>Trail Journal</Text>
                    </View>

                    {canSeeAll ? (
                      <Pressable
                        onPress={() => setShowAllPhotos(true)}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.seeAllBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.seeAllText}>See all</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={10}
                          color={ACCENT_GOLD}
                        />
                      </Pressable>
                    ) : activePhotos.length > 0 ? (
                      <Text style={styles.journalCount}>
                        {activePhotos.length.toString().padStart(2, '0')}
                      </Text>
                    ) : null}
                  </View>

                  {/* ── Mountain chip carousel ── */}
                  {hasJournal && tabSource.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.tabsScroll}
                      style={styles.tabsWrap}
                    >
                      {tabSource.map((tab) => {
                        const active = activeMountainId === tab.mountainId;
                        return (
                          <Pressable
                            key={tab.mountainId}
                            onPress={() => setActiveMountainId(tab.mountainId)}
                            style={({ pressed }) => [
                              styles.tabChip,
                              active && styles.tabChipActive,
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tabChipText,
                                active && styles.tabChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {tab.mountainName}
                            </Text>
                            <View
                              style={[
                                styles.tabChipCount,
                                active && styles.tabChipCountActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tabChipCountText,
                                  active && styles.tabChipCountTextActive,
                                ]}
                              >
                                {tab.photos.length}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  {/* ── Collage (filtered by active tab) ── */}
                  {hasJournal ? (
                    <View style={styles.collageWrap}>{renderCollage()}</View>
                  ) : (
                    <View style={styles.emptyGallery}>
                      <Ionicons
                        name="images-outline"
                        size={22}
                        color="rgba(201,169,110,0.45)"
                      />
                      <Text style={styles.emptyGalleryText}>
                        No public photos
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════ SEE ALL — 3-column grid, filters by active tab ══════════ */}
      <Modal
        visible={showAllPhotos}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAllPhotos(false)}
      >
        <Pressable
          style={styles.galleryBackdrop}
          onPress={() => setShowAllPhotos(false)}
        >
          <Pressable
            style={[styles.galleryModal, { width: modalWidth }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.galleryModalHeader}>
              <View style={styles.galleryHeaderLeft}>
                <View style={styles.journalIconWell}>
                  <Ionicons
                    name="images-outline"
                    size={11}
                    color={ACCENT_GOLD}
                  />
                </View>
                <View>
                  <Text style={styles.galleryModalTitle}>
                    {activeMountainId === ALL_KEY
                      ? 'Trail Journal'
                      : photoGroups.find(
                          (g) => g.mountainId === activeMountainId
                        )?.mountainName || 'Trail Journal'}
                  </Text>
                  <Text style={styles.galleryModalSubtitle}>
                    {activePhotos.length.toString().padStart(2, '0')}{' '}
                    {activePhotos.length === 1 ? 'PHOTO' : 'PHOTOS'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setShowAllPhotos(false)}
                style={styles.galleryModalClose}
                hitSlop={8}
              >
                <Ionicons name="close" size={14} color={TEXT_MUTED} />
              </Pressable>
            </View>

            <FlatList
              data={activePhotos}
              keyExtractor={(url, index) => `${url}-all-${index}`}
              numColumns={GRID_COLS}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.galleryGrid}
              columnWrapperStyle={styles.galleryRow}
              renderItem={({ item: url, index }) => (
                <Pressable
                  onPress={() => setViewerIndex(index)}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                  style={[
                    styles.galleryGridItem,
                    { width: gridItemSize, height: gridItemSize },
                  ]}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.galleryGridImage}
                    resizeMode="cover"
                  />
                  <View pointerEvents="none" style={styles.collageHighlight} />
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════ FULLSCREEN VIEWER — filters by active tab ══════════ */}
      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerBackdrop}>
          <Animated.FlatList
            data={activePhotos}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIndex ?? 0}
            keyExtractor={(url, i) => `${url}-viewer-${i}`}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({
              length: windowWidth,
              offset: windowWidth * i,
              index: i,
            })}
            onMomentumScrollEnd={(
              e: NativeSyntheticEvent<NativeScrollEvent>
            ) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
              setViewerIndex(Math.max(0, Math.min(idx, activePhotos.length - 1)));
            }}
            renderItem={({ item }) => (
              <View style={[styles.viewerSlide, { width: windowWidth }]}>
                <Image
                  source={{ uri: item }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          <View style={styles.viewerTopRow} pointerEvents="box-none">
            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>
                {(viewerIndex ?? 0) + 1}
                <Text style={styles.viewerCounterDim}>
                  {' '}
                  / {activePhotos.length}
                </Text>
              </Text>
            </View>

            <Pressable
              onPress={() => setViewerIndex(null)}
              style={styles.viewerClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CARD_H_MARGIN / 2,
  },
  card: {
    height: CARD_HEIGHT,
    backgroundColor: CHAT_BG,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  cardInner: { flex: 1, flexDirection: 'row' },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(10,17,26,0.72)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    borderLeftColor: 'rgba(255,255,255,0.05)',
    borderRightColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadingText: { fontSize: 11, color: TEXT_MUTED },
  errorText: { fontSize: 11, color: '#E07070', fontWeight: '600' },

  // ── Left panel ──
  leftPanel: {
    height: CARD_HEIGHT,
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: CHAT_BORDER,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  onlineDotOuter: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(111,175,138,0.20)',
    borderWidth: 1.5,
    borderColor: CHAT_BG,
  },
  onlineDotInner: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: CHAT_ONLINE,
  },
  identityText: { flex: 1, minWidth: 0, gap: 1 },
  name: {
    fontSize: 11.5,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.1,
  },
  username: { fontSize: 8.5, color: TEXT_MUTED, opacity: 0.75 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusPillOnline: { backgroundColor: 'rgba(111,175,138,0.12)' },
  statusPillOffline: { backgroundColor: 'rgba(255,255,255,0.05)' },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusPillText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: CHAT_BORDER,
    marginVertical: 10,
  },
  detailsBlock: { width: '100%', gap: 8 },
  infoRow: { width: '100%' },
  infoLabel: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: ACCENT_GOLD,
    opacity: 0.9,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
    lineHeight: 13,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: ACCENT_GOLD,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    borderBottomColor: 'rgba(0,0,0,0.10)',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'flex-start',
  },
  messageBtnText: {
    color: CHAT_BG,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Right panel ──
  rightPanel: {
    flex: 1,
    height: CARD_HEIGHT,
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 12,
    backgroundColor: 'rgba(201,169,110,0.02)',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  galleryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  journalIconWell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderTopColor: 'rgba(201,169,110,0.35)',
    borderBottomColor: 'rgba(201,169,110,0.15)',
    borderLeftColor: 'rgba(201,169,110,0.22)',
    borderRightColor: 'rgba(201,169,110,0.22)',
  },
  journalLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: ACCENT_GOLD,
    textTransform: 'uppercase',
  },
  journalCount: {
    fontSize: 8.5,
    fontWeight: '700',
    color: TEXT_MUTED,
    opacity: 0.8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(201,169,110,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.24)',
  },
  seeAllText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: ACCENT_GOLD,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // ── Mountain chip tabs ──
  tabsWrap: {
    maxHeight: 26,
    marginBottom: 8,
  },
  tabsScroll: {
    gap: 5,
    paddingRight: 4,
    alignItems: 'center',
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    borderLeftColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(255,255,255,0.06)',
    maxWidth: 140,
  },
  tabChipActive: {
    backgroundColor: 'rgba(201,169,110,0.14)',
    borderTopColor: 'rgba(201,169,110,0.42)',
    borderBottomColor: 'rgba(201,169,110,0.18)',
    borderLeftColor: 'rgba(201,169,110,0.30)',
    borderRightColor: 'rgba(201,169,110,0.30)',
  },
  tabChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  tabChipTextActive: {
    color: ACCENT_GOLD,
    fontWeight: '800',
  },
  tabChipCount: {
    minWidth: 14,
    height: 14,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabChipCountActive: {
    backgroundColor: 'rgba(201,169,110,0.30)',
  },
  tabChipCountText: {
    fontSize: 8,
    fontWeight: '800',
    color: TEXT_MUTED,
    fontVariant: ['tabular-nums'],
  },
  tabChipCountTextActive: {
    color: ACCENT_GOLD,
  },

  // Collage
  collageWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  collageRow: { flex: 1, flexDirection: 'row', gap: COLLAGE_GAP },
  collageSingle: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  collageHalf: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  collageBig: {
    flex: 1.6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  collageColumn: { flex: 1, gap: COLLAGE_GAP },
  collageStackItem: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  collageImage: { width: '100%', height: '100%' },
  collageHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,17,26,0.66)',
  },
  overlayText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT_GOLD,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  emptyGallery: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyGalleryText: {
    fontSize: 9.5,
    color: TEXT_MUTED,
    opacity: 0.6,
    textAlign: 'center',
  },

  // ── See all modal ──
  galleryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  galleryModal: {
    maxHeight: '78%',
    backgroundColor: CHAT_BG,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  galleryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PANEL_PADDING,
    paddingTop: PANEL_PADDING,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CHAT_BORDER,
  },
  galleryModalTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  galleryModalSubtitle: {
    fontSize: 8.5,
    fontWeight: '700',
    color: TEXT_MUTED,
    opacity: 0.75,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  galleryModalClose: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    borderLeftColor: 'rgba(255,255,255,0.05)',
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  galleryGrid: {
    paddingHorizontal: PANEL_PADDING,
    paddingTop: 12,
    paddingBottom: PANEL_PADDING,
    gap: GRID_GAP,
  },
  galleryRow: {
    gap: GRID_GAP,
    justifyContent: 'flex-start',
  },
  galleryGridItem: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  galleryGridImage: { width: '100%', height: '100%' },

  // ── Fullscreen viewer ──
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerSlide: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 60,
  },
  viewerImage: { width: '100%', height: '100%' },
  viewerTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 10,
  },
  viewerCounter: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  viewerCounterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  viewerCounterDim: { color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  viewerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderLeftColor: 'rgba(255,255,255,0.10)',
    borderRightColor: 'rgba(255,255,255,0.10)',
  },
});