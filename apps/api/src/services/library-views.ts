import type {
  OwnedPlaylistView,
  PlaylistView,
  WatchHistoryItemView,
  WatchProgressView,
} from '@vp/api-contracts';
import {
  type OwnedPlaylist,
  type PlaylistDetail,
  type WatchHistoryEntry,
  type WatchProgress,
  isWatchCompleted,
  resumeAtSeconds,
  watchedPercent,
} from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { cdnUrl, toVideoSummaryView } from './video-views';

export function toPlaylistView(
  { playlist, owner, items }: PlaylistDetail,
  cdn: CdnBase
): PlaylistView {
  const { customThumbnailKey, createdAt, updatedAt, ...fields } = playlist;
  const entries = items.map(({ addedAt, video, ...item }) => ({
    ...item,
    addedAt: addedAt.toISOString(),
    video: toVideoSummaryView(video, cdn),
  }));
  return {
    ...fields,
    thumbnailUrl: customThumbnailKey
      ? cdnUrl(cdn, customThumbnailKey)
      : (entries[0]?.video.posterUrl ?? null),
    videoCount: entries.length,
    owner,
    items: entries,
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
  cdn: CdnBase
): WatchHistoryItemView {
  return {
    ...toWatchProgressView(entry),
    id: entry.id,
    video: toVideoSummaryView(entry.video, cdn),
    channel: entry.channel,
  };
}
