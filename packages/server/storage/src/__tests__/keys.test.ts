import { SEEDED } from '@vp/testing';
import {
  captionsChunkKey,
  captionsFileKey,
  captionsPrefix,
  captionsTmpPrefix,
  channelImageKey,
  channelImagePrefix,
  chunkKey,
  chunkPrefix,
  liveArchivePlaylistKey,
  liveArchiveStateKey,
  liveInitKey,
  liveMasterKey,
  livePartKey,
  livePlaylistKey,
  livePrefix,
  liveRelativeUri,
  liveSegmentKey,
  masterPlaylistKey,
  posterKey,
  rawPrefix,
  rawSourceKey,
  renditionObjectKey,
  renditionPlaylistKey,
  renditionPrefix,
  reprocessPrefixesBefore,
  sanitizeStorageUrl,
  spriteKey,
  spriteVttKey,
  videoPrefix,
} from '../keys';

describe('packages/storage: object keys', () => {
  const videoId = SEEDED.videoId;
  const segmentKeyOf = (generation: number) =>
    renditionObjectKey(videoId, '720p', 'seg_00001.ts', generation);

  it('lays keys out as SDD §7 specifies', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`raw/${videoId}/source.mp4`);
    expect(rawSourceKey(videoId, '.mkv')).toBe(`raw/${videoId}/source.mkv`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p')).toBe(`videos/${videoId}/hls/1080p/index.m3u8`);
    expect(chunkPrefix(videoId, 2, '720p')).toBe(`tmp/chunks/${videoId}/g2/720p/`);
    expect(chunkKey(videoId, 2, '720p', 7)).toBe(`tmp/chunks/${videoId}/g2/720p/chunk_00007.mp4`);
    expect(captionsPrefix(videoId)).toBe(`videos/${videoId}/captions/`);
    expect(captionsFileKey(videoId, 'en')).toBe(`videos/${videoId}/captions/en/captions.vtt`);
    expect(captionsTmpPrefix(videoId)).toBe(`tmp/captions/${videoId}/`);
    expect(captionsChunkKey(videoId, 'small-q5_1', 3, 2)).toBe(
      `tmp/captions/${videoId}/small-q5_1/v3/w2.json`
    );
    expect(posterKey(videoId)).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(spriteKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(spriteVttKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.vtt`);
  });

  it('prefixes a reprocess generation into the playback keys', () => {
    expect(masterPlaylistKey(videoId, 2)).toBe(`videos/${videoId}/hls/g2/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p', 2)).toBe(
      `videos/${videoId}/hls/g2/1080p/index.m3u8`
    );
  });

  it('owns the prefixes a purge sweeps', () => {
    expect(rawPrefix(videoId)).toBe(`raw/${videoId}/`);
    expect(videoPrefix(videoId)).toBe(`videos/${videoId}/`);
    expect(renditionPrefix(videoId, '720p')).toBe(`videos/${videoId}/hls/720p/`);
    expect(renditionPrefix(videoId, '720p', 3)).toBe(`videos/${videoId}/hls/g3/720p/`);
  });

  it.each([
    [1, []],
    [2, []],
    [4, [`videos/${videoId}/hls/g2/`, `videos/${videoId}/hls/g3/`]],
  ])('lists the reprocess prefixes older than generation %i', (current, expected) => {
    expect(reprocessPrefixesBefore(videoId, current)).toEqual(expected);
  });

  it('holds every playback key a reprocess generation writes under its prefix', () => {
    const [prefix = ''] = reprocessPrefixesBefore(videoId, 3);

    expect(masterPlaylistKey(videoId, 2).startsWith(prefix)).toBe(true);
    expect(segmentKeyOf(2).startsWith(prefix)).toBe(true);
    expect(masterPlaylistKey(videoId, 3).startsWith(prefix)).toBe(false);
  });

  it('keeps a channel image under its channel and kind prefix', () => {
    const key = channelImageKey('chan-1', 'avatar', 'img-9', 'webp');

    expect(key).toBe('channels/chan-1/avatar/img-9.webp');
    expect(key.startsWith(channelImagePrefix('chan-1', 'avatar'))).toBe(true);
    expect(key.startsWith(channelImagePrefix('chan-1', 'banner'))).toBe(false);
    expect(key.startsWith(channelImagePrefix('chan-10', 'avatar'))).toBe(false);
  });

  it('keeps everything a broadcast writes under its live prefix, an epoch apart', () => {
    const streamId = 'stream-1';
    const keys = [
      liveInitKey(streamId, 0),
      liveSegmentKey(streamId, 1, 12),
      livePartKey(streamId, 1, 12, 3),
      liveMasterKey(streamId),
      livePlaylistKey(streamId),
      liveArchivePlaylistKey(streamId),
      liveArchiveStateKey(streamId),
    ];

    expect(keys).toEqual([
      'live/stream-1/0/init.mp4',
      'live/stream-1/1/12.m4s',
      'live/stream-1/1/12.3.m4s',
      'live/stream-1/master.m3u8',
      'live/stream-1/index.m3u8',
      'live/stream-1/archive.m3u8',
      'live/stream-1/archive.json',
    ]);
    expect(keys.every((key) => key.startsWith(livePrefix(streamId)))).toBe(true);
  });

  it.each([
    { key: 'live/stream-1/1/12.m4s', uri: '1/12.m4s' },
    { key: 'videos/other/hls/master.m3u8', uri: 'videos/other/hls/master.m3u8' },
  ])('addresses $key from the live playlists as $uri', ({ key, uri }) => {
    expect(liveRelativeUri('stream-1', key)).toBe(uri);
  });

  it.each([
    {
      scenario: 'signature and credential params',
      url: 'http://localhost:9000/raw/018f/source.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin&X-Amz-Signature=abcd1234secret',
      safe: 'http://localhost:9000/raw/018f/source.mp4',
    },
    {
      scenario: 'user info',
      url: 'rtsp://vp-worker:hook-secret@mediamtx:8554/live/key',
      safe: 'rtsp://mediamtx:8554/live/key',
    },
  ])('strips $scenario so a url is safe to log', ({ url, safe }) => {
    expect(sanitizeStorageUrl(url)).toBe(safe);
  });
});
