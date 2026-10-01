import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

const AVATAR_BUCKET = 'avatars';

export async function uploadProfileAvatar(userId: string, uri: string): Promise<string> {
  if (!userId) {
    throw new Error('You must be signed in to upload a profile photo.');
  }

  let image: ArrayBuffer;
  try {
    image = await new File(uri).arrayBuffer();
  } catch (error) {
    const reason = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(`Unable to read the selected profile photo.${reason}`);
  }
  if (image.byteLength === 0) {
    throw new Error('The selected profile photo is empty or unavailable.');
  }

  const extension = getImageExtension(uri);
  const contentType = getImageContentType(extension);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, image, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Profile photo upload failed: ${error.message}`);
  }

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

function getImageExtension(uri: string): string {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ['png', 'webp', 'heic', 'heif'].includes(extension || '') ? extension! : 'jpg';
}

function getImageContentType(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
}