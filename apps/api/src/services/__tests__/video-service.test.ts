import { InMemoryRepositories } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { AuthUser } from '../../plugins/auth';
import { VideoService } from '../video-service';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000c1';
const OWNER: AuthUser = { id: '00000000-0000-7000-8000-0000000000c2', role: 'USER' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-0000000000c3', role: 'USER' };
const ADMIN: AuthUser = { id: '00000000-0000-7000-8000-0000000000c4', role: 'ADMIN' };

describe('apps/api/services: VideoService', () => {
  let repositories: InMemoryRepositories;
  let service: VideoService;

  const seed = (visibility: 'private' | 'public', extra: Record<string, string> = {}) =>
    repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Video fixture',
      visibility,
      status: 'READY',
      sourceKey: 'raw/fixture.mp4',
      ...extra,
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new VideoService({
      videos: repositories.videos,
      cdnBaseUrl: 'http://localhost:9000/public',
    });
  });

  describe('get', () => {
    it('hides a private video from a stranger behind VIDEO_NOT_FOUND', async () => {
      await seed('private');

      await expect(service.get(STRANGER, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.VIDEO_NOT_FOUND,
      });
    });

    it('exposes the thumbnail assets a packaged video carries', async () => {
      await seed('public', {
        posterKey: `videos/${VIDEO_ID}/thumbs/poster.jpg`,
        spriteKey: `videos/${VIDEO_ID}/thumbs/sprite.jpg`,
      });

      await expect(service.get(null, VIDEO_ID)).resolves.toMatchObject({
        posterUrl: `http://localhost:9000/public/videos/${VIDEO_ID}/thumbs/poster.jpg`,
        spriteUrl: `http://localhost:9000/public/videos/${VIDEO_ID}/thumbs/sprite.jpg`,
        spriteVttUrl: `http://localhost:9000/public/videos/${VIDEO_ID}/thumbs/sprite.vtt`,
      });
    });
  });

  describe('isRateLimitExempt', () => {
    it.each([
      ['ADMIN', ADMIN, true],
      ['USER', OWNER, false],
    ])('is %s -> %s', (_label, user, expected) => {
      expect(service.isRateLimitExempt(user)).toBe(expected);
    });
  });
});
