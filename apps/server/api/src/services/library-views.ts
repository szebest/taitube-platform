import type {
  ChannelPlaylistView,
  OwnedPlaylistView,
  PlaylistView,
  WatchHistoryItemView,
  WatchProgressView,
} from '@vp/api-contracts';
import {
  type OwnedPlaylist,
  PLAYLIST_COVER_MOSAIC_SIZE,
  type Playlist,
  type PlaylistDetail,
  type PlaylistEntry,
  type PublicPlaylist,
  type WatchHistoryEntry,
  type WatchProgress,
  clampSegment,
  isWatchCompleted,
  resumeAtSeconds,
  watchedPercent,
} from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { type SpriteGeometry, cdnUrl, toVideoSummaryView } from './video-views';

export function toPlaylistItemView(
  { addedAt, video, startMs, endMs, ...item }: PlaylistEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): PlaylistView['items'][number] {
  return {
    ...item,
    ...(video.durationMs === null
      ? { startMs, endMs }
      : clampSegment({ startMs, endMs }, video.durationMs)),
    addedAt: addedAt.toISOString(),
    episode: null,
    progress: null,
    video: toVideoSummaryView(video, cdn, sprite, item.channel),
  };
}

type ItemView = PlaylistView['items'][number];

/** The image the cover mode picks; an item or a custom image that is gone falls back to the first poster. */
function coverUrlOf(playlist: Playlist, entries: readonly ItemView[], cdn: CdnBase): string | null {
  const first = entries.find((entry) => entry.video.posterUrl)?.video.posterUrl ?? null;
  const { coverMode, coverVideoId, customThumbnailKey } = playlist;
  if (coverMode === 'custom' && customThumbnailKey) return cdnUrl(cdn, customThumbnailKey);
  if (coverMode === 'item') {
    return entries.find((entry) => entry.videoId === coverVideoId)?.video.posterUrl ?? first;
  }
  return first;
}

/** `computed` stands for the stored items of a smart playlist, which holds none. */
export function toPlaylistView(
  { playlist, owner, items, sections, viewer }: PlaylistDetail,
  cdn: CdnBase,
  sprite: SpriteGeometry,
  computed?: readonly ItemView[]
): PlaylistView {
  const { customThumbnailKey, coverMode, coverVideoId, pinnedAt, createdAt, updatedAt, ...fields } =
    playlist;
  const entries = computed
    ? [...computed]
    : items.map((item) => toPlaylistItemView(item, cdn, sprite));
  return {
    ...fields,
    thumbnailUrl: coverUrlOf(playlist, entries, cdn),
    cover: {
      mode: coverMode,
      videoId: coverVideoId,
      mosaicUrls: entries
        .flatMap((entry) => (entry.video.posterUrl ? [entry.video.posterUrl] : []))
        .slice(0, PLAYLIST_COVER_MOSAIC_SIZE),
    },
    pinnedAt: pinnedAt?.toISOString() ?? null,
    videoCount: entries.length,
    owner,
    nextEpisodeVideoId: null,
    items: entries,
    sections: sections.map(({ id, title, position }) => ({ id, title, position })),
    viewer,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toOwnedPlaylistView(playlist: OwnedPlaylist): OwnedPlaylistView {
  const { id, title, visibility, isSystem, rules, pinnedAt, videoCount, containsVideo, updatedAt } =
    playlist;
  return {
    id,
    title,
    visibility,
    isSystem,
    isSmart: rules !== null,
    pinnedAt: pinnedAt?.toISOString() ?? null,
    videoCount,
    containsVideo,
    updatedAt: updatedAt.toISOString(),
  };
}

export function toChannelPlaylistView(playlist: PublicPlaylist, cdn: CdnBase): ChannelPlaylistView {
  const { id, title, description, customThumbnailKey, posterKeys, videoCount, updatedAt } =
    playlist;
  const posterUrls = posterKeys.map((key) => cdnUrl(cdn, key));
  return {
    id,
    title,
    description,
    thumbnailUrl: customThumbnailKey ? cdnUrl(cdn, customThumbnailKey) : (posterUrls[0] ?? null),
    thumbnailUrls: posterUrls,
    videoCount,
    updatedAt: updatedAt.toISOString(),
  };
}

export function toWatchProgressView(progress: WatchProgress): WatchProgressView {
  const { videoId, progressSeconds, durationSeconds, watchedAt } = progress;
  return {
    videoId,
    progressSeconds,
    durationSeconds,
    progressPercent: watchedPercent(progress),
    completed: isWatchCompleted(progress),
    resumeAtSeconds: resumeAtSeconds(progress),
    watchedAt: watchedAt.toISOString(),
  };
}

export function toWatchHistoryItemView(
  entry: WatchHistoryEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): WatchHistoryItemView {
  return {
    ...toWatchProgressView(entry),
    id: entry.id,
    video: toVideoSummaryView(entry.video, cdn, sprite, entry.channel),
    channel: entry.channel,
  };
}
