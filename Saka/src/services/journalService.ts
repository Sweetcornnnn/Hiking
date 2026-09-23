import { supabase } from '../lib/supabase';
import type { CreateJournalEntryInput, JournalEntry, JournalImage } from '../types/journal';

const JOURNAL_BUCKET = 'journal-images';

export async function fetchMyJournalEntries(): Promise<JournalEntry[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be signed in to load journal entries.');
  }

  const { data, error } = await supabase
    .from('hiking_journals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Unable to load journal entries: ${error.message}`);
  }

  return (data ?? []) as JournalEntry[];
}

async function uploadJournalImage(userId: string, journalId: string, image: JournalImage): Promise<string> {
  const uri = normalizeLocalUri(image.uri);
  const contentType = image.mimeType || getImageContentType(uri);
  let arrayBuffer: ArrayBuffer;

  try {
    console.log('[Journal] Reading selected photo:', uri);
    console.log('[Journal] Before fetch');
    const response = await fetch(uri);
    console.log('[Journal] After fetch', {
      status: response.status,
      ok: response.ok,
      type: response.type,
    });
    if (!response.ok && response.status !== 0) {
      throw new Error(`Local photo returned HTTP ${response.status}.`);
    }
    arrayBuffer = await response.arrayBuffer();
    console.log('[Journal] After arrayBuffer:', arrayBuffer.byteLength);

    if (arrayBuffer.byteLength === 0) {
      throw new Error('The selected photo is empty or unavailable.');
    }
  } catch (error: any) {
    throw new Error(
      `Unable to read the selected photo: ${error?.message || 'Unknown file error'}`,
    );
  }

  const extension = getExtension(contentType);
  const path = `${userId}/${journalId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  console.log('[Journal] Before Storage upload:', {
    bucket: JOURNAL_BUCKET,
    path,
    contentType,
    bytes: arrayBuffer.byteLength,
  });

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(JOURNAL_BUCKET)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });

  console.log('[Journal] Storage upload result:', {
    data: uploadData,
    error: uploadError?.message,
  });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  return supabase.storage.from(JOURNAL_BUCKET).getPublicUrl(path).data.publicUrl;
}

function getImageContentType(uri: string): string {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function getExtension(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
}

function normalizeLocalUri(uri: string): string {
  let normalized = uri;

  for (let index = 0; index < 2 && normalized.includes('%25'); index += 1) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      break;
    }
  }

  return normalized;
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('You must be signed in to save a journal entry.');

  console.log('[Journal] Auth state:', {
    authenticated: true,
    userId: user.id,
  });

  const uniqueImages = Array.from(
    new Map(input.images.map((image) => [image.uri, image])).values(),
  );

  const { data: journalData, error: insertError } = await supabase
    .from('hiking_journals')
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      content: input.content.trim(),
      images: [],
      rating: input.rating ?? null,
      mountain_id: input.mountainId ?? null,
      hike_id: input.hikeId ?? null,
      is_public: input.isPublic ?? false,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const journalId = journalData.id as string;

  const images = await Promise.all(
    uniqueImages.map((image) => uploadJournalImage(user.id, journalId, image)),
  );

  const { data, error } = await supabase
    .from('hiking_journals')
    .update({ images })
    .eq('id', journalId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as JournalEntry;
}

function getStoragePath(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${JOURNAL_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);

  return markerIndex >= 0
    ? decodeURIComponent(imageUrl.slice(markerIndex + marker.length))
    : null;
}

export async function deleteJournalEntry(entry: JournalEntry): Promise<void> {
  const imagePaths = entry.images
    .map(getStoragePath)
    .filter((path): path is string => Boolean(path));

  if (imagePaths.length > 0) {
    const { error: imageError } = await supabase.storage
      .from(JOURNAL_BUCKET)
      .remove(imagePaths);

    if (imageError) throw imageError;
  }

  const { error } = await supabase
    .from('hiking_journals')
    .delete()
    .eq('id', entry.id)
    .eq('user_id', entry.user_id);

  if (error) throw error;
}
