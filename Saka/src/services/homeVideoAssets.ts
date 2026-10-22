// services/homeVideoAssets.ts
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from 'expo-video';
import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Bundled videos (ship inside the app binary — already offline-safe)
// ─────────────────────────────────────────────────────────────────────────────
export const MOUNTAIN_VIDEOS: Record<string, number> = {
  '2cd5666c-1deb-4499-812e-eb95a992ef68': require('../../assets/HomeScreenVideo/Balinsyaw Home.mp4'), // Mt. Balinsayaw
  'd39ff04a-069b-4d90-b448-f66e6ae05772': require('../../assets/HomeScreenVideo/Mount. M Home.mp4'), // Mt. M
  '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6': require('../../assets/HomeScreenVideo/Madjaas Home.mp4'), // Mt. Madjaas
  'f2173971-80bf-40dd-96e9-c6b015be194b': require('../../assets/HomeScreenVideo/Pandan Hills Home.mp4'), // Pandan Hills
  'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65': require('../../assets/HomeScreenVideo/Mt. Nangtud.mp4'), // Mt. Nangtud
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const POSTER_DIR_NAME = 'video-posters';
const POSTER_MANIFEST_KEY = '@saka/home-video-posters/v1';
const THUMB_OPTS = { maxWidth: 640, maxHeight: 360 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
/** In-memory poster map: mountainId → VideoThumbnail backed by a persisted file://. */
let posterMap: Record<string, VideoThumbnail> = {};

/** Subscribers that want to know when the poster map changes. */
const listeners = new Set<(next: Record<string, VideoThumbnail>) => void>();

/** Guards against running two preloads at once. */
let posterPreload: Promise<void> | null = null;

/** Guards against running the manifest load more than once. */
let manifestLoaded: Promise<void> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
function emit(next: Record<string, VideoThumbnail>) {
  posterMap = next;
  for (const cb of Array.from(listeners)) {
    try {
      cb(next);
    } catch (error) {
      console.warn('[HomeVideoAssets] poster listener threw:', error);
    }
  }
}

function setPoster(mountainId: string, poster: VideoThumbnail) {
  if (posterMap[mountainId] === poster) return;
  emit({ ...posterMap, [mountainId]: poster });
}

/** Returns the poster directory as a `Directory` instance (created lazily). */
function getPosterDir(): Directory {
  return new Directory(Paths.document, POSTER_DIR_NAME);
}

function ensurePosterDir(): Directory {
  const dir = getPosterDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** Poster file for a mountain ID (sanitized). Does NOT create it. */
function posterFile(mountainId: string): File {
  const safe = mountainId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new File(getPosterDir(), `${safe}.jpg`);
}

type Manifest = Record<string, string>; // mountainId → file:// path

async function readManifest(): Promise<Manifest> {
  try {
    const raw = await AsyncStorage.getItem(POSTER_MANIFEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Manifest) : {};
  } catch (error) {
    console.warn('[HomeVideoAssets] Failed to read poster manifest:', error);
    return {};
  }
}

async function writeManifest(manifest: Manifest): Promise<void> {
  try {
    await AsyncStorage.setItem(POSTER_MANIFEST_KEY, JSON.stringify(manifest));
  } catch (error) {
    console.warn('[HomeVideoAssets] Failed to write poster manifest:', error);
  }
}

/**
 * Load persisted posters from disk into memory. Safe to call multiple times;
 * only the first call does work. This is what makes cold-starts (online OR
 * offline) show posters instantly, before any video player is created.
 */
function loadPersistedPosters(): Promise<void> {
  if (manifestLoaded) return manifestLoaded;

  manifestLoaded = (async () => {
    const manifest = await readManifest();
    const entries = Object.entries(manifest);
    if (entries.length === 0) return;

    const next: Record<string, VideoThumbnail> = { ...posterMap };
    let changed = false;

    for (const [mountainId, uri] of entries) {
      try {
        const file = new File(uri);
        if (file.exists) {
          next[mountainId] = { uri } as unknown as VideoThumbnail;
          changed = true;
        }
      } catch (error) {
        console.warn(
          `[HomeVideoAssets] Persisted poster missing for ${mountainId}:`,
          error
        );
      }
    }

    if (changed) emit(next);
  })();

  return manifestLoaded;
}

/**
 * Persist a freshly generated thumbnail (which lives in a volatile cache) to
 * our own document directory so it survives app restarts and works offline.
 * Returns the file:// URI, or null if persistence failed.
 */
async function persistThumbnail(
  mountainId: string,
  thumb: VideoThumbnail
): Promise<string | null> {
  try {
    ensurePosterDir();

    const sourceUri = (thumb as unknown as { uri?: string }).uri;
    if (!sourceUri) return null;

    const dest = posterFile(mountainId);
    const source = new File(sourceUri);

    if (dest.exists) {
      dest.delete();
    }

    source.copy(dest);
    return dest.uri;
  } catch (error) {
    console.warn(
      `[HomeVideoAssets] Failed to persist poster for ${mountainId}:`,
      error
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current poster map snapshot.
 * Values are VideoThumbnails backed by persisted file:// URIs (safe offline).
 */
export function getHomeVideoPosters(): Record<string, VideoThumbnail> {
  return { ...posterMap };
}

/**
 * Subscribe to poster-map updates. Fires immediately with the current map,
 * then again on every change (load from disk, new thumbnail generated, etc.).
 * Returns an unsubscribe function.
 */
export function subscribeHomeVideoPosters(
  cb: (next: Record<string, VideoThumbnail>) => void
): () => void {
  listeners.add(cb);
  void loadPersistedPosters();
  try {
    cb({ ...posterMap });
  } catch (error) {
    console.warn('[HomeVideoAssets] poster listener threw on subscribe:', error);
  }
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Load persisted posters from disk without generating anything.
 * Use on app boot (e.g. before Home mounts) to make posters available offline
 * with zero video-player work.
 */
export function hydrateHomeVideoPosters(): Promise<void> {
  return loadPersistedPosters();
}

/**
 * Generate (and persist) a poster for every bundled mountain video.
 *
 * Behaviour:
 *  1. Loads persisted posters from disk first and emits them immediately.
 *  2. Skips any mountain that already has a persisted poster.
 *  3. Generates the rest in sequence with a single reused player.
 *  4. Persists each new thumbnail to the document directory.
 *  5. Emits after each thumbnail so `Home` updates live.
 *
 * Safe to call concurrently — subsequent calls join the in-flight promise.
 */
export function preloadHomeVideoPosters(
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  if (posterPreload) return posterPreload;

  const entries = Object.entries(MOUNTAIN_VIDEOS);
  const total = entries.length;

  posterPreload = (async () => {
    // 1) Make offline posters available ASAP.
    await loadPersistedPosters();

    if (total === 0) {
      onProgress?.(0, 0);
      return;
    }

    // Snapshot of what we still need to generate.
    const pending = entries.filter(([id]) => !posterMap[id]);
    let completed = total - pending.length;
    onProgress?.(completed, total);

    if (pending.length === 0) return;

    // 2) Reuse a single player to generate the missing thumbs.
    let player: VideoPlayer | null = null;
    const newManifestEntries: Manifest = {};

    try {
      player = createVideoPlayer(pending[0][1]);
      player.muted = true;

      for (let i = 0; i < pending.length; i += 1) {
        const [mountainId, source] = pending[i];
        try {
          if (i > 0) {
            await player.replaceAsync(source);
          }

          const [thumb] = await player.generateThumbnailsAsync(0, THUMB_OPTS);
          if (thumb) {
            const persistedUri = await persistThumbnail(mountainId, thumb);
            const value =
              persistedUri != null
                ? ({ uri: persistedUri } as unknown as VideoThumbnail)
                : thumb;

            setPoster(mountainId, value);

            if (persistedUri) {
              newManifestEntries[mountainId] = persistedUri;
            }
          }
        } catch (error) {
          console.warn(
            `[HomeVideoAssets] Failed to prepare video for mountain ${mountainId}:`,
            error
          );
        }

        completed += 1;
        onProgress?.(completed, total);
      }
    } finally {
      player?.release();
    }

    // 3) Merge newly persisted paths into the manifest.
    if (Object.keys(newManifestEntries).length > 0) {
      const manifest = await readManifest();
      await writeManifest({ ...manifest, ...newManifestEntries });
    }
  })().finally(() => {
    posterPreload = null;
  });

  return posterPreload;
}

/**
 * Clear all persisted posters (useful for debugging / a "reset media cache"
 * action). Does not touch in-memory subscribers.
 */
export async function clearHomeVideoPosters(): Promise<void> {
  try {
    const dir = getPosterDir();
    if (dir.exists) {
      dir.delete();
    }
    await AsyncStorage.removeItem(POSTER_MANIFEST_KEY);
  } catch (error) {
    console.warn('[HomeVideoAssets] Failed to clear posters:', error);
  }
  emit({});
}