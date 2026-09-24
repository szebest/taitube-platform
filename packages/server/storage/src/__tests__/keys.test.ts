import { FIXTURES } from '@vp/testing';
import {
  masterPlaylistKey,
  posterKey,
  rawPrefix,
  rawSourceKey,
  renditionPlaylistKey,
  renditionPrefix,
  generationPrefix,
  sanitizeStorageUrl,
  spriteKey,
  spriteVttKey,
  videoPrefix,
} from '../keys';

describe('packages/storage: object keys', () => {
  const videoId = FIXTURES.VIDEO_ID;

  it('lays keys out as SDD §7 specifies', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`raw/${videoId}/source.mp4`);
    expect(rawSourceKey(videoId, '.mkv')).toBe(`raw/${videoId}/source.mkv`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p')).toBe(`videos/${videoId}/hls/1080p/index.m3u8`);
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
    expect(generationPrefix(videoId, 2)).toBe(`videos/${videoId}/hls/g2/`);
  });

  it('strips signature and credential params so a url is safe to log', () => {
    const signed =
      'http://localhost:9000/raw/018f/source.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin&X-Amz-Signature=abcd1234secret';

    expect(sanitizeStorageUrl(signed)).toBe('http://localhost:9000/raw/018f/source.mp4');
  });
});
