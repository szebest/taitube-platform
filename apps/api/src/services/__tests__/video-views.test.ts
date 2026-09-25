import type { RenditionRecord, VideoRecord } from '@vp/core/repositories';
import { asCdnBase } from '@vp/env-schema';
import {
  playbackUrl,
  thumbnailUrl,
  toCreatorVideoView,
  toVideoDetailView,
  toVideoSummaryView,
} from '../video-views';

const CDN = asCdnBase('http://localhost:9000/public');
const VIDEO_ID = '00000000-0000-7000-8000-0000000000e1';
const CREATED_AT = new Date('2026-01-02T03:04:05.000Z');

function video(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: VIDEO_ID,
    ownerId: '00000000-0000-7000-8000-0000000000e2',
    title: 'A video',
    description: null,
    visibility: 'public',
    status: 'READY',
    sourceKey: 'raw/a.mp4',
    version: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  } as VideoRecord;
}

function rendition(overrides: Partial<RenditionRecord> = {}): RenditionRecord {
  return { videoId: VIDEO_ID, name: '720p', status: 'DONE', ...overrides } as RenditionRecord;
}

describe('apps/api/services: video views', () => {
  describe('playbackUrl', () => {
    it.each([['UPLOADING'], ['PROBING'], ['PROCESSING'], ['FAILED']] as const)(
      'withholds the stream while the video is %s',
      (status) => {
        expect(playbackUrl({ id: VIDEO_ID, status }, CDN)).toBeUndefined();
      }
    );

    it('falls back to the conventional master playlist key', () => {
      expect(playbackUrl({ id: VIDEO_ID, status: 'READY' }, CDN)).toBe(
        `${CDN}/videos/${VIDEO_ID}/hls/master.m3u8`
      );
    });

    it('does not double the separator when the key is already rooted', () => {
      expect(
        playbackUrl({ id: VIDEO_ID, status: 'READY', masterPlaylistKey: '/hls/master.m3u8' }, CDN)
      ).toBe(`${CDN}/hls/master.m3u8`);
    });
  });

  describe('thumbnailUrl', () => {
    it.each([
      {
        name: 'the custom image over the poster',
        keys: { posterKey: 'p.jpg', customThumbnailKey: 'c.png' },
        expected: `${CDN}/c.png`,
      },
      {
        name: 'the poster without a custom image',
        keys: { posterKey: 'p.jpg' },
        expected: `${CDN}/p.jpg`,
      },
      { name: 'nothing before the pipeline made a poster', keys: {}, expected: undefined },
    ])('shows $name', ({ keys, expected }) => {
      expect(thumbnailUrl(keys, CDN)).toBe(expected);
    });
  });

  describe('toCreatorVideoView', () => {
    it('adds the comment counter and the tags to the summary', () => {
      const subject = video({ commentsCount: 4, tags: ['lofi'], customThumbnailKey: 'c.png' });

      expect(toCreatorVideoView(subject, CDN)).toEqual({
        ...toVideoSummaryView(subject, CDN),
        commentsCount: 4,
        tags: ['lofi'],
      });
    });

    it('reads absent counters and tags as their column defaults', () => {
      expect(toCreatorVideoView(video(), CDN)).toMatchObject({ commentsCount: 0, tags: [] });
    });
  });

  describe('toVideoSummaryView', () => {
    it('projects counters, ISO timestamps and asset URLs', () => {
      const view = toVideoSummaryView(
        video({ posterKey: 'posters/a.jpg', viewsCount: 12, likesCount: 3 }),
        CDN
      );

      expect(view).toMatchObject({
        id: VIDEO_ID,
        posterUrl: `${CDN}/posters/a.jpg`,
        playbackUrl: `${CDN}/videos/${VIDEO_ID}/hls/master.m3u8`,
        viewsCount: 12,
        likesCount: 3,
        dislikesCount: 0,
        categoryId: null,
        thumbnailUrl: `${CDN}/posters/a.jpg`,
        createdAt: CREATED_AT.toISOString(),
      });
    });
  });

  describe('toVideoDetailView', () => {
    it('carries the studio fields a creator edits', () => {
      const view = toVideoDetailView(
        video({ categoryId: 'category-1', tags: ['jazz'], customThumbnailKey: 'c.png' }),
        [],
        CDN
      );

      expect(view).toMatchObject({
        categoryId: 'category-1',
        tags: ['jazz'],
        thumbnailUrl: `${CDN}/c.png`,
      });
    });

    it('agrees with the summary view on the playback URL', () => {
      const subject = video();

      expect(toVideoDetailView(subject, [], CDN).playbackUrl).toBe(
        toVideoSummaryView(subject, CDN).playbackUrl
      );
    });

    it('averages rendition completion for a video still processing', () => {
      const view = toVideoDetailView(
        video({ status: 'PROCESSING' }),
        [rendition(), rendition({ name: '480p', status: 'RUNNING' })],
        CDN
      );

      expect(view.progress).toEqual({ overall: 50, byRendition: { '720p': 100, '480p': 0 } });
    });

    it('lifts a rendition to its reported percent from progress events', () => {
      const view = toVideoDetailView(
        video({ status: 'PROCESSING' }),
        [rendition({ status: 'RUNNING' })],
        CDN,
        [{ type: 'progress', payload: { rendition: '720p', percent: 60 } }]
      );

      expect(view.progress).toEqual({ overall: 60, byRendition: { '720p': 60 } });
    });

    it('derives the sprite VTT alongside the sprite sheet', () => {
      const view = toVideoDetailView(video({ spriteKey: 'sprites/a.jpg' }), [], CDN);

      expect(view).toMatchObject({
        spriteUrl: `${CDN}/sprites/a.jpg`,
        spriteVttUrl: `${CDN}/sprites/a.vtt`,
      });
    });

    it('surfaces the recorded failure', () => {
      const view = toVideoDetailView(
        video({ status: 'FAILED', errorCode: 'PROBE_FAILED', errorMessage: 'no stream' }),
        [],
        CDN
      );

      expect(view.error).toEqual({ code: 'PROBE_FAILED', message: 'no stream' });
    });
  });
});
