import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { JournalEntry } from '../../types/journal';
import type { Mountain } from '../../services/mountainService';
import {
  ACCENT_GOLD,
  ANIM,
  BG_AVATAR,
  BG_CARD,
  BG_GOLD_ICON,
  BG_GOLD_TINT,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DANGER,
  BORDER_DEFAULT,
  BORDER_GOLD,
  BORDER_GOLD_SOFT,
  BORDER_SUBTLE,
  CHAT_FS_BODY,
  CHAT_FS_TITLE,
  FONT,
  RADIUS_CARD,
  SPACING,
  TEXT_DANGER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  CHAT_BORDER_STRONG,
} from '../../theme/designTokens';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  entries: JournalEntry[];
  mountains: Mountain[];
  isLoading?: boolean;
  onDelete: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry, index: number, uri: string) => void;
  onUpdateNote?: (entry: JournalEntry, changes: NoteChanges) => Promise<void> | void;
  onNewEntry: () => void;
  onBack: () => void;
}

type NoteChanges = { title: string; content: string };

const getImageUrl = (image: string): string => {
  if (/^(file:|content:)/i.test(image)) return image;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return supabase.storage.from('journal-images').getPublicUrl(image).data.publicUrl ?? '';
};

const CARD_HEIGHT_RATIO = 0.94;
const LOOP_REPEATS = 3;
const SIDE_SCALE = 0.72;
const SIDE_OPACITY = 0.3;
const LINE_HEIGHT = 20;
const HOLE_COUNT = 4;
const PHOTO_RADIUS = 12;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const OVERLAY = `${BG_CARD}CC`;
const BACKDROP = `${BG_CARD}EB`;

function JournalHeader({
  subtitle,
  onBack,
  onNewEntry,
  onDelete,
}: {
  subtitle?: string;
  onBack: () => void;
  onNewEntry: () => void;
  onDelete?: () => void;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        <View style={styles.titlePill}>
          <Text style={styles.headerTitle} numberOfLines={1}>My Journal</Text>
          {!!subtitle && (
            <>
              <View style={styles.titleDivider} />
              <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={onNewEntry}
          style={styles.newEntryBtn}
          accessibilityRole="button"
          accessibilityLabel="New journal entry"
        >
          <Ionicons name="add" size={18} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        {!!onDelete && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete journal entry"
          >
            <Ionicons name="trash-outline" size={16} color={TEXT_DANGER} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function MyJournalFeed({
  entries,
  mountains,
  isLoading = false,
  onDelete,
  onEdit,
  onUpdateNote,
  onNewEntry,
  onBack,
}: Props) {
  const mountainsById = useMemo(() => {
    const map = new Map<string, string>();
    mountains.forEach((mountain) => map.set(mountain.id, mountain.name));
    return map;
  }, [mountains]);

  if (isLoading && entries.length === 0) {
    return (
      <>
        <JournalHeader onBack={onBack} onNewEntry={onNewEntry} />
        <SkeletonCard />
      </>
    );
  }

  if (!isLoading && entries.length === 0) {
    return (
      <>
        <JournalHeader onBack={onBack} onNewEntry={onNewEntry} />
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={22} color={ACCENT_GOLD} />
          </View>
          <Text style={styles.emptyTitle}>Your journal is empty</Text>
          <Text style={styles.emptyText}>
            Write about a hike, add photos, and make the memory part of your profile.
          </Text>
          <TouchableOpacity
            onPress={onNewEntry}
            style={styles.emptyButton}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={15} color={BG_CARD} />
            <Text style={styles.emptyButtonText}>New journal entry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <DiaryCarousel
      key={entries.map((entry) => entry.id).join(':')}
      entries={entries}
      mountainsById={mountainsById}
      onDelete={onDelete}
      onEdit={onEdit}
      onUpdateNote={onUpdateNote}
      onBack={onBack}
      onNewEntry={onNewEntry}
    />
  );
}

function DiaryCarousel({
  entries,
  mountainsById,
  onDelete,
  onEdit,
  onUpdateNote,
  onBack,
  onNewEntry,
}: {
  entries: JournalEntry[];
  mountainsById: Map<string, string>;
  onDelete: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry, index: number, uri: string) => void;
  onUpdateNote?: (entry: JournalEntry, changes: NoteChanges) => Promise<void> | void;
  onBack: () => void;
  onNewEntry: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const count = entries.length;
  const loops = count > 1;
  const fallbackHeight = Math.round(Math.max(340, Math.min(windowHeight * 0.6, 520)));
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const panelHeight = measuredHeight > 0 ? measuredHeight : fallbackHeight;
  const cardHeight = Math.round(panelHeight * CARD_HEIGHT_RATIO);
  const cardGap = -Math.round(cardHeight * 0.04);
  const itemHeight = cardHeight + cardGap;
  const verticalPad = (panelHeight - cardHeight) / 2;
  const middleStart = loops ? count * Math.floor(LOOP_REPEATS / 2) : 0;

  const slots = useMemo(
    () => Array.from({ length: count * (loops ? LOOP_REPEATS : 1) }, (_, slot) => ({
      entry: entries[slot % count],
      slot,
    })),
    [entries, count, loops],
  );
  const scrollRef = useRef<ScrollView | null>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const lastSlot = useRef(middleStart);
  const [fade] = useState(() => new Animated.Value(1));
  const [activeSlot, setActiveSlot] = useState(middleStart);
  const [shownIndex, setShownIndex] = useState(0);
  const [pageOpen, setPageOpen] = useState(false);

  const activeIndex = activeSlot % count;
  const activeEntry = entries[activeIndex];
  const shownEntry = entries[Math.min(shownIndex, count - 1)];
  const shownImages = useMemo(
    () => (shownEntry.images ?? []).filter(Boolean).map(getImageUrl).filter(Boolean),
    [shownEntry.images],
  );

  useEffect(() => {
    if (!loops) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: middleStart * itemHeight, animated: false });
      scrollY.setValue(middleStart * itemHeight);
    });
    return () => cancelAnimationFrame(frame);
  }, [itemHeight, loops, middleStart, scrollY]);

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollY.setValue(offsetY);
    const slot = Math.max(0, Math.min(slots.length - 1, Math.round(offsetY / itemHeight)));
    if (slot !== lastSlot.current) {
      lastSlot.current = slot;
      setActiveSlot(slot);
    }
  };

  const handleMomentumEnd = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (!loops) return;
    const slot = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    if (slot < count || slot >= count * 2) {
      const position = ((slot % count) + count) % count;
      const centeredSlot = middleStart + position;
      scrollRef.current?.scrollTo({ y: centeredSlot * itemHeight, animated: false });
      scrollY.setValue(centeredSlot * itemHeight);
      lastSlot.current = centeredSlot;
      setActiveSlot(centeredSlot);
    }
  };

  useEffect(() => {
    if (activeIndex === shownIndex) return;
    fade.stopAnimation();
    Animated.timing(fade, {
      toValue: 0,
      duration: ANIM.fadeMs / 2,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShownIndex(activeIndex);
      Animated.timing(fade, {
        toValue: 1,
        duration: ANIM.fadeMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  }, [activeIndex, fade, shownIndex]);

  const goTo = (slot: number) =>
    scrollRef.current?.scrollTo({ y: slot * itemHeight, animated: true });

  return (
    <View style={[styles.card, styles.fill, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <JournalHeader
        subtitle={count > 1 ? `Page ${activeIndex + 1} of ${count}` : 'Page 1'}
        onBack={onBack}
        onNewEntry={onNewEntry}
        onDelete={() => onDelete(activeEntry)}
      />

      <View
        style={[styles.row, styles.fill]}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          setMeasuredHeight((current) =>
            nextHeight > 0 && nextHeight !== current ? nextHeight : current,
          );
        }}
      >
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.notesColumn}
          contentContainerStyle={{ paddingVertical: verticalPad }}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          bounces={false}
          nestedScrollEnabled
          scrollEnabled={loops}
          snapToInterval={itemHeight}
          snapToAlignment="start"
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumEnd}
        >
          {slots.map(({ entry, slot }) => {
            const inputRange = [
              (slot - 1) * itemHeight,
              slot * itemHeight,
              (slot + 1) * itemHeight,
            ];
            const scale = scrollY.interpolate({
              inputRange,
              outputRange: [SIDE_SCALE, 1, SIDE_SCALE],
              extrapolate: 'clamp',
            });
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={`${entry.id}-${slot}`}
                style={{
                  height: cardHeight,
                  marginBottom: cardGap,
                  transform: [{ scale }],
                  opacity,
                }}
              >
                <NotePage
                  entry={entry}
                  locationLabel={entry.mountain_id ? mountainsById.get(entry.mountain_id) : undefined}
                  onPress={() => (slot === activeSlot ? setPageOpen(true) : goTo(slot))}
                />
              </Animated.View>
            );
          })}
        </Animated.ScrollView>

        <Animated.View style={[styles.photoColumn, { opacity: fade }]}>
          <View style={{ height: cardHeight }}>
            <View style={styles.tape} pointerEvents="none" />
            <PhotoPanel
              key={shownEntry.id}
              images={shownImages}
              onEdit={(imageIndex, uri) => onEdit(shownEntry, imageIndex, uri)}
            />
          </View>
        </Animated.View>
      </View>

      <NotePageModal
        visible={pageOpen}
        entry={activeEntry}
        locationLabel={activeEntry.mountain_id ? mountainsById.get(activeEntry.mountain_id) : undefined}
        onClose={() => setPageOpen(false)}
        onSave={onUpdateNote}
      />
    </View>
  );
}

function NotePage({
  entry,
  locationLabel,
  onPress,
}: {
  entry: JournalEntry;
  locationLabel?: string;
  onPress: () => void;
}) {
  const [bodyHeight, setBodyHeight] = useState(0);
  const lineCount = Math.max(0, Math.floor(bodyHeight / LINE_HEIGHT));

  return (
    <View style={styles.noteShadow}>
      <Pressable
        onPress={onPress}
        style={styles.notePage}
        accessibilityRole="button"
        accessibilityLabel={`Open journal page: ${entry.title || 'Untitled entry'}`}
      >
        <BinderHoles />
        <View style={styles.marginLine} pointerEvents="none" />
        <View style={styles.noteInner}>
          <View style={styles.noteTop}>
            <Text style={styles.noteDate} numberOfLines={1}>{formatDiaryDate(entry.created_at)}</Text>
            <View style={styles.noteMeta}>
              {!!entry.rating && <Stars rating={entry.rating} size={10} />}
              {entry.is_public && (
                <Ionicons name="earth-outline" size={11} color={ACCENT_GOLD} accessibilityLabel="Public" />
              )}
            </View>
          </View>
          {!!locationLabel && (
            <View style={styles.noteLocation}>
              <Ionicons name="location-outline" size={11} color={TEXT_MUTED} />
              <Text style={styles.noteLocationText} numberOfLines={1}>{locationLabel}</Text>
            </View>
          )}
          <Text style={styles.noteTitle} numberOfLines={2}>{entry.title || 'Untitled entry'}</Text>
          <View style={styles.titleRule} />
          <View style={styles.ruled} onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}>
            {Array.from({ length: lineCount }, (_, index) => (
              <View key={index} style={[styles.ruleLine, { top: (index + 1) * LINE_HEIGHT - 3 }]} />
            ))}
            {!!entry.content && lineCount > 0 && (
              <Text style={styles.noteBody} numberOfLines={lineCount}>{entry.content}</Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function BinderHoles() {
  return (
    <View style={styles.binder} pointerEvents="none">
      {Array.from({ length: HOLE_COUNT }, (_, index) => <View key={index} style={styles.binderHole} />)}
    </View>
  );
}

function Stars({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={styles.starsRow} accessible accessibilityLabel={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons key={star} name={star <= rating ? 'star' : 'star-outline'} size={size} color={ACCENT_GOLD} />
      ))}
    </View>
  );
}

function NotePageModal({
  visible,
  entry,
  locationLabel,
  onClose,
  onSave,
}: {
  visible: boolean;
  entry: JournalEntry;
  locationLabel?: string;
  onClose: () => void;
  onSave?: (entry: JournalEntry, changes: NoteChanges) => Promise<void> | void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const canEdit = !!onSave;

  const startEdit = () => {
    setDraftTitle(entry.title ?? '');
    setDraftContent(entry.content ?? '');
    setSaveFailed(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setSaveFailed(false);
  };

  const save = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(entry, { title: draftTitle.trim(), content: draftContent });
      setEditing(false);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = () => (editing ? cancelEdit() : onClose());

  const closeModal = () => {
    setEditing(false);
    setSaving(false);
    setSaveFailed(false);
    onClose();
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.authorRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              {avatarUrl && !avatarFailed ? (
                <NativeImage
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            <Text style={styles.timestamp}>{formatRelativeTime(entry.created_at)}</Text>
            {entry.sync_conflict ? (
              <Text style={styles.syncFailed}>Changed elsewhere; your edit was kept</Text>
            ) : null}
            {entry.sync_status ? (
              <Text style={entry.sync_status === 'failed' ? styles.syncFailed : styles.syncPending}>
                {entry.sync_status === 'failed' ? 'Sync failed' : 'Waiting to sync'}
              </Text>
            ) : null}
            {entry.sync_status === 'failed' && entry.sync_error ? (
              <Text style={styles.syncError}>{entry.sync_error}</Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete journal entry"
        >
          <Ionicons name="trash-outline" size={16} color={TEXT_DANGER} />
        </Pressable>
      </View>

      {images.length === 0 || (!isMulti && photoFailed) ? (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
          <Text style={styles.placeholderText}>No photo in this entry</Text>
        </View>
      ) : (
        <View style={styles.photoContainer}>
          <TouchableOpacity
            onPress={() => onEdit(entry, activeIndex, images[activeIndex])}
            style={[styles.editPhotoButton, { right: overlayInset }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit photo"
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalBackdrop} onPress={editing ? undefined : closeModal}>
          <Pressable
            style={[styles.modalPage, { maxHeight: windowHeight * 0.82 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <BinderHoles />
            <View style={styles.marginLine} pointerEvents="none" />
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.noteDate}>{formatDiaryDate(entry.created_at)}</Text>
              {!!locationLabel && (
                <View style={styles.locationChip}>
                  <Ionicons name="location-outline" size={11} color={ACCENT_GOLD} />
                  <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
                </View>
              )}

              {editing ? (
                <>
                  <TextInput
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    placeholder="Title"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalTitleInput}
                    editable={!saving}
                    returnKeyType="next"
                    accessibilityLabel="Entry title"
                  />
                  <View style={styles.titleRule} />
                  <TextInput
                    value={draftContent}
                    onChangeText={setDraftContent}
                    placeholder="Write your note..."
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalBodyInput}
                    editable={!saving}
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel="Entry text"
                  />
                  {saveFailed && <Text style={styles.saveError}>Could not save changes. Please try again.</Text>}
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      onPress={cancelEdit}
                      disabled={saving}
                      style={styles.editBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel editing"
                    >
                      <Text style={styles.editBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={save}
                      disabled={saving}
                      style={[styles.editBtn, styles.editBtnPrimary]}
                      accessibilityRole="button"
                      accessibilityLabel="Save changes"
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={BG_CARD} />
                      ) : (
                        <Text style={[styles.editBtnText, styles.editBtnTextPrimary]}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>{entry.title || 'Untitled entry'}</Text>
                  <View style={styles.titleRule} />
                  {!!entry.content && <Text style={styles.modalBody}>{entry.content}</Text>}
                  {(!!entry.rating || entry.is_public) && (
                    <View style={styles.modalFooter}>
                      {!!entry.rating && <Stars rating={entry.rating} size={13} />}
                      {entry.is_public && (
                        <View style={styles.publicBadge}>
                          <Ionicons name="earth-outline" size={10} color={ACCENT_GOLD} />
                          <Text style={styles.publicBadgeText}>Public</Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {canEdit && !editing && (
              <TouchableOpacity
                onPress={startEdit}
                style={styles.modalEdit}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit note"
              >
                <Ionicons name="pencil-outline" size={15} color={ACCENT_GOLD} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={editing ? cancelEdit : closeModal}
              style={styles.modalClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Cancel editing' : 'Close page'}
            >
              <Ionicons name="close" size={16} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PhotoPanel({
  images,
  onEdit,
}: {
  images: string[];
  onEdit: (index: number, uri: string) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const multiple = images.length > 1;

  if (images.length === 0) {
    return (
      <View style={styles.photoPlaceholder}>
        <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
        <Text style={styles.placeholderText}>No photo on this page</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.photoFrame}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={multiple}
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setImageIndex(Math.round(event.nativeEvent.contentOffset.x / size.width))}
        >
          {images.map((uri, index) => failed.has(index) ? (
            <View key={`${uri}-${index}`} style={[styles.photoFallback, { width: size.width, height: size.height }]}>
              <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
            </View>
          ) : (
            <ExpoImage
              key={`${uri}-${index}`}
              source={{ uri }}
              style={{ width: size.width, height: size.height }}
              contentFit="cover"
              transition={ANIM.fadeMs}
              cachePolicy="memory-disk"
              onError={() => setFailed((current) => new Set(current).add(index))}
            />
          ))}
        </ScrollView>
      )}
      <TouchableOpacity
        onPress={() => onEdit(imageIndex, images[imageIndex])}
        style={styles.editPhotoButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Edit photo"
      >
        <Ionicons name="pencil-outline" size={15} color={TEXT_PRIMARY} />
      </TouchableOpacity>
      {multiple && (
        <View style={styles.imageDots} pointerEvents="none">
          {images.map((_, index) => <View key={index} style={[styles.dot, index === imageIndex && styles.dotActive]} />)}
        </View>
      )}
    </View>
  );
}

function SkeletonCard() {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: ANIM.zoomMs, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: ANIM.zoomMs, useNativeDriver: true }),
      ]));
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]} accessibilityLabel="Loading journal entries">
      <View style={styles.skeletonHeader}>
        <View style={skeletonStyles.avatar} />
        <View style={skeletonStyles.nameBlock}>
          <View style={[skeletonStyles.line, { width: '40%' }]} />
          <View style={[skeletonStyles.line, { width: '22%', height: 8 }]} />
        </View>
      </View>
      <View style={[styles.row, { height: 280 }]}>
        <View style={[styles.notesColumn, skeletonStyles.page]}>
          <View style={[skeletonStyles.line, { width: '35%', height: 8 }]} />
          <View style={[skeletonStyles.line, { width: '70%', height: 14 }]} />
          <View style={[skeletonStyles.line, { width: '92%' }]} />
          <View style={[skeletonStyles.line, { width: '85%' }]} />
          <View style={[skeletonStyles.line, { width: '60%' }]} />
        </View>
        <View style={[styles.photoColumn, skeletonStyles.photo]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: BG_AVATAR },
  nameBlock: { flex: 1, gap: 6 },
  line: { height: 10, borderRadius: 5, backgroundColor: BG_AVATAR },
  page: { justifyContent: 'center', gap: 10, padding: SPACING.cardPadH, borderRadius: RADIUS_CARD, backgroundColor: BG_PANEL, borderWidth: 1, borderColor: BORDER_DEFAULT },
  photo: { borderRadius: PHOTO_RADIUS, backgroundColor: BG_AVATAR },
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDiaryDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

const styles = StyleSheet.create({
  feed: { gap: SPACING.gapLg },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: SPACING.gap,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_CARD,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: BG_GOLD_ICON,
    borderWidth: 1,
    borderColor: BORDER_GOLD_SOFT,
  },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: CHAT_FS_TITLE, fontWeight: '700' },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: FONT.itemSize,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: SPACING.gap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT_GOLD,
  },
  emptyButtonText: { color: BG_CARD, fontSize: FONT.itemSize, fontWeight: '800' },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    overflow: 'hidden',
    paddingBottom: SPACING.cardPadB,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gap,
    paddingHorizontal: SPACING.cardPadH,
    paddingTop: SPACING.cardPadT,
    paddingBottom: SPACING.gapLg,
  },
  authorRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gapLg,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: BORDER_GOLD,
  },
  avatar: {
    width: 34,
    height: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: BG_AVATAR,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: ACCENT_GOLD, fontSize: FONT.emailSize, fontWeight: '800' },
  authorText: { flex: 1, minWidth: 0, gap: 1 },
  authorName: { color: TEXT_PRIMARY, fontSize: FONT.nameSize, fontWeight: FONT.namWeight },
  timestamp: { color: TEXT_FAINT, fontSize: FONT.emailSize },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS_BTN,
    backgroundColor: BG_DANGER_SUBTLE,
    borderWidth: 1,
    borderColor: BORDER_DANGER,
  },
  syncPending: { color: ACCENT_GOLD, fontSize: 9, marginTop: 3 },
  syncFailed: { color: TEXT_DANGER, fontSize: 9, marginTop: 3 },
  syncError: { color: TEXT_FAINT, fontSize: 9, marginTop: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.gap, paddingHorizontal: 12, paddingTop: 6, paddingBottom: SPACING.gapLg },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  titlePill: { flexShrink: 1, minWidth: 0, height: 34, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  headerTitle: { flexShrink: 1, color: TEXT_PRIMARY, fontSize: FONT.nameSize, fontWeight: FONT.namWeight },
  titleDivider: { width: 1, height: 12, marginHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.28)' },
  subtitleText: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '600' },
  newEntryBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  deleteBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: BORDER_DANGER },
  pressed: { opacity: 0.6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: SPACING.gap, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT },
  emptyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: BG_GOLD_ICON, borderWidth: 1, borderColor: BORDER_GOLD_SOFT },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: CHAT_FS_TITLE, fontWeight: '700' },
  emptyText: { color: TEXT_MUTED, fontSize: FONT.itemSize, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  emptyButton: { marginTop: SPACING.gap, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: ACCENT_GOLD },
  emptyButtonText: { color: BG_CARD, fontSize: FONT.itemSize, fontWeight: '800' },
  card: { paddingBottom: SPACING.cardPadB },
  fill: { flex: 1 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.gap, paddingHorizontal: SPACING.cardPadH, paddingTop: SPACING.cardPadT, paddingBottom: SPACING.gapLg },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingHorizontal: 8 },
  notesColumn: { flex: 3 },
  photoColumn: { flex: 2, justifyContent: 'center' },
  noteShadow: { flex: 1, borderRadius: RADIUS_CARD, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  notePage: { flex: 1, overflow: 'hidden', borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_DEFAULT, backgroundColor: BG_PANEL },
  binder: { position: 'absolute', left: 7, top: 0, bottom: 0, justifyContent: 'space-evenly', alignItems: 'center' },
  binderHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_SUBTLE },
  marginLine: { position: 'absolute', left: 24, top: 0, bottom: 0, width: 1, backgroundColor: BORDER_GOLD_SOFT },
  noteInner: { flex: 1, paddingLeft: 32, paddingRight: SPACING.gapLg, paddingTop: SPACING.gapLg, paddingBottom: SPACING.gap, gap: 4 },
  noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.gap },
  noteDate: { flexShrink: 1, color: ACCENT_GOLD, fontFamily: SERIF, fontStyle: 'italic', fontSize: FONT.emailSize },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  noteLocation: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  noteLocationText: { flexShrink: 1, color: TEXT_MUTED, fontSize: FONT.emailSize, fontWeight: '600' },
  noteTitle: { color: TEXT_PRIMARY, fontFamily: SERIF, fontSize: CHAT_FS_TITLE, fontWeight: '700', lineHeight: LINE_HEIGHT, marginTop: 2 },
  titleRule: { height: 1, backgroundColor: BORDER_GOLD, marginTop: 2 },
  ruled: { flex: 1, overflow: 'hidden', marginTop: 2 },
  ruleLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: BORDER_DEFAULT },
  noteBody: { color: TEXT_SECONDARY, fontFamily: SERIF, fontSize: FONT.itemSize, lineHeight: LINE_HEIGHT },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.cardPadH, backgroundColor: BACKDROP },
  modalPage: { width: '100%', overflow: 'hidden', borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_PANEL },
  modalContent: { paddingLeft: 40, paddingRight: 52, paddingTop: SPACING.cardPadT + 6, paddingBottom: SPACING.cardPadT + 6, gap: SPACING.gap },
  modalTitle: { color: TEXT_PRIMARY, fontFamily: SERIF, fontSize: CHAT_FS_TITLE, fontWeight: '700', lineHeight: 22 },
  modalBody: { color: TEXT_SECONDARY, fontFamily: SERIF, fontSize: CHAT_FS_BODY, lineHeight: 22 },
  modalTitleInput: { color: TEXT_PRIMARY, fontFamily: SERIF, fontSize: CHAT_FS_TITLE, fontWeight: '700', lineHeight: 22, paddingVertical: 4, paddingHorizontal: 0 },
  modalBodyInput: { minHeight: 160, color: TEXT_SECONDARY, fontFamily: SERIF, fontSize: CHAT_FS_BODY, lineHeight: 22, paddingVertical: 4, paddingHorizontal: 0 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: SPACING.gap, marginTop: SPACING.gap },
  editBtn: { minWidth: 76, height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_SUBTLE },
  editBtnPrimary: { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD },
  editBtnText: { color: TEXT_PRIMARY, fontSize: FONT.itemSize, fontWeight: '700' },
  editBtnTextPrimary: { color: BG_CARD, fontWeight: '800' },
  saveError: { color: TEXT_DANGER, fontSize: FONT.emailSize },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.gap, marginTop: SPACING.gap },
  modalClose: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_SUBTLE },
  modalEdit: { position: 'absolute', top: 10, right: 52, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_GOLD },
  locationChip: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: BG_GOLD_TINT, borderWidth: 1, borderColor: BORDER_GOLD_SOFT },
  locationText: { flexShrink: 1, color: ACCENT_GOLD, fontSize: FONT.emailSize, fontWeight: '700' },
  publicBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_SUBTLE },
  publicBadgeText: { color: ACCENT_GOLD, fontSize: FONT.tagSize, fontWeight: '700' },
  tape: { position: 'absolute', top: -7, alignSelf: 'center', zIndex: 3, width: 46, height: 14, borderRadius: 3, backgroundColor: BG_GOLD_ICON, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, transform: [{ rotate: '-4deg' }] },
  photoFrame: { flex: 1, overflow: 'hidden', borderRadius: PHOTO_RADIUS, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_AVATAR },
  photoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: BG_AVATAR },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: SPACING.gap, borderRadius: PHOTO_RADIUS, backgroundColor: BG_PANEL, borderWidth: 1, borderColor: BORDER_SUBTLE, borderStyle: 'dashed' },
  placeholderText: { color: TEXT_MUTED, fontSize: FONT.emailSize, textAlign: 'center' },
  editPhotoButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: BORDER_GOLD },
  imageDots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: OVERLAY },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotActive: { width: 16, backgroundColor: ACCENT_GOLD },
});