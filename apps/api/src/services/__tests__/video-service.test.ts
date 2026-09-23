import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { VideoService } from '../video-service';
import { videoServiceDeps } from './service-deps';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000c1';
const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c2', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000c3', role: 'USER' };
const ADMIN: UserContext = { id: '00000000-0000-7000-8000-0000000000c4', role: 'ADMIN' };

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
    service = new VideoService(videoServiceDeps(repositories.videos));
  });

  describe('get', () => {
    it.each([
      { name: 'an absent video', setup: async () => {}, code: ErrorCodes.VIDEO_NOT_FOUND },
      {
        name: 'a private video a stranger may not see',
        setup: () => seed('private'),
        code: ErrorCodes.FORBIDDEN,
      },
    ])('keeps $name distinct, leaving the rendering to the route', async ({ setup, code }) => {
      await setup();

      expect(expectErr(await service.get(STRANGER, VIDEO_ID)).code).toBe(code);
    });

    it('exposes the thumbnail assets a packaged video carries', async () => {
      await seed('public', {
        posterKey: `videos/${VIDEO_ID}/thumbs/poster.jpg`,
        spriteKey: `videos/${VIDEO_ID}/thumbs/sprite.jpg`,
      });

      expect(expectOk(await service.get(null, VIDEO_ID))).toMatchObject({
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
