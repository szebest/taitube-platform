import type {
  ChannelPlaylistView,
  OwnedPlaylistView,
  PlaylistView,
  WatchHistoryItemView,
  WatchProgressView,
} from '@vp/api-contracts';
import {
  type OwnedPlaylist,
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

export function toPlaylistView(
  { playlist, owner, items, sections }: PlaylistDetail,
  cdn: CdnBase,
  sprite: SpriteGeometry
): PlaylistView {
  const { customThumbnailKey, createdAt, updatedAt, ...fields } = playlist;
  const entries = items.map((item) => toPlaylistItemView(item, cdn, sprite));
  return {
    ...fields,
    thumbnailUrl: customThumbnailKey
      ? cdnUrl(cdn, customThumbnailKey)
      : (entries[0]?.video.posterUrl ?? null),
    videoCount: entries.length,
    owner,
    nextEpisodeVideoId: null,
    items: entries,
    sections: sections.map(({ id, title, position }) => ({ id, title, position })),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toOwnedPlaylistView(playlist: OwnedPlaylist): OwnedPlaylistView {
  const { id, title, visibility, isSystem, videoCount, containsVideo, updatedAt } = playlist;
  return {
    id,
    title,
    visibility,
    isSystem,
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
