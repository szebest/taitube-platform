import { S3StorageClient } from '@vp/adapters';
import { describe, expect, it } from 'vitest';
import {
  MULTIPART_MAX_PART_SIZE,
  MULTIPART_MIN_PART_SIZE,
  calculatePartSize,
  calculateTotalParts,
  getHeaderMapping,
  masterPlaylistKey,
  metaKey,
  posterKey,
  rawSourceKey,
  renditionPlaylistKey,
  sanitizeStorageUrl,
  segmentKey,
  spriteKey,
  spriteVttKey,
} from '../index.js';

describe('packages/storage (AC 17, AC 22)', () => {
  const videoId = '018f0000-0000-7000-8000-000000000001';

  it('AC 22: deterministic key layout matches SDD §7', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`raw/${videoId}/source.mp4`);
    expect(rawSourceKey(videoId, '.mkv')).toBe(`raw/${videoId}/source.mkv`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(masterPlaylistKey(videoId, 2)).toBe(`videos/${videoId}/hls/g2/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p')).toBe(`videos/${videoId}/hls/1080p/index.m3u8`);
    expect(segmentKey(videoId, '720p', 1)).toBe(`videos/${videoId}/hls/720p/seg_00001.ts`);
    expect(segmentKey(videoId, '720p', 99)).toBe(`videos/${videoId}/hls/720p/seg_00099.ts`);
    expect(segmentKey(videoId, '1080p', 5, 2)).toBe(`videos/${videoId}/hls/g2/1080p/seg_00005.ts`);
    expect(posterKey(videoId)).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(spriteKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(spriteVttKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.vtt`);
    expect(metaKey(videoId)).toBe(`videos/${videoId}/meta.json`);
  });

  it('AC 22: .m3u8, .ts, .jpg, .vtt header mapping unit-tested for later tickets', () => {
    // .m3u8 playlist
    const m3u8 = getHeaderMapping('master.m3u8');
    expect(m3u8.contentType).toBe('application/vnd.apple.mpegurl');
    expect(m3u8.cacheControl).toBe('public, max-age=60');

    // .ts segment
    const ts = getHeaderMapping('seg_00001.ts');
    expect(ts.contentType).toBe('video/MP2T');
    expect(ts.cacheControl).toBe('public, max-age=31536000, immutable');

    // .jpg image
    const jpg = getHeaderMapping('poster.jpg');
    expect(jpg.contentType).toBe('image/jpeg');
    expect(jpg.cacheControl).toBe('public, max-age=31536000, immutable');

    // .vtt thumbnails
    const vtt = getHeaderMapping('sprite.vtt');
    expect(vtt.contentType).toBe('text/vtt');
    expect(vtt.cacheControl).toBe('public, max-age=31536000, immutable');

    // .json metadata
    const json = getHeaderMapping('meta.json');
    expect(json.contentType).toBe('application/json');
    expect(json.cacheControl).toBe('public, max-age=60');

    // fallback
    const bin = getHeaderMapping('unknown.bin');
    expect(bin.contentType).toBe('application/octet-stream');
    expect(bin.cacheControl).toBe('no-cache');
  });

  it('AC 17: createPresignedPutUrl generates signed PUT URL with content headers and <= 15 min expiry', async () => {
    const s3 = new S3StorageClient({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    });

    const key = rawSourceKey(videoId, 'mp4');
    const presigned = await s3.createPresignedPutUrl({
      bucket: 'raw',
      key,
      contentType: 'video/mp4',
      contentLength: 1048576, // 1 MB
      expiresInSeconds: 900,
    });

    expect(presigned.url).toContain('http://localhost:9000/raw/');
    expect(presigned.url).toContain('X-Amz-Signature');
    expect(presigned.url).toContain('X-Amz-Expires=900');
    expect(presigned.headers['content-type']).toBe('video/mp4');
    expect(presigned.headers['content-length']).toBe('1048576');

    // Expiry check: <= 15 min from now
    const now = Date.now();
    const diffMs = presigned.expiresAt.getTime() - now;
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
  });

  it('sanitizes presigned URLs for safe logging without leaking signatures/credentials', () => {
    const sensitiveUrl =
      'http://localhost:9000/raw/018f/source.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin&X-Amz-Signature=abcd1234secret';
    const cleanUrl = sanitizeStorageUrl(sensitiveUrl);
    expect(cleanUrl).toBe('http://localhost:9000/raw/018f/source.mp4');
    expect(cleanUrl).not.toContain('X-Amz-Signature');
    expect(cleanUrl).not.toContain('abcd1234secret');
  });

  it('AC 17: calculatePartSize clamps ceil(size/1000) between 8 MiB and 64 MiB', () => {
    // 1. Minimum bound: 8 MiB (8388608 bytes)
    expect(MULTIPART_MIN_PART_SIZE).toBe(8 * 1024 * 1024);
    expect(MULTIPART_MAX_PART_SIZE).toBe(64 * 1024 * 1024);

    // Small file (e.g. 150 MB) -> 150_000_000 / 1000 = 150_000 < 8 MiB -> clamps to 8 MiB
    expect(calculatePartSize(150 * 1024 * 1024)).toBe(8 * 1024 * 1024);

    // 4 GB file (4294967296 bytes) -> 4294967 < 8 MiB -> clamps to 8 MiB
    const fourGb = 4 * 1024 * 1024 * 1024;
    const partSize4Gb = calculatePartSize(fourGb);
    expect(partSize4Gb).toBe(8 * 1024 * 1024);
    const totalParts4Gb = calculateTotalParts(fourGb, partSize4Gb);
    expect(totalParts4Gb).toBe(512); // exactly 512 parts <= 10 000 parts

    // 20 GB file (21474836480 bytes) -> 21474837 bytes (~20.48 MiB, between 8 and 64 MiB)
    const twentyGb = 20 * 1024 * 1024 * 1024;
    const partSize20Gb = calculatePartSize(twentyGb);
    expect(partSize20Gb).toBe(Math.ceil(twentyGb / 1000));
    expect(partSize20Gb).toBeGreaterThanOrEqual(8 * 1024 * 1024);
    expect(partSize20Gb).toBeLessThanOrEqual(64 * 1024 * 1024);

    // 100 GB file -> clamps to 64 MiB
    const hundredGb = 100 * 1024 * 1024 * 1024;
    expect(calculatePartSize(hundredGb)).toBe(64 * 1024 * 1024);
  });
});
