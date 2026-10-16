import type { VideoRecord } from '@vp/core/repositories';
import type { PlaylistDetail } from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import { toPlaylistView, toWatchHistoryItemView, toWatchProgressView } from '../library-views';
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

  it("puts a history entry's video under the channel the entry carries", () => {
    const entry = {
      id: 'h1',
      videoId: 'v1',
      progressSeconds: 0,
      durationSeconds: 1,
      watchedAt: AT,
      video: clip(null),
      channel: VIDEO_CHANNEL,
    };

    expect(toWatchHistoryItemView(entry, CDN, SPRITE).video.channel).toEqual(VIDEO_CHANNEL);
  });

  it('derives the percent, the completion and the resume point from a playhead', () => {
    expect(
      toWatchProgressView({
        videoId: 'v1',
        progressSeconds: 30,
        durationSeconds: 120,
        watchedAt: AT,
      })
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
