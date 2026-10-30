import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { ViewerActivityService } from '../viewer-activity-service';
import { ViewerProgress } from '../viewer-progress';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'USER' };
const OWNER = '00000000-0000-7000-8000-00000000e0a1';
const VIDEOS = [
  '00000000-0000-7000-8000-00000000e0b1',
  '00000000-0000-7000-8000-00000000e0b2',
  '00000000-0000-7000-8000-00000000e0b3',
] as const;
const PRIVATE = '00000000-0000-7000-8000-00000000e0b4';

describe('apps/server/api/services: ViewerActivityService', () => {
  let repositories: InMemoryRepositories;
  let service: ViewerActivityService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new ViewerActivityService({
      reactions: repositories.videoReactions,
      comments: repositories.comments,
      viewerProgress: new ViewerProgress(repositories.watchHistory),
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
    });
    for (const id of VIDEOS)
      await seedVideo(repositories, { id, ownerId: OWNER, title: `Clip ${id.slice(-1)}` });
    await seedVideo(repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      title: 'Closed',
      visibility: 'private',
    });
  });

  describe('liked videos', () => {
    it('lists the likes newest first as video summaries with the caller playhead, a page at a time', async () => {
      for (const id of VIDEOS) await repositories.videoReactions.setReaction(id, VIEWER.id, 'LIKE');
      await repositories.videoReactions.setReaction(PRIVATE, VIEWER.id, 'LIKE');
      await repositories.watchHistory.record({
        id: '00000000-0000-7000-8000-00000000e0c1',
        userId: VIEWER.id,
        videoId: VIDEOS[2],
        progressSeconds: 30,
        durationSeconds: 60,
        watchedAt: new Date('2026-03-01T12:00:00.000Z'),
      });

      const first = expectOk(await service.likedVideos(VIEWER, { limit: 2 }));
      const rest = expectOk(
        await service.likedVideos(VIEWER, { limit: 2, cursor: first.nextCursor ?? '' })
      );

      expect(first.items.map((item) => item.id)).toEqual([VIDEOS[2], VIDEOS[1]]);
      expect(first.items[0]).toMatchObject({ viewer: { progressSeconds: 30 } });
      expect(first.items[1]).toMatchObject({ viewer: null });
      expect(rest.items.map((item) => item.id)).toEqual([VIDEOS[0]]);
      expect(rest.nextCursor).toBeNull();
    });

    it('refuses a cursor that is not one', async () => {
      expect(expectErr(await service.likedVideos(VIEWER, { cursor: 'nope' })).code).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });

  describe('my comments', () => {
    const comment = (id: string, videoId: string, parentId: string | null = null) =>
      repositories.comments.create({
        id,
        videoId,
        authorId: VIEWER.id,
        parentId,
        content: `says ${id.slice(-1)}`,
      });

    it('lists the caller comments and replies newest first with the video, a page at a time', async () => {
      const root = '00000000-0000-7000-8000-00000000e0d1';
      const reply = '00000000-0000-7000-8000-00000000e0d2';
      await comment(root, VIDEOS[0]);
      await comment(reply, VIDEOS[0], root);
      await comment('00000000-0000-7000-8000-00000000e0d3', PRIVATE);

      const first = expectOk(await service.comments(VIEWER, { limit: 1 }));
      const rest = expectOk(
        await service.comments(VIEWER, { limit: 1, cursor: first.nextCursor ?? '' })
      );

      expect(first.items).toEqual([
        {
          id: reply,
          content: 'says 2',
          createdAt: expect.any(String),
          parentId: root,
          likeCount: 0,
          video: { id: VIDEOS[0], title: 'Clip 1' },
        },
      ]);
      expect(rest.items.map((item) => item.id)).toEqual([root]);
      expect(rest.nextCursor).toBeNull();
    });

    it('refuses a cursor that is not one', async () => {
      expect(expectErr(await service.comments(VIEWER, { cursor: 'nope' })).code).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });
});
