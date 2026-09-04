import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { describe, expect, it } from 'vitest';
import { UploadService } from '../upload-service.js';
import { VideoService } from '../video-service.js';

describe('Deep Domain Services (UploadService & VideoService)', () => {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);

  const uploadService = new UploadService({
    uploads: repositories.uploads,
    videos: repositories.videos,
    events: repositories.events,
    storage,
    multipart,
    rawBucket: 'raw',
  });

  const videoService = new VideoService({
    videos: repositories.videos,
    cdnBaseUrl: 'http://localhost:9000/public',
  });

  const testUser = {
    id: '00000000-0000-7000-8000-000000000001',
    email: 'creator@test.local',
    role: 'creator' as const,
  };

  it('UploadService: initiates single upload returning presigned PUT url and db records', async () => {
    const res = await uploadService.initiate(testUser, {
      filename: 'sample.mp4',
      sizeBytes: 5 * 1024 * 1024,
      contentType: 'video/mp4',
      title: 'Service Direct Test',
    });

    expect(res.strategy).toBe('single');
    expect(res.videoId).toBeDefined();
    expect(res.uploadId).toBeDefined();
    expect(res.singleUrl).toBeDefined();

    // Verify retrieval via VideoService directly
    const video = await videoService.get(testUser, res.videoId);
    expect(video.id).toBe(res.videoId);
    expect(video.title).toBe('Service Direct Test');
    expect(video.status).toBe('UPLOADING');
  });

  it('UploadService: enforces ownership on getResumeInfo and abort', async () => {
    const res = await uploadService.initiate(testUser, {
      filename: 'sample2.mp4',
      sizeBytes: 5 * 1024 * 1024,
      contentType: 'video/mp4',
    });

    const otherUser = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'other@test.local',
      role: 'creator' as const,
    };

    // Non-owner cannot inspect
    await expect(uploadService.getResumeInfo(otherUser, res.uploadId)).rejects.toThrow(
      'Not authorized'
    );

    // Non-owner cannot abort
    await expect(uploadService.abort(otherUser, res.uploadId)).rejects.toThrow('Not authorized');

    // Owner can abort
    await uploadService.abort(testUser, res.uploadId);

    const video = await videoService.get(testUser, res.videoId);
    expect(video.status).toBe('ABANDONED');
  });

  it('VideoService: non-owner accessing private video throws VIDEO_NOT_FOUND (no leakage)', async () => {
    const res = await uploadService.initiate(testUser, {
      filename: 'private.mp4',
      sizeBytes: 1024,
      contentType: 'video/mp4',
      visibility: 'private',
    });

    const otherUser = {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'other@test.local',
      role: 'creator' as const,
    };

    try {
      await videoService.get(otherUser, res.videoId);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    }
  });

  it('VideoService: exposes posterUrl, spriteUrl, and spriteVttUrl when thumbnails are present', async () => {
    const videoId = '00000000-0000-7000-8000-000000000099';
    await repositories.videos.create({
      id: videoId,
      ownerId: testUser.id,
      title: 'Thumbnail Test',
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${videoId}/source.mp4`,
      posterKey: `videos/${videoId}/thumbs/poster.jpg`,
      spriteKey: `videos/${videoId}/thumbs/sprite.jpg`,
    });

    const details = await videoService.get(null, videoId);
    expect(details.posterUrl).toBe(
      'http://localhost:9000/public/videos/00000000-0000-7000-8000-000000000099/thumbs/poster.jpg'
    );
    expect(details.spriteUrl).toBe(
      'http://localhost:9000/public/videos/00000000-0000-7000-8000-000000000099/thumbs/sprite.jpg'
    );
    expect(details.spriteVttUrl).toBe(
      'http://localhost:9000/public/videos/00000000-0000-7000-8000-000000000099/thumbs/sprite.vtt'
    );
  });

  it('VideoService.softDelete: marks video DELETED, sets deletedAt, and enforces permissions', async () => {
    const videoId = '00000000-0000-7000-8000-000000000100';
    await repositories.videos.create({
      id: videoId,
      ownerId: testUser.id,
      title: 'Delete Test',
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${videoId}/source.mp4`,
    });

    const otherUser = {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'other@test.local',
      role: 'creator' as const,
    };

    // Non-owner cannot delete
    await expect(videoService.softDelete(otherUser, videoId)).rejects.toThrow(
      'Only the video owner or an admin may delete this video'
    );

    // Owner can soft-delete
    const res = await videoService.softDelete(testUser, videoId);
    expect(res).toEqual({ videoId, status: 'DELETED' });

    const updated = await repositories.videos.findById(videoId);
    expect(updated?.status).toBe('DELETED');
    expect(updated?.deletedAt).toBeDefined();

    // Idempotent second call
    const res2 = await videoService.softDelete(testUser, videoId);
    expect(res2).toEqual({ videoId, status: 'DELETED' });
  });
});
