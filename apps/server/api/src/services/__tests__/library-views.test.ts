import type { VideoRecord } from '@vp/core/repositories';
import type { PlaylistDetail, PublicPlaylist, WatchHistoryEntry } from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import {
  toChannelPlaylistView,
  toPlaylistView,
  toWatchHistoryItemView,
  toWatchProgressView,
} from '../library-views';
import { TEST_SPRITE as SPRITE } from './service-deps';

const CDN = asCdnBase('http://cdn.test');
const VIDEO_CHANNEL = { id: 'c2', handle: 'clips', displayName: 'Clips', avatarUrl: null };
const AT = new Date('2026-03-01T12:00:00.000Z');

function clip(posterKey: string | null): VideoRecord {
  return {
    id: 'v1',
    ownerId: 'u2',
    title: 'Clip',
    description: null,
    visibility: 'public',
    status: 'READY',
    format: 'standard',
    sourceKey: 'raw/v1/source.mp4',
    sourceSizeBytes: null,
    durationMs: 1_000,
    width: null,
    height: null,
    ladder: null,
    posterKey,
    generation: 1,
    version: 0,
    createdAt: AT,
    updatedAt: AT,
    readyAt: AT,
  };
}

function detail(customThumbnailKey: string | null, posterKey: string | null): PlaylistDetail {
  return {
    playlist: {
      id: 'p1',
      ownerId: 'u1',
      title: 'Mix',
      description: '',
      visibility: 'public',
      isSystem: false,
      customThumbnailKey,
      createdAt: AT,
      updatedAt: AT,
    },
    owner: null,
    items: [
      {
        id: 'i1',
        videoId: 'v1',
        position: 0,
        addedAt: AT,
        channel: VIDEO_CHANNEL,
        video: clip(posterKey),
      },
    ],
  };
}

function publicPlaylist(overrides: Partial<PublicPlaylist> = {}): PublicPlaylist {
  return { ...detail(null, null).playlist, videoCount: 0, posterKeys: [], ...overrides };
}

function historyEntry(overrides: Partial<WatchHistoryEntry> = {}): WatchHistoryEntry {
  return {
    id: 'h1',
    videoId: 'v1',
    progressSeconds: 0,
    durationSeconds: 1,
    watchedAt: AT,
    video: clip(null),
    channel: VIDEO_CHANNEL,
    ...overrides,
  };
}

describe('apps/server/api/services: library views', () => {
  it.each([
    {
      scenario: 'a custom thumbnail',
      custom: 'thumbs/p1.jpg',
      poster: 'v1/poster.jpg',
      url: `${CDN}/thumbs/p1.jpg`,
    },
    {
      scenario: 'the first poster',
      custom: null,
      poster: 'v1/poster.jpg',
      url: `${CDN}/v1/poster.jpg`,
    },
    { scenario: 'nothing to show', custom: null, poster: null, url: null },
  ])('shows $scenario as the playlist thumbnail', ({ custom, poster, url }) => {
    expect(toPlaylistView(detail(custom, poster), CDN, SPRITE).thumbnailUrl).toBe(url);
  });

  it("dates the playlist and its items on the wire, each video under its owner's channel", () => {
    const view = toPlaylistView(detail(null, null), CDN, SPRITE);

    expect(view).toMatchObject({ createdAt: AT.toISOString(), videoCount: 1 });
    expect(view.items[0]).toMatchObject({
      addedAt: AT.toISOString(),
      video: { id: 'v1', channel: VIDEO_CHANNEL },
    });
  });

  it.each([
    {
      scenario: 'a custom thumbnail over the posters',
      playlist: publicPlaylist({ customThumbnailKey: 'thumbs/p1.jpg', posterKeys: ['a.jpg'] }),
      cover: `${CDN}/thumbs/p1.jpg`,
      stack: [`${CDN}/a.jpg`],
    },
    {
      scenario: 'the first poster when there is no custom one',
      playlist: publicPlaylist({ posterKeys: ['a.jpg', 'b.jpg', 'c.jpg'] }),
      cover: `${CDN}/a.jpg`,
      stack: [`${CDN}/a.jpg`, `${CDN}/b.jpg`, `${CDN}/c.jpg`],
    },
    { scenario: 'nothing to show', playlist: publicPlaylist(), cover: null, stack: [] },
  ])('stacks $scenario on a channel playlist card', ({ playlist, cover, stack }) => {
    expect(toChannelPlaylistView(playlist, CDN)).toMatchObject({
      thumbnailUrl: cover,
      thumbnailUrls: stack,
    });
  });

  it('carries the count and the date of a channel playlist card', () => {
    expect(toChannelPlaylistView(publicPlaylist({ videoCount: 14 }), CDN)).toEqual({
      id: 'p1',
      title: 'Mix',
      description: '',
      thumbnailUrl: null,
      thumbnailUrls: [],
      videoCount: 14,
      updatedAt: AT.toISOString(),
    });
  });

  it("puts a history entry's video under the channel the entry carries", () => {
    expect(toWatchHistoryItemView(historyEntry(), CDN, SPRITE).video.channel).toEqual(
      VIDEO_CHANNEL
    );
  });

  it('derives the percent, the completion and the resume point from a playhead', () => {
    expect(
      toWatchProgressView(historyEntry({ progressSeconds: 30, durationSeconds: 120 }))
    ).toEqual({
      videoId: 'v1',
      progressSeconds: 30,
      durationSeconds: 120,
      progressPercent: 25,
      completed: false,
      resumeAtSeconds: 30,
      watchedAt: AT.toISOString(),
    });
  });
});
