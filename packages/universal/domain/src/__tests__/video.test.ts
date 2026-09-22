import type { Video } from '../video';

const REQUIRED = [
  'createdAt',
  'description',
  'durationMs',
  'generation',
  'height',
  'id',
  'ladder',
  'ownerId',
  'readyAt',
  'sourceKey',
  'sourceSizeBytes',
  'status',
  'title',
  'updatedAt',
  'version',
  'visibility',
  'width',
];

describe('@vp/domain: the video entity', () => {
  it('requires the identity, lifecycle and source columns and nothing else', () => {
    const video: Video = {
      id: 'video-1',
      ownerId: 'user-1',
      title: null,
      description: null,
      visibility: 'private',
      status: 'UPLOADING',
      sourceKey: 'video-1/source.mp4',
      sourceSizeBytes: null,
      durationMs: null,
      width: null,
      height: null,
      ladder: null,
      generation: 1,
      version: 1,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      readyAt: null,
    };

    expect(Object.keys(video).sort()).toEqual(REQUIRED);
  });

  it('carries the playback and counter columns as optional, so a fresh row omits them', () => {
    const ready: Video = {
      id: 'video-1',
      ownerId: 'user-1',
      title: 'Clip',
      description: null,
      visibility: 'public',
      status: 'READY',
      sourceKey: 'video-1/source.mp4',
      sourceSizeBytes: 1,
      durationMs: 1,
      width: 1,
      height: 1,
      ladder: [],
      generation: 1,
      version: 2,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      readyAt: new Date(0),
      playbackUrl: 'https://cdn.local/video-1/master.m3u8',
      viewsCount: 3,
    };

    expect(ready.playbackUrl).toContain('master.m3u8');
    expect(ready.viewsCount).toBe(3);
  });
});
