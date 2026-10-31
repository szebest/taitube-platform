import { type Video, buildPath, getVideo } from '@vp/api-contracts';
import { API_PROXY_PATH } from '@vp/queries';
import { type Result, err, fromPromise, ok } from '@vp/result';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { fetchSegments } from './fetch-segments';
import { lowestRendition } from './lowest-rendition';
import { singleVariantMaster } from './master-playlist';
import { segmentUris, truncatePlaylist } from './media-playlist';
import { type FetchedEntry, putAll, type SavedEntry, sizeOf } from './put-all';
import { readSavedIndex, savedIndexEntry } from './saved-index';
import { SAVED_LIMITS, type SaveFailure, type SavedStorage, type SavedVideo } from './saved-video';

const PLAYLIST_TYPE = 'application/vnd.apple.mpegurl';

async function fetchEntry(fetcher: typeof fetch, url: string | undefined) {
  if (!url) {
    return undefined;
  }
  const read = await fromPromise(
    async (): Promise<FetchedEntry | undefined> => {
      const response = await fetcher(url);
      return response.ok
        ? { url, body: await response.arrayBuffer(), type: response.headers.get('content-type') }
        : undefined;
    },
    (cause) => cause
  );
  return read.ok ? read.value : undefined;
}

const playlist = (url: string, body: string): SavedEntry => ({ url, body, type: PLAYLIST_TYPE });

/**
 * Stores what a viewer needs to watch the start of `video` offline in the saved cache: its detail
 * response, poster, a one-rendition master playlist, the lowest rendition's playlist and its first
 * segments, all within the per-video byte budget.
 */
export async function saveVideoOffline(
  { storage, fetch: fetcher, origin }: SavedStorage,
  video: Video
): Promise<Result<SavedVideo, SaveFailure>> {
  const opened = await fromPromise(
    storage.open(CACHE_NAMES.saved),
    (): SaveFailure => ({ reason: 'failed' })
  );
  if (!opened.ok) {
    return err(opened.error);
  }
  const cache = opened.value;

  const others = (await readSavedIndex(cache)).filter((saved) => saved.id !== video.id);
  if (others.length >= SAVED_LIMITS.videos) {
    return err({ reason: 'limit', limit: SAVED_LIMITS.videos });
  }

  const rendition = lowestRendition(video);
  if (!(rendition && video.playbackUrl)) {
    return err({ reason: 'unavailable' });
  }
  const media = await fetchEntry(fetcher, rendition.playlistUrl);
  if (!media) {
    return err({ reason: 'unavailable' });
  }

  const poster = await fetchEntry(fetcher, video.posterUrl);
  const fixed: SavedEntry[] = [
    {
      url: `${origin}${API_PROXY_PATH}${buildPath(getVideo.path, { id: video.id })}`,
      body: JSON.stringify(video),
      type: 'application/json',
    },
    playlist(video.playbackUrl, singleVariantMaster(rendition)),
    ...(poster ? [poster] : []),
  ];
  const reserved = [...fixed, media].reduce((sum, entry) => sum + sizeOf(entry), 0);

  const mediaText = new TextDecoder().decode(media.body);
  const segments = await fetchSegments(
    fetcher,
    segmentUris(mediaText)
      .slice(0, SAVED_LIMITS.segments)
      .map((uri) => new URL(uri, rendition.playlistUrl).href),
    SAVED_LIMITS.bytesPerVideo - reserved
  );
  if (segments.length === 0) {
    return err({ reason: 'unavailable' });
  }

  const entries: SavedEntry[] = [
    ...fixed,
    playlist(rendition.playlistUrl, truncatePlaylist(mediaText, segments.length)),
    ...segments,
  ];
  const saved: SavedVideo = {
    id: video.id,
    title: video.title ?? '',
    savedAt: Date.now(),
    bytes: entries.reduce((sum, entry) => sum + sizeOf(entry), 0),
    urls: entries.map(({ url }) => url),
  };

  const stored = await putAll(cache, [...entries, savedIndexEntry([...others, saved])]);
  return stored.ok ? ok(saved) : err(stored.error);
}
