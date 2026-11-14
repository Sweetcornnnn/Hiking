import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
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
  BG_DANGER_SUBTLE,
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
  RADIUS_BTN,
  RADIUS_CARD,
  SPACING,
  TEXT_DANGER,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  CHAT_BORDER_STRONG,
} from '../../theme/designTokens';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';

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

const LINE_HEIGHT = 20;
const HOLE_COUNT = 4;
const PHOTO_RADIUS = 12;
const VIEWER_HEADER_HEIGHT = 58;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const OVERLAY = `${BG_CARD}CC`;

const HEADER_TITLE = 'My Trail Journal';
const HEADER_TAGLINE = 'Mud, miles, and questionable snack decisions.';

function JournalHeader({ onBack, onNewEntry }: { onBack: () => void; onNewEntry: () => void }) {
  const { width, height } = useWindowDimensions();
  const compact = width > height;
  return (
    <View style={[styles.heroHeader, compact && styles.heroHeaderCompact]}>
      <View style={styles.heroRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.heroIconBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={ACCENT_GOLD} />
        </TouchableOpacity>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">
            {HEADER_TITLE}
          </Text>
          <Text style={styles.heroTagline} numberOfLines={compact ? 1 : 2}>{HEADER_TAGLINE}</Text>
        </View>
        <TouchableOpacity
          onPress={onNewEntry}
          style={styles.heroIconBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="New journal entry"
        >
          <Ionicons name="add" size={22} color={ACCENT_GOLD} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Landscape: controls live in a slim left rail so the pages get the FULL screen height
function JournalRail({
  page,
  total,
  onBack,
  onNewEntry,
  onDelete,
  onPrev,
  onNext,
}: {
  page?: number;
  total?: number;
  onBack: () => void;
  onNewEntry: () => void;
  onDelete?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <View style={styles.rail}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color={TEXT_PRIMARY} />
      </TouchableOpacity>

      <View style={styles.railPager}>
        {!!onPrev && (
          <Pressable
            onPress={onPrev}
            hitSlop={8}
            style={({ pressed }) => [styles.railArrow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Ionicons name="chevron-up" size={17} color={TEXT_MUTED} />
          </Pressable>
        )}
        {!!page && !!total && (
          <View style={styles.railCount} accessible accessibilityLabel={`Page ${page} of ${total}`}>
            <Text style={styles.railCountNow}>{page}</Text>
            <View style={styles.railCountLine} />
            <Text style={styles.railCountTotal}>{total}</Text>
          </View>
        )}
        {!!onNext && (
          <Pressable
            onPress={onNext}
            hitSlop={8}
            style={({ pressed }) => [styles.railArrow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Ionicons name="chevron-down" size={17} color={TEXT_MUTED} />
          </Pressable>
        )}
      </View>

      <View style={styles.railActions}>
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
    </View>
  );
}

function EmptyState({ landscape, onNewEntry }: { landscape: boolean; onNewEntry: () => void }) {
  return (
    <View style={[styles.emptyState, landscape && styles.emptyStateLs]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="book-outline" size={22} color={ACCENT_GOLD} />
      </View>
      <View style={[styles.emptyCopy, landscape && styles.emptyCopyLs]}>
        <Text style={styles.emptyTitle}>Your journal is empty</Text>
        <Text style={[styles.emptyText, landscape && styles.emptyTextLs]}>
          Write about a hike, add photos, and make the memory part of your profile.
        </Text>
      </View>
      <TouchableOpacity
        onPress={onNewEntry}
        style={[styles.emptyButton, landscape && { marginTop: 0 }]}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={15} color={BG_CARD} />
        <Text style={styles.emptyButtonText}>New journal entry</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Edge-to-edge page background. Owns the safe-area insets so the feed reads as a screen, not a card. */
function Screen({ row = false, children }: { row?: boolean; children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        row && styles.lsShell,
        {
          paddingTop: insets.top,
          paddingBottom: row ? insets.bottom : Math.max(insets.bottom, 8),
        },
      ]}
    >
      {children}
    </View>
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

  const { width: screenW, height: screenH } = useWindowDimensions();
  const landscape = screenW > screenH;

  if (isLoading && entries.length === 0) {
    return (
      <Screen>
        <JournalHeader onBack={onBack} onNewEntry={onNewEntry} />
        <SkeletonCard landscape={landscape} />
      </Screen>
    );
  }

  if (!isLoading && entries.length === 0) {
    return (
      <Screen>
        <JournalHeader onBack={onBack} onNewEntry={onNewEntry} />
        {landscape ? (
          <View style={styles.lsEmptyWrap}>
            <EmptyState landscape onNewEntry={onNewEntry} />
          </View>
        ) : (
          <EmptyState landscape={false} onNewEntry={onNewEntry} />
        )}
      </Screen>
    );
  }

  return (
    <FeedColumns
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

const ROW_GAP = 14;

/** Paper note page: the left column. */
function NotePage({
  entry,
  locationLabel,
  onPress,
  onDelete,
}: {
  entry: JournalEntry;
  locationLabel?: string;
  onPress: () => void;
  onDelete: () => void;
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
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={({ pressed }) => [styles.cardDeleteBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${entry.title || 'untitled entry'}`}
              >
                <Ionicons name="trash-outline" size={12} color={TEXT_DANGER} />
              </Pressable>
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

/**
 * Two separate columns, notes on the left and photos on the right. Both scroll, and they stay
 * row-aligned: dragging either column moves the other to the same offset. Every card has a fixed
 * height and nothing scales, so nothing resizes while you scroll.
 */
function FeedColumns({
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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const landscape = windowWidth > windowHeight;
  const insets = useSafeAreaInsets();

  const [measuredHeight, setMeasuredHeight] = useState(0);
  const areaHeight = measuredHeight > 0 ? measuredHeight : Math.round(windowHeight * 0.6);
  const cardHeight = Math.max(200, Math.min(Math.round(areaHeight * (landscape ? 0.8 : 0.62)), 380));
  const rowHeight = cardHeight + ROW_GAP;

  const [openId, setOpenId] = useState<string | null>(null);
  const openEntry = openId ? entries.find((entry) => entry.id === openId) ?? null : null;
  const [viewer, setViewer] = useState<{ id: string; index: number } | null>(null);
  const viewerEntry = viewer ? entries.find((entry) => entry.id === viewer.id) ?? null : null;
  const viewerImages = useMemo(
    () => (viewerEntry?.images ?? []).filter(Boolean).map(getImageUrl).filter(Boolean),
    [viewerEntry],
  );

  const notesRef = useRef<FlatList<JournalEntry> | null>(null);
  const photosRef = useRef<FlatList<JournalEntry> | null>(null);
  const driver = useRef<'notes' | 'photos' | null>(null);

  const follow = (from: 'notes' | 'photos') => (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (driver.current !== from) return;
    const target = from === 'notes' ? photosRef.current : notesRef.current;
    target?.scrollToOffset({ offset: event.nativeEvent.contentOffset.y, animated: false });
  };

  const sharedListProps = {
    data: entries,
    keyExtractor: (entry: JournalEntry) => entry.id,
    getItemLayout: (_: unknown, index: number) => ({ length: rowHeight, offset: rowHeight * index, index }),
    showsVerticalScrollIndicator: false,
    decelerationRate: 'fast' as const,
    snapToInterval: rowHeight,
    snapToAlignment: 'start' as const,
    nestedScrollEnabled: true,
    scrollEventThrottle: 16,
    initialNumToRender: 3,
    windowSize: 7,
    contentContainerStyle: { paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) + 8 },
  };

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: landscape ? insets.bottom : 0,
        },
      ]}
    >
      <JournalHeader onBack={onBack} onNewEntry={onNewEntry} />

      <View
        style={[styles.row, styles.fill, landscape && styles.lsRow]}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          setMeasuredHeight((current) => (next > 0 && next !== current ? next : current));
        }}
      >
        <FlatList
          ref={notesRef}
          {...sharedListProps}
          style={[styles.notesColumn, landscape && styles.lsNotes]}
          onScrollBeginDrag={() => { driver.current = 'notes'; }}
          onMomentumScrollBegin={() => { driver.current = 'notes'; }}
          onScroll={follow('notes')}
          renderItem={({ item }) => (
            <View style={{ height: rowHeight, paddingBottom: ROW_GAP }}>
              <NotePage
                entry={item}
                locationLabel={item.mountain_id ? mountainsById.get(item.mountain_id) : undefined}
                onPress={() => setOpenId(item.id)}
                onDelete={() => onDelete(item)}
              />
            </View>
          )}
        />

        <FlatList
          ref={photosRef}
          {...sharedListProps}
          style={[styles.photoList, landscape && styles.lsPhoto]}
          onScrollBeginDrag={() => { driver.current = 'photos'; }}
          onMomentumScrollBegin={() => { driver.current = 'photos'; }}
          onScroll={follow('photos')}
          renderItem={({ item }) => (
            <View style={{ height: rowHeight, paddingBottom: ROW_GAP }}>
              <View style={styles.fill}>
                <PhotoCollage
                  images={(item.images ?? []).filter(Boolean).map(getImageUrl).filter(Boolean)}
                  onOpen={(imageIndex) => setViewer({ id: item.id, index: imageIndex })}
                />
              </View>
            </View>
          )}
        />
      </View>

      <PhotoViewerModal
        visible={viewerEntry !== null && viewerImages.length > 0}
        images={viewerImages}
        entry={viewerEntry}
        locationLabel={viewerEntry?.mountain_id ? mountainsById.get(viewerEntry.mountain_id) : undefined}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        onEdit={(imageIndex, uri) => {
          if (viewerEntry) onEdit(viewerEntry, imageIndex, uri);
        }}
      />

      <NotePageModal
        visible={openEntry !== null}
        entry={openEntry ?? entries[0]}
        locationLabel={openEntry?.mountain_id ? mountainsById.get(openEntry.mountain_id) : undefined}
        onClose={() => setOpenId(null)}
        onSave={onUpdateNote}
      />
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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const modalInsets = useSafeAreaInsets();
  const landscape = windowWidth > windowHeight;
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
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ModalScrim color="rgba(10,17,26,0.82)" />
        <Pressable
          style={[
            styles.modalBackdrop,
            {
              paddingLeft: modalInsets.left + SPACING.cardPadH,
              paddingRight: modalInsets.right + SPACING.cardPadH,
              paddingTop: modalInsets.top + 12,
              paddingBottom: modalInsets.bottom + 12,
            },
          ]}
          onPress={editing ? undefined : closeModal}
        >
          <Pressable
            style={[styles.modalPage, landscape && styles.modalPageLs, { maxHeight: windowHeight * (landscape ? 0.92 : 0.82) }]}
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
                    style={[styles.modalBodyInput, landscape && styles.modalBodyInputLs]}
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
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const PAPER = '#F1EADB';

type CollageFrame = { left: number; top: number; width: number; height: number; rotate: number; z: number };

/** Scattered, overlapping, taped photos for entries with 1 to 3 pictures. */
function computeCollage(count: number, W: number, H: number): CollageFrame[] {
  const pad = 8;
  const innerW = W - pad * 2;
  if (count === 1) {
    const height = Math.min(H - pad * 2, innerW * 1.35);
    return [{ left: pad, top: (H - height) / 2, width: innerW, height, rotate: -3, z: 1 }];
  }
  if (count === 2) {
    const width = innerW * 0.8;
    const height = Math.min(H * 0.52, width * 1.25);
    const overlap = height * 0.1;
    const top = (H - (height * 2 - overlap)) / 2;
    return [
      { left: pad, top, width, height, rotate: -4, z: 1 },
      { left: W - pad - width, top: top + height - overlap, width, height, rotate: 3, z: 2 },
    ];
  }
  const width = innerW * 0.74;
  const height = Math.min(H * 0.33, width * 1.2);
  const step = height * 0.9;
  const top = (H - (step * 2 + height)) / 2;
  return [
    { left: pad, top, width, height, rotate: -5, z: 1 },
    { left: W - pad - width, top: top + step, width, height, rotate: 4, z: 2 },
    { left: pad + (innerW - width) * 0.4, top: top + step * 2, width, height, rotate: -2, z: 3 },
  ];
}

function Pic({
  uri,
  style,
  contentFit = 'cover',
  onLoad,
}: {
  uri: string;
  style: any;
  contentFit?: 'cover' | 'contain';
  onLoad?: (width: number, height: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[style, styles.picFallback]}>
        <Ionicons name="image-outline" size={22} color={TEXT_MUTED} />
      </View>
    );
  }
  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={ANIM.fadeMs}
      cachePolicy="memory-disk"
      onLoad={(event) => onLoad?.(event.source.width, event.source.height)}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * 1-3 photos: tilted, overlapping prints stuck on with tape (one, two or three of them).
 * 4 or more: a tidy 2x2 contact sheet; the last tile shows "+N" for the rest.
 * Tapping any photo opens it in the viewer at that picture.
 */
function PhotoCollage({ images, onOpen }: { images: string[]; onOpen: (index: number) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const count = images.length;

  if (count === 0) {
    return (
      <View style={styles.photoPlaceholder}>
        <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
        <Text style={styles.placeholderText}>No photo on this page</Text>
      </View>
    );
  }

  let content: React.ReactNode = null;
  if (size.width > 0 && size.height > 0) {
    if (count <= 3) {
      content = computeCollage(count, size.width, size.height).map((frame, index) => (
        <Pressable
          key={`${images[index]}-${index}`}
          onPress={() => onOpen(index)}
          accessibilityRole="button"
          accessibilityLabel={`Open photo ${index + 1} of ${count}`}
          style={({ pressed }) => [
            styles.polaroid,
            {
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              zIndex: frame.z,
              transform: [{ rotate: `${frame.rotate}deg` }, { scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <View style={styles.tape} pointerEvents="none" />
          <View style={styles.polaroidImageWrap}>
            <Pic uri={images[index]} style={styles.fill} />
          </View>
        </Pressable>
      ));
    } else {
      const availableWidth = Math.max(0, size.width - 16);
      const availableHeight = Math.max(0, size.height - 16);
      const frameWidth = Math.min(availableWidth, availableHeight);
      const tile = (frameWidth - 10 - 6) / 2;
      const frameHeight = tile * 2 + 6 + 10;
      content = (
        <View style={[styles.mosaic, { left: (size.width - frameWidth) / 2, top: (size.height - frameHeight) / 2, width: frameWidth }]}>
          {images.slice(0, 4).map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              onPress={() => onOpen(index)}
              accessibilityRole="button"
              accessibilityLabel={index === 3 && count > 4 ? `Open all ${count} photos` : `Open photo ${index + 1} of ${count}`}
              style={({ pressed }) => [{ width: tile, height: tile }, pressed && styles.pressed]}
            >
              <Pic uri={uri} style={styles.mosaicPic} />
            </Pressable>
          ))}
        </View>
      );
    }
  }

  return (
    <View
      style={styles.fill}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {content}
    </View>
  );
}

/** Centered image-only modal with swipe and edit controls. */
function PhotoViewerModal({
  visible,
  images,
  entry,
  locationLabel,
  startIndex,
  onClose,
  onEdit,
}: {
  visible: boolean;
  images: string[];
  entry: JournalEntry | null;
  locationLabel?: string;
  startIndex: number;
  onClose: () => void;
  onEdit: (index: number, uri: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxModalWidth = Math.min(width - insets.left - insets.right - 32, 720);
  const maxModalHeight = Math.min(height - insets.top - insets.bottom - 48 - VIEWER_HEADER_HEIGHT, 760);
  const [index, setIndex] = useState(startIndex);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const pagerRef = useRef<ScrollView | null>(null);
  const multiple = images.length > 1;
  const activeImageSize = imageSizes[images[index]];
  const imageAspectRatio = activeImageSize?.width && activeImageSize.height
    ? activeImageSize.width / activeImageSize.height
    : undefined;
  const maxAspectRatio = maxModalWidth / maxModalHeight;
  const modalWidth = imageAspectRatio
    ? imageAspectRatio > maxAspectRatio ? maxModalWidth : maxModalHeight * imageAspectRatio
    : maxModalWidth;
  const modalHeight = imageAspectRatio
    ? imageAspectRatio > maxAspectRatio ? maxModalWidth / imageAspectRatio : maxModalHeight
    : maxModalHeight;

  useEffect(() => {
    if (!visible) return;
    setIndex(startIndex);
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible || viewerSize.width <= 0) return;
    const frame = requestAnimationFrame(() =>
      pagerRef.current?.scrollTo({ x: index * viewerSize.width, animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [visible, startIndex, index, viewerSize.width]);

  return (
    <Modal {...FULLSCREEN_MODAL_PROPS} visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
        <View style={[styles.viewerModal, { width: modalWidth, height: modalHeight + VIEWER_HEADER_HEIGHT }]}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerHeaderInfo}>
              <Text style={styles.viewerHeaderTitle} numberOfLines={1}>
                {entry?.title || 'Untitled entry'}
              </Text>
              <View style={styles.viewerHeaderMeta}>
                <Text style={styles.viewerHeaderDetail} numberOfLines={1}>
                  {entry ? formatDiaryDate(entry.created_at) : ''}
                </Text>
                <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                <Text style={styles.viewerHeaderDetail} numberOfLines={1}>
                  {locationLabel || 'Mountain not specified'}
                </Text>
              </View>
            </View>
            <View style={styles.viewerCounter} accessibilityLabel={`Image ${index + 1} of ${images.length}`}>
              <Text style={styles.viewerCounterText}>{index + 1} of {images.length}</Text>
            </View>
          </View>
          <View
            style={styles.viewerImageArea}
            onLayout={(event) => {
              const { width: areaWidth, height: areaHeight } = event.nativeEvent.layout;
              setViewerSize({ width: areaWidth, height: areaHeight });
            }}
          >
            <ScrollView
              ref={pagerRef}
              style={styles.viewerPager}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              scrollEnabled={multiple}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: startIndex * viewerSize.width, y: 0 }}
              onMomentumScrollEnd={(event) => {
                if (viewerSize.width > 0) {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewerSize.width);
                  if (nextIndex !== index) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIndex(nextIndex);
                  }
                }
              }}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  onLongPress={() => {
                    onClose();
                    onEdit(i, uri);
                  }}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${i + 1} of ${images.length}. Long press to edit.`}
                  style={[styles.viewerImagePage, { width: viewerSize.width, height: viewerSize.height }]}
                >
                  <Pic
                    uri={uri}
                    contentFit="contain"
                    style={styles.viewerImage}
                    onLoad={(imageWidth, imageHeight) => {
                      if (imageWidth > 0 && imageHeight > 0) {
                        setImageSizes((current) => ({
                          ...current,
                          [uri]: { width: imageWidth, height: imageHeight },
                        }));
                      }
                    }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => {
                const activeImage = images[index];
                if (!activeImage) return;
                onClose();
                onEdit(index, activeImage);
              }}
              style={({ pressed }) => [styles.viewerEditButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Edit photo"
            >
              <Ionicons name="pencil-outline" size={17} color={ACCENT_GOLD} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SkeletonCard({ landscape = false }: { landscape?: boolean }) {
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
    <Animated.View style={[styles.fill, landscape && styles.lsSkeleton, { opacity: pulse }]} accessibilityLabel="Loading journal entries">
      <View style={[styles.row, landscape ? [styles.fill, styles.lsRow] : { height: 280 }]}>
        <View style={[styles.notesColumn, landscape && styles.lsNotes, skeletonStyles.page]}>
          <View style={[skeletonStyles.line, { width: '35%', height: 8 }]} />
          <View style={[skeletonStyles.line, { width: '70%', height: 14 }]} />
          <View style={[skeletonStyles.line, { width: '92%' }]} />
          <View style={[skeletonStyles.line, { width: '85%' }]} />
          <View style={[skeletonStyles.line, { width: '60%' }]} />
        </View>
        <View style={[styles.photoColumn, landscape && styles.lsPhoto, skeletonStyles.photo]} />
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
  screen: { flex: 1, backgroundColor: BG_CARD },
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
  heroHeader: { marginHorizontal: 16, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, marginBottom: 8 },
  heroHeaderCompact: { paddingTop: 12, paddingBottom: 6, marginBottom: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  heroIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  heroTitle: { color: TEXT_PRIMARY, fontFamily: SERIF, fontSize: 20, textAlign: 'center' },
  heroTagline: { color: TEXT_MUTED, fontSize: 12, textAlign: 'center' },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  titlePill: { flexShrink: 1, minWidth: 0, height: 34, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  headerTitle: { flexShrink: 1, color: TEXT_PRIMARY, fontSize: FONT.nameSize, fontWeight: FONT.namWeight },
  titleDivider: { width: 1, height: 12, marginHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.28)' },
  subtitleText: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '600' },
  newEntryBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: CHAT_BORDER_STRONG },
  deleteBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: BORDER_DANGER },
  pressed: { opacity: 0.6 },
  cardDeleteBtn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_DANGER_SUBTLE, borderWidth: 1, borderColor: BORDER_DANGER },
  fill: { flex: 1 },
  // ── landscape layout ──
  lsShell: { flex: 1, flexDirection: 'row' },
  lsRoot: { flexDirection: 'row', paddingBottom: 0 },
  lsRow: { gap: 12, paddingHorizontal: 16 },
  lsNotes: { flex: 1.15 },
  lsPhoto: { flex: 1 },
  lsSkeleton: { flex: 1, paddingBottom: 0 },
  lsEmptyWrap: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  rail: { width: 52, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingLeft: 6, gap: 8 },
  railPager: { alignItems: 'center', gap: 2 },
  railArrow: { width: 32, height: 26, alignItems: 'center', justifyContent: 'center' },
  railCount: { alignItems: 'center', gap: 3, paddingVertical: 2 },
  railCountNow: { color: ACCENT_GOLD, fontFamily: SERIF, fontSize: 17, fontWeight: '700', lineHeight: 20 },
  railCountLine: { width: 14, height: 1, backgroundColor: BORDER_GOLD },
  railCountTotal: { color: TEXT_FAINT, fontSize: 11, fontWeight: '600' },
  railActions: { alignItems: 'center', gap: 8 },
  emptyStateLs: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 18, gap: 16 },
  emptyCopy: { alignItems: 'center', gap: SPACING.gap },
  emptyCopyLs: { flex: 1, alignItems: 'flex-start', gap: 2 },
  emptyTextLs: { textAlign: 'left', maxWidth: undefined },
  modalPageLs: { maxWidth: 720 },
  modalBodyInputLs: { minHeight: 90 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.gap, paddingHorizontal: SPACING.cardPadH, paddingTop: SPACING.cardPadT, paddingBottom: SPACING.gapLg },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingHorizontal: 16 },
  notesColumn: { flex: 3 },
  photoList: { flex: 2 },
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
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalPage: { width: '50%', overflow: 'hidden', borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_PANEL },
  modalContent: { paddingLeft: 40, paddingRight: SPACING.cardPadH, paddingTop: SPACING.cardPadT + 6, paddingBottom: SPACING.cardPadT + 6, gap: SPACING.gap },
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
  modalEdit: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: BG_SUBTLE, borderWidth: 1, borderColor: BORDER_GOLD },
  locationChip: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: BG_GOLD_TINT, borderWidth: 1, borderColor: BORDER_GOLD_SOFT },
  locationText: { flexShrink: 1, color: ACCENT_GOLD, fontSize: FONT.emailSize, fontWeight: '700' },
  publicBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_SUBTLE },
  publicBadgeText: { color: ACCENT_GOLD, fontSize: FONT.tagSize, fontWeight: '700' },
  picFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: BG_AVATAR },
  polaroid: { position: 'absolute', padding: 5, borderRadius: 3, backgroundColor: PAPER, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  polaroidImageWrap: { flex: 1, overflow: 'hidden', borderRadius: 1, backgroundColor: BG_AVATAR },
  mosaic: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 5, borderRadius: 4, backgroundColor: PAPER, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6, transform: [{ rotate: '-6deg' }] },
  mosaicPic: { width: '100%', height: '100%', borderRadius: 2 },
  viewerRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  viewerModal: { overflow: 'hidden', borderRadius: PHOTO_RADIUS },
  viewerHeader: { height: VIEWER_HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BG_CARD, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT },
  viewerHeaderInfo: { flex: 1, minWidth: 0, gap: 2 },
  viewerHeaderTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  viewerHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewerHeaderDetail: { color: TEXT_MUTED, fontSize: 10 },
  viewerCounter: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: BG_GOLD_TINT, borderWidth: 1, borderColor: BORDER_GOLD_SOFT },
  viewerCounterText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
  viewerImageArea: { flex: 1, width: '100%', overflow: 'hidden', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: PHOTO_RADIUS, borderBottomRightRadius: PHOTO_RADIUS, backgroundColor: '#000000' },
  viewerPager: { flex: 1, overflow: 'hidden', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: PHOTO_RADIUS, borderBottomRightRadius: PHOTO_RADIUS },
  viewerImagePage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: PHOTO_RADIUS, borderBottomRightRadius: PHOTO_RADIUS },
  viewerImage: { width: '100%', height: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: PHOTO_RADIUS, borderBottomRightRadius: PHOTO_RADIUS },
  viewerEditButton: { position: 'absolute', right: 12, bottom: 12, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: OVERLAY, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, zIndex: 2, elevation: 3 },
  tape: { position: 'absolute', top: -7, alignSelf: 'center', zIndex: 3, width: 46, height: 14, borderRadius: 3, backgroundColor: BG_GOLD_ICON, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, transform: [{ rotate: '-4deg' }] },
  photoFrame: { flex: 1, overflow: 'hidden', borderRadius: PHOTO_RADIUS, borderWidth: 1, borderColor: BORDER_GOLD_SOFT, backgroundColor: BG_AVATAR },
  photoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: BG_AVATAR },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: SPACING.gap, borderRadius: PHOTO_RADIUS, backgroundColor: BG_PANEL, borderWidth: 1, borderColor: BORDER_SUBTLE, borderStyle: 'dashed' },
  placeholderText: { color: TEXT_MUTED, fontSize: FONT.emailSize, textAlign: 'center' },
  editPhotoButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: OVERLAY, borderWidth: 1, borderColor: BORDER_GOLD },
  imageDots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: OVERLAY },
});