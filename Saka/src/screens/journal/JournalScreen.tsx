import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import JournalImageGrid from '../../components/journal/JournalImageGrid';
import { useJournalStore } from '../../store/journalStore';
import type { JournalImage } from '../../types/journal';
import { ACCENT_GOLD, BG_CARD, BG_DANGER_SUBTLE, BG_PANEL, BG_SUBTLE, BORDER_DEFAULT, BORDER_DANGER, BORDER_GOLD, BORDER_SUBTLE, RADIUS_BTN, RADIUS_CARD, TEXT_DANGER, TEXT_FAINT, TEXT_MUTED, TEXT_PRIMARY } from '../../theme/designTokens';

export default function JournalScreen() {
  const router = useRouter();
  const { entries, fetchEntries, saveEntry, deleteEntry, isLoading, error, clearError } = useJournalStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<JournalImage[]>([]);
  const [rating, setRating] = useState(0);
  const saveInProgress = useRef(false);

  const normalizeLocalUri = (uri: string): string => {
    let normalized = uri;

    for (let index = 0; index < 2 && normalized.includes('%25'); index += 1) {
      try {
        normalized = decodeURIComponent(normalized);
      } catch {
        break;
      }
    }

    return normalized;
  };

  useEffect(() => {
    fetchEntries();
    return () => clearError();
  }, [clearError, fetchEntries]);

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
      console.log('[Journal] Selected assets:', result.assets);
      const selectedImages = result.assets.map((asset) => {
        const uri = normalizeLocalUri(asset.uri);
        console.log('[Journal] Original URI:', asset.uri);
        console.log('[Journal] Normalized URI:', uri);
        return { uri, mimeType: asset.mimeType };
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
    saveInProgress.current = true;

    try {
      const result = await saveEntry({
        title,
        content,
        images,
        rating: rating || undefined,
      });

      if (result.error) {
        Alert.alert('Save failed', result.error);
        return;
      }

      Alert.alert('Journal saved', 'Your photos are now part of your profile showcase.', [{ text: 'View profile', onPress: () => router.back() }]);
      setTitle('');
      setContent('');
      setImages([]);
      setRating(0);
    } finally {
      saveInProgress.current = false;
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>YOUR TRAIL NOTES</Text>
          <Text style={styles.title}>New journal entry</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="A day above the clouds" placeholderTextColor={TEXT_FAINT} style={styles.input} />

        <Text style={styles.label}>Your experience</Text>
        <TextInput value={content} onChangeText={setContent} placeholder="What did you notice, feel, or learn on the trail?" placeholderTextColor={TEXT_FAINT} multiline textAlignVertical="top" style={[styles.input, styles.textArea]} />

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
          {[1, 2, 3, 4, 5].map((value) => <TouchableOpacity key={value} onPress={() => setRating(value)}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={25} color={ACCENT_GOLD} /></TouchableOpacity>)}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity onPress={save} disabled={isLoading} style={[styles.saveButton, isLoading && styles.disabled]}>
          <Ionicons name="book-outline" size={17} color={BG_PANEL} />
          <Text style={styles.saveText}>{isLoading ? 'Saving...' : 'Save to journal'}</Text>
        </TouchableOpacity>

        <Text style={styles.savedTitle}>Saved entries</Text>
        {entries.length === 0 ? (
          <Text style={styles.helper}>Your saved experiences will appear here.</Text>
        ) : entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <Text style={styles.entryTitle}>{entry.title}</Text>
            <Text style={styles.entryContent} numberOfLines={3}>{entry.content}</Text>
            <View style={styles.entryFooter}>
              <Text style={styles.entryDate}>{new Date(entry.created_at).toLocaleDateString()}</Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => Alert.alert(
                  'Delete journal entry?',
                  'This also removes its photos from your profile showcase.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        const result = await deleteEntry(entry);
                        if (result.error) Alert.alert('Delete failed', result.error);
                      },
                    },
                  ],
                )}
              >
                <Ionicons name="trash-outline" size={14} color={TEXT_DANGER} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PANEL },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT },
  iconButton: { width: 34, height: 34, borderRadius: RADIUS_BTN, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_SUBTLE, marginRight: 12 },
  headerSpacer: { flex: 1 },
  eyebrow: { color: ACCENT_GOLD, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: TEXT_PRIMARY, fontSize: 21, fontWeight: '700', marginTop: 3 },
  content: { padding: 24, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  label: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  input: { color: TEXT_PRIMARY, backgroundColor: BG_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textArea: { minHeight: 125 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: BORDER_GOLD, borderRadius: RADIUS_BTN, paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { color: ACCENT_GOLD, fontSize: 10, fontWeight: '700' },
  helper: { color: TEXT_FAINT, fontSize: 10, lineHeight: 15 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  error: { color: '#E07070', fontSize: 11, marginTop: 16 },
  saveButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT_GOLD, borderRadius: RADIUS_CARD, paddingVertical: 14, marginTop: 28 },
  saveText: { color: BG_PANEL, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  savedTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', marginTop: 32, marginBottom: 4 },
  entryCard: { backgroundColor: BG_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, borderRadius: RADIUS_CARD, padding: 14, marginTop: 12 },
  entryTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  entryContent: { color: TEXT_MUTED, fontSize: 11, lineHeight: 16, marginTop: 6 },
  entryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  entryDate: { color: TEXT_FAINT, fontSize: 10 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS_BTN, backgroundColor: BG_DANGER_SUBTLE, borderWidth: 1, borderColor: BORDER_DANGER },
  deleteText: { color: TEXT_DANGER, fontSize: 10, fontWeight: '700' },
});
