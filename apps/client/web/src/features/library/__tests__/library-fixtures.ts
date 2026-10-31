import type {
  AuthoredCommentView,
  ContractResult,
  getPlaylist,
  listMyPlaylists,
  SearchHistoryItemView,
  VideoSummary,
  WatchHistoryItemView,
} from '@vp/api-contracts';
import { channel, videoSummary } from '@vp/web-testing';

export const NOW = '2026-03-10T12:00:00.000Z';

const { id, handle, displayName, avatarUrl } = channel();

export function uuid(n: number): string {
  return `0190c3a0-5e1d-7000-8000-${String(n).padStart(12, '0')}`;
}

export function libraryVideo(n: number, title = `Video ${n}`) {
  return videoSummary({
    id: uuid(n),
    title,
    durationMs: 200_000,
    channel: { id, handle, displayName, avatarUrl },
  });
}

/** A history entry for the video numbered `n`, watched at `NOW`, 100 s into a 200 s video. */
export function historyItem(
  n: number,
  overrides: Partial<WatchHistoryItemView> & { title?: string } = {}
): WatchHistoryItemView {
  const { title, ...rest } = overrides;
  return {
    id: uuid(1000 + n),
    videoId: uuid(n),
    progressSeconds: 100,
    durationSeconds: 200,
    progressPercent: 50,
    completed: false,
    resumeAtSeconds: 100,
    watchedAt: NOW,
    video: libraryVideo(n, title),
    channel: { id, handle, displayName, avatarUrl },
    ...rest,
  };
}

export function searchItem(n: number, query = `search ${n}`): SearchHistoryItemView {
  return { id: uuid(2000 + n), query, searchedAt: NOW };
}

export function commentItem(n: number, content = `comment ${n}`): AuthoredCommentView {
  return {
    id: uuid(3000 + n),
    content,
    createdAt: NOW,
    parentId: null,
    likeCount: 0,
    video: { id: uuid(n), title: `Video ${n}` },
  };
}

export const WATCH_LATER_ID = uuid(4000);

/** The Watch Later list of the viewer holding `videos`. */
export function watchLaterPlaylist(
  id: string,
  videos: VideoSummary[]
): ContractResult<typeof getPlaylist> {
  return {
    id,
    ownerId: uuid(1),
    title: 'Watch later',
    description: '',
    visibility: 'private',
    isSystem: true,
    thumbnailUrl: null,
    videoCount: videos.length,
    owner: null,
    items: videos.map((video, position) => ({
      id: uuid(5000 + position),
      videoId: video.id,
      position,
      addedAt: NOW,
      video,
      channel: null,
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function ownedPlaylist(
  n: number,
  overrides: Partial<ContractResult<typeof listMyPlaylists>['items'][number]> = {}
): ContractResult<typeof listMyPlaylists>['items'][number] {
  return {
    id: uuid(4000 + n),
    title: `Playlist ${n}`,
    visibility: 'private',
    isSystem: false,
    videoCount: 3,
    containsVideo: false,
    updatedAt: NOW,
    ...overrides,
  };
}
