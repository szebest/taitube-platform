import type { PlaylistDetail } from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import { toPlaylistView, toWatchProgressView } from '../library-views';

const CDN = asCdnBase('http://cdn.test');
const AT = new Date('2026-03-01T12:00:00.000Z');

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
        channel: null,
        video: {
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
        },
      },
    ],
  };
}

describe('apps/api/services: library views', () => {
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
    expect(toPlaylistView(detail(custom, poster), CDN).thumbnailUrl).toBe(url);
  });

  it('dates the playlist and its items on the wire', () => {
    const view = toPlaylistView(detail(null, null), CDN);

    expect(view).toMatchObject({ createdAt: AT.toISOString(), videoCount: 1 });
    expect(view.items[0]).toMatchObject({ addedAt: AT.toISOString(), video: { id: 'v1' } });
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
