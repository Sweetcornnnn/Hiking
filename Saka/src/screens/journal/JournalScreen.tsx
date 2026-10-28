import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../../components/ModalScrim';
import JournalImageGrid from '../../components/journal/JournalImageGrid';
import MyJournalFeed from '../../components/journal/MyJournalFeed';
import PhotoEditor from '../../components/journal/PhotoEditor';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useJournalStore } from '../../store/journalStore';
import { useProfileCardStore } from '../../store/profileCardStore';
import type { JournalEntry, JournalImage } from '../../types/journal';
import { ACCENT_GOLD, BG_CARD, BG_PANEL, BG_SUBTLE, BORDER_DEFAULT, BORDER_GOLD, BORDER_SUBTLE, CHAT_BG, CHAT_BORDER, CHAT_DANGER, CHAT_PANEL, CHAT_RADIUS_BTN, CHAT_RADIUS_MODAL, CHAT_SUBTLE, RADIUS_BTN, RADIUS_CARD, TEXT_FAINT, TEXT_MUTED, TEXT_PRIMARY } from '../../theme/designTokens';

type Mode = 'feed' | 'form';

export default function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const { viewpointId, mountainId, fromProfile } = useLocalSearchParams<{
    viewpointId?: string | string[];
    mountainId?: string | string[];
    fromProfile?: string | string[];
  }>();
  const preselectedViewpointId = typeof viewpointId === 'string' ? viewpointId : null;
  const preselectedMountainId = typeof mountainId === 'string' ? mountainId : null;
  const cameFromProfile = fromProfile === '1';
  const {
    entries,
    fetchEntries,
    saveEntry,
    updateEntry,
    deleteEntry,
    replaceEntryImage,
    isLoading,
    error,
    clearError,
    retryPendingSync,
  } = useJournalStore();
  const [mode, setMode] = useState<Mode>('feed');
  const [editingPhoto, setEditingPhoto] = useState<{ entry: JournalEntry; index: number; uri: string } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<JournalImage[]>([]);
  const [rating, setRating] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedMountainId, setSelectedMountainId] = useState<string | null>(preselectedMountainId);
  const [mountainsLoading, setMountainsLoading] = useState(true);
  const [mountainsError, setMountainsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);
  const saveInProgress = useRef(false);

  const goBackToProfile = () => {
    if (cameFromProfile) {
      useProfileCardStore.getState().requestReopen();
    }
    router.back();
  };

  const handleBack = () => {
    if (mode === 'form') {
      setMode('feed');
    } else {
      goBackToProfile();
    }
  };

  useEffect(() => {
    fetchEntries();
    let isMounted = true;
    mountainService.fetchMountains()
      .then((data) => {
        if (isMounted) setMountains(data);
      })
      .catch(() => {
        if (isMounted) setMountainsError('Unable to load mountains. Please try again later.');
      })
      .finally(() => {
        if (isMounted) setMountainsLoading(false);
      });

    return () => {
      isMounted = false;
      clearError();
    };
  }, [clearError, fetchEntries]);

  const confirmDelete = (entry: JournalEntry) => {
    setPendingDelete(entry);
  };

  const handleEditPhoto = (entry: JournalEntry, index: number, uri: string) => {
    setEditingPhoto({ entry, index, uri });
  };

  const handleUpdateNote = async (
    entry: JournalEntry,
    changes: { title: string; content: string },
  ) => {
    const result = await updateEntry(entry.id, {
      ...changes,
      images: (entry.images ?? []).filter(Boolean).map((uri) => ({ uri })),
      rating: entry.rating ?? undefined,
      mountainId: entry.mountain_id,
      hikeId: entry.hike_id,
      viewpointId: entry.viewpoint_id,
      isPublic: entry.is_public,
    });

    if (result.error) throw new Error(result.error);
  };

  const handleSaveEditedPhoto = async (editedUri: string): Promise<{ error: string | null }> => {
    if (!editingPhoto) return { error: null };
    const result = await replaceEntryImage(editingPhoto.entry, editingPhoto.index, editedUri);
    if (!result.error) setEditingPhoto(null);
    return result;
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to add photos to your journal.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.8,
    });
    if (!result.canceled) {
      const selectedImages = result.assets.map((asset) => {
        return { uri: asset.uri, mimeType: asset.mimeType };
      });

      setImages((current) => Array.from(
        new Map([...current, ...selectedImages].map((image) => [image.uri, image])).values(),
      ).slice(0, 6));
    }
  };

  const save = async () => {
    if (saveInProgress.current || isLoading) return;

    if (!title.trim() || !content.trim()) {
      Alert.alert('Complete your entry', 'Add a title and describe your experience.');
      return;
    }
    if (!selectedMountainId && !preselectedViewpointId) {
      Alert.alert('Choose a mountain', 'Select the mountain these journal photos belong to.');
      return;
    }
    saveInProgress.current = true;

    try {
      const result = await saveEntry({
        title,
        content,
        images,
        mountainId: selectedMountainId,
        viewpointId: preselectedViewpointId,
        isPublic,
        rating: rating || undefined,
      });

      if (result.error) {
        Alert.alert('Save failed', result.error);
        return;
      }

      setTitle('');
      setContent('');
      setImages([]);
      setRating(0);
      setIsPublic(false);
      setSelectedMountainId(preselectedMountainId);
      setMode('feed');

      setNotice({
        title: result.pendingSync ? 'Saved on this device' : 'Journal saved',
        message: result.pendingSync
          ? 'Your entry and photos are saved locally and will sync automatically when the internet is available.'
          : 'Your photos are now part of your profile showcase.',
      });
    } finally {
      saveInProgress.current = false;
    }
  };

  const mountainChips = mountainsLoading ? (
    <Text style={styles.helper}>Loading mountains...</Text>
  ) : mountainsError ? (
    <Text style={styles.error}>{mountainsError}</Text>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mountainOptions}>
      {mountains.map((mountain) => (
        <TouchableOpacity
          key={mountain.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedMountainId === mountain.id }}
          onPress={() => setSelectedMountainId(mountain.id)}
          style={[styles.mountainOption, selectedMountainId === mountain.id && styles.mountainOptionSelected]}
        >
          <Text style={[styles.mountainOptionText, selectedMountainId === mountain.id && styles.mountainOptionTextSelected]}>
            {mountain.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderStars = (size: number) =>
    [1, 2, 3, 4, 5].map((value) => (
      <TouchableOpacity key={value} onPress={() => setRating(value)} hitSlop={4}>
        <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={size} color={ACCENT_GOLD} />
      </TouchableOpacity>
    ));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {mode === 'form' && <View style={[styles.header, isLandscape && styles.headerCompact]}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>YOUR TRAIL NOTES</Text>
          <Text style={styles.title}>New journal entry</Text>
        </View>
        <View style={styles.headerSpacer} />
        {isLandscape && (
          <TouchableOpacity
            onPress={save}
            disabled={isLoading}
            accessibilityRole="button"
            style={[styles.headerSave, isLoading && styles.disabled]}
          >
            <Ionicons name="book-outline" size={15} color={BG_PANEL} />
            <Text style={styles.headerSaveText}>{isLoading ? 'Saving...' : 'Save to journal'}</Text>
          </TouchableOpacity>
        )}
      </View>}

      {mode === 'feed' ? (
        <View style={[styles.feedContent, isLandscape ? styles.feedContentLandscape : { paddingBottom: 20 + insets.bottom }]}>
          {error && <Text style={styles.error}>{error}</Text>}
          {entries.some((entry) => entry.sync_status) && (
            <TouchableOpacity
              onPress={async () => {
                const result = await retryPendingSync();
                if (result.error) Alert.alert('Sync failed', result.error);
              }}
              style={[styles.syncButton, isLandscape && styles.syncButtonCompact]}
              accessibilityRole="button"
            >
              <Ionicons name="sync-outline" size={14} color={ACCENT_GOLD} />
              <Text style={styles.syncButtonText}>Retry pending journal sync</Text>
            </TouchableOpacity>
          )}
          <MyJournalFeed
            entries={entries}
            mountains={mountains}
            isLoading={isLoading && !entries.length}
            onDelete={confirmDelete}
            onEdit={handleEditPhoto}
            onUpdateNote={handleUpdateNote}
            onNewEntry={() => setMode('form')}
            onBack={handleBack}
          />
        </View>
      ) : isLandscape ? (
        <View style={styles.lsBody}>
          {/* LEFT: the writing area gets all the room */}
          <View style={styles.lsLeft}>
            <Text style={styles.lsLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="A day above the clouds"
              placeholderTextColor={TEXT_FAINT}
              style={[styles.input, styles.lsInput]}
            />
            <Text style={[styles.lsLabel, { marginTop: 10 }]}>Your experience</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="What did you notice, feel, or learn on the trail?"
              placeholderTextColor={TEXT_FAINT}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.lsTextArea]}
            />
          </View>

          <View style={styles.lsDivider} />

          {/* RIGHT: everything else, compact */}
          <ScrollView
            style={styles.lsRight}
            contentContainerStyle={styles.lsRightContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.lsLabel}>{preselectedViewpointId ? 'Mountain' : 'Mountain *'}</Text>
            {mountainChips}
            <Text style={styles.lsHelper} numberOfLines={2}>
              {preselectedViewpointId
                ? 'Mountain is optional. This entry will appear on Sakagram for the selected viewpoint.'
                : 'All photos in this entry will be shown under the selected mountain.'}
            </Text>

            <Text style={[styles.lsLabel, { marginTop: 10 }]}>Photos {images.length}/6</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip} keyboardShouldPersistTaps="handled">
              {images.length < 6 && (
                <TouchableOpacity onPress={pickImages} style={styles.addTile} accessibilityRole="button" accessibilityLabel="Add photos">
                  <Ionicons name="images-outline" size={18} color={ACCENT_GOLD} />
                  <Text style={styles.addTileText}>Add</Text>
                </TouchableOpacity>
              )}
              {images.map((image, index) => (
                <View key={image.uri} style={styles.thumb}>
                  <Image source={{ uri: image.uri }} style={styles.thumbImg} />
                  <TouchableOpacity
                    onPress={() => setImages((current) => current.filter((_, item) => item !== index))}
                    style={styles.thumbRemove}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={11} color={TEXT_PRIMARY} />
                  </TouchableOpacity>
                </View>
              ))}
              {!images.length && (
                <Text style={[styles.lsHelper, styles.photoHint]} numberOfLines={3}>
                  Up to six photos. They appear on your profile showcase after saving.
                </Text>
              )}
            </ScrollView>

            <View style={styles.lsRow}>
              <View style={styles.lsCol}>
                <Text style={[styles.lsLabel, { marginTop: 10 }]}>Trail rating</Text>
                <View style={styles.ratingRow}>{renderStars(22)}</View>
              </View>
              <View style={styles.lsCol}>
                <Text style={[styles.lsLabel, { marginTop: 10 }]}>Visibility</Text>
                <TouchableOpacity
                  onPress={() => setIsPublic((value) => !value)}
                  style={styles.pill}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isPublic }}
                >
                  <Ionicons
                    name={isPublic ? 'earth-outline' : 'lock-closed-outline'}
                    size={15}
                    color={isPublic ? ACCENT_GOLD : TEXT_MUTED}
                  />
                  <Text style={styles.pillText}>{isPublic ? 'Public' : 'Private'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.lsHelper, { marginTop: 6 }]} numberOfLines={1}>
              {isPublic ? 'Shared on Sakagram for this viewpoint.' : 'Only visible to you on your profile.'}
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="A day above the clouds" placeholderTextColor={TEXT_FAINT} style={styles.input} />

        <Text style={styles.label}>Your experience</Text>
        <TextInput value={content} onChangeText={setContent} placeholder="What did you notice, feel, or learn on the trail?" placeholderTextColor={TEXT_FAINT} multiline textAlignVertical="top" style={[styles.input, styles.textArea]} />

        <Text style={styles.label}>{preselectedViewpointId ? 'Mountain' : 'Mountain *'}</Text>
        {mountainChips}
        <Text style={styles.helper}>
          {preselectedViewpointId
            ? 'Mountain is optional for an entry from this viewpoint.'
            : 'All photos in this entry will be shown under the selected mountain.'}
        </Text>
        {preselectedViewpointId && (
          <Text style={styles.viewpointBanner}>
            This entry will appear on Sakagram for the selected viewpoint.
          </Text>
        )}

        <View style={styles.rowHeader}>
          <Text style={styles.label}>Photos</Text>
          <TouchableOpacity onPress={pickImages} style={styles.addButton}>
            <Ionicons name="images-outline" size={15} color={ACCENT_GOLD} />
            <Text style={styles.addButtonText}>Add photos</Text>
          </TouchableOpacity>
        </View>
        {images.length ? <JournalImageGrid images={images.map((image) => image.uri)} onRemove={(index) => setImages((current) => current.filter((_, item) => item !== index))} /> : <Text style={styles.helper}>Add up to six photos. They will appear on your profile showcase after saving.</Text>}

        <Text style={styles.label}>Trail rating</Text>
        <View style={styles.ratingRow}>
          {renderStars(25)}
        </View>

        <Text style={styles.label}>Visibility</Text>
        <TouchableOpacity
          onPress={() => setIsPublic((value) => !value)}
          style={styles.visibilityRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: isPublic }}
        >
          <Ionicons
            name={isPublic ? 'earth-outline' : 'lock-closed-outline'}
            size={16}
            color={isPublic ? ACCENT_GOLD : TEXT_MUTED}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.visibilityTitle}>
              {isPublic ? 'Public' : 'Private'}
            </Text>
            <Text style={styles.helper}>
              {isPublic
                ? 'Shared on Sakagram for this viewpoint.'
                : 'Only visible to you on your profile.'}
            </Text>
          </View>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity onPress={save} disabled={isLoading} style={[styles.saveButton, isLoading && styles.disabled]}>
          <Ionicons name="book-outline" size={17} color={BG_PANEL} />
          <Text style={styles.saveText}>{isLoading ? 'Saving...' : 'Save to journal'}</Text>
        </TouchableOpacity>
      </ScrollView>
      )}
      <PhotoEditor
        visible={Boolean(editingPhoto)}
        uri={editingPhoto?.uri ?? null}
        onClose={() => setEditingPhoto(null)}
        onSave={handleSaveEditedPhoto}
      />
      <Modal
        {...FULLSCREEN_MODAL_PROPS}
        visible={pendingDelete !== null}
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <ModalScrim color="rgba(0,0,0,0.62)" />
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard} accessibilityLiveRegion="polite">
            <Text style={styles.noticeTitle}>Delete journal entry?</Text>
            <Text style={styles.noticeText}>
              This also removes its photos from your profile showcase.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelNoticeButton}
                onPress={() => setPendingDelete(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelNoticeButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.destructiveNoticeButton}
                onPress={async () => {
                  if (!pendingDelete) return;
                  const entry = pendingDelete;
                  setPendingDelete(null);
                  const result = await deleteEntry(entry);
                  if (result.error) Alert.alert('Delete failed', result.error);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.destructiveNoticeButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        {...FULLSCREEN_MODAL_PROPS}
        visible={notice !== null}
        animationType="fade"
        onRequestClose={() => setNotice(null)}
      >
        <ModalScrim color="rgba(0,0,0,0.62)" />
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard} accessibilityLiveRegion="polite">
            <Text style={styles.noticeTitle}>{notice?.title}</Text>
            <Text style={styles.noticeText}>{notice?.message}</Text>
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={() => setNotice(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.noticeButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT },
  headerCompact: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  headerSave: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: ACCENT_GOLD },
  headerSaveText: { color: BG_PANEL, fontSize: 12, fontWeight: '800' },
  headerTextWrap: { flexShrink: 1, minWidth: 0 },
  iconButton: { width: 34, height: 34, borderRadius: RADIUS_BTN, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_SUBTLE, marginRight: 12 },
  headerSpacer: { flex: 1 },
  eyebrow: { color: ACCENT_GOLD, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: TEXT_PRIMARY, fontSize: 21, fontWeight: '700', marginTop: 3 },
  newEntryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: ACCENT_GOLD },
  newEntryButtonText: { color: BG_PANEL, fontSize: 12, fontWeight: '800' },
  feedContent: { flex: 1, padding: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  feedContentLandscape: { padding: 6, maxWidth: 1400 },
  content: { padding: 24, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  label: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  input: { color: TEXT_PRIMARY, backgroundColor: BG_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textArea: { minHeight: 125 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewpointBanner: { color: ACCENT_GOLD, fontSize: 10, lineHeight: 15, marginTop: 6 },
  mountainOptions: { gap: 8, paddingRight: 4 },
  mountainOption: { borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BG_CARD },
  mountainOptionSelected: { borderColor: BORDER_GOLD, backgroundColor: BG_SUBTLE },
  mountainOptionText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  mountainOptionTextSelected: { color: ACCENT_GOLD },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: BORDER_GOLD, borderRadius: RADIUS_BTN, paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
  helper: { color: TEXT_FAINT, fontSize: 10, lineHeight: 15 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 12, paddingVertical: 10 },
  visibilityTitle: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  error: { color: '#E07070', fontSize: 11, marginTop: 16 },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: BORDER_GOLD, borderRadius: RADIUS_BTN, paddingVertical: 10, marginBottom: 14 },
  syncButtonCompact: { paddingVertical: 6, marginBottom: 6 },
  syncButtonText: { color: ACCENT_GOLD, fontSize: 11, fontWeight: '700' },
  saveButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT_GOLD, borderRadius: RADIUS_CARD, paddingVertical: 14, marginTop: 28 },
  saveText: { color: BG_PANEL, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  // ── landscape, no-scroll layout ──
  lsBody: { flex: 1, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 14 },
  lsLeft: { flex: 1.15 },
  lsDivider: { width: 1, backgroundColor: BORDER_DEFAULT },
  lsRight: { flex: 1 },
  lsRightContent: { paddingBottom: 4 },
  lsLabel: { color: TEXT_MUTED, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  lsHelper: { color: TEXT_FAINT, fontSize: 10, lineHeight: 14, marginTop: 5 },
  lsInput: { paddingVertical: 8 },
  lsTextArea: { flex: 1, minHeight: 60 },
  lsRow: { flexDirection: 'row', gap: 12 },
  lsCol: { flex: 1 },
  photoStrip: { alignItems: 'center', gap: 8, paddingTop: 6, paddingRight: 6 },
  addTile: { width: 52, height: 52, borderRadius: RADIUS_BTN, borderWidth: 1, borderStyle: 'dashed', borderColor: BORDER_GOLD, alignItems: 'center', justifyContent: 'center', gap: 1 },
  addTileText: { color: ACCENT_GOLD, fontSize: 9, fontWeight: '700' },
  thumb: { width: 52, height: 52 },
  thumbImg: { width: 52, height: 52, borderRadius: RADIUS_BTN, backgroundColor: BG_SUBTLE },
  thumbRemove: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,13,20,0.92)', borderWidth: 1, borderColor: BORDER_DEFAULT },
  photoHint: { width: 170, marginTop: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: BG_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  pillText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  noticeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    backgroundColor: CHAT_PANEL,
  },
  noticeTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  noticeText: { color: TEXT_MUTED, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  noticeButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: ACCENT_GOLD,
  },
  noticeButtonText: { color: CHAT_BG, fontSize: 12, fontWeight: '800' },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelNoticeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    backgroundColor: CHAT_SUBTLE,
  },
  cancelNoticeButtonText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  destructiveNoticeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: CHAT_DANGER,
  },
  destructiveNoticeButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});