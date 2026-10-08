import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from 'expo-video';

export const MOUNTAIN_VIDEOS: Record<string, number> = {
  '2cd5666c-1deb-4499-812e-eb95a992ef68': require('../../assets/HomeScreenVideo/Balinsyaw Home.mp4'), // Mt. Balinsayaw
  'd39ff04a-069b-4d90-b448-f66e6ae05772': require('../../assets/HomeScreenVideo/Mount. M Home.mp4'), // Mt. M
  '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6': require('../../assets/HomeScreenVideo/Madjaas Home.mp4'), // Mt. Madjaas
  'f2173971-80bf-40dd-96e9-c6b015be194b': require('../../assets/HomeScreenVideo/Pandan Hills Home.mp4'), // Pandan Hills
  'e8dbcdf2-2120-4ed4-a677-69f9a2c7dc65': require('../../assets/HomeScreenVideo/Mt. Nangtud.mp4'), // Mt. Nangtud
};

const videoPosters: Record<string, VideoThumbnail> = {};
let posterPreload: Promise<void> | null = null;

export function getHomeVideoPosters(): Record<string, VideoThumbnail> {
  return { ...videoPosters };
}

export function preloadHomeVideoPosters(
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  if (posterPreload) return posterPreload;

  const entries = Object.entries(MOUNTAIN_VIDEOS);
  posterPreload = (async () => {
    if (entries.length === 0) return;

    let player: VideoPlayer | null = null;
    try {
      player = createVideoPlayer(entries[0][1]);
      player.muted = true;

      for (let index = 0; index < entries.length; index += 1) {
        const [mountainId, source] = entries[index];
        try {
          if (index > 0) {
            await player.replaceAsync(source);
          }

          const [poster] = await player.generateThumbnailsAsync(0, {
            maxWidth: 640,
            maxHeight: 360,
          });
          if (poster) {
            videoPosters[mountainId] = poster;
          }
        } catch (error) {
          console.warn(`[HomeVideoAssets] Failed to prepare video for mountain ${mountainId}:`, error);
        }

        onProgress?.(index + 1, entries.length);
      }
    } finally {
      player?.release();
    }
  })().finally(() => {
    posterPreload = null;
  });

  return posterPreload;
}