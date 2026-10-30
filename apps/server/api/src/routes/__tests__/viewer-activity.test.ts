import { ErrorCodes } from '@vp/errors';
import {
  buildLibraryApp,
  type LibraryApp,
  OWNER,
  PRIVATE_VIDEO,
  VIDEOS,
} from '../../__tests__/library-app';

const [V0, V1, V2] = VIDEOS;
const COMMENT = (n: number) => `00000000-0000-7000-8000-00000000c0${String(n).padStart(2, '0')}`;
const STRANGER = '22222222-2222-7222-8222-222222222222';

describe('viewer activity routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const get = async (who: 'owner' | 'stranger', url: string) =>
    (await ctx.call(who, 'GET', url)).json();

  it.each([{ url: '/v1/me/liked-videos' }, { url: '/v1/me/comments' }])(
    'refuses an anonymous GET $url with 401',
    async ({ url }) => {
      expect((await ctx.call('anonymous', 'GET', url)).statusCode).toBe(401);
    }
  );

  describe('GET /v1/me/liked-videos', () => {
    it('lists the caller likes newest first without a video that turned private, a page at a time', async () => {
      for (const id of [V0, V1, V2, PRIVATE_VIDEO]) {
        await ctx.repositories.videoReactions.setReaction(id, OWNER, 'LIKE');
      }
      await ctx.repositories.videoReactions.setReaction(V0, STRANGER, 'LIKE');
      await ctx.repositories.watchHistory.record({
        id: '00000000-0000-7000-8000-0000000007a0',
        userId: OWNER,
        videoId: V2,
        progressSeconds: 30,
        durationSeconds: 600,
        watchedAt: new Date('2026-03-01T12:00:00.000Z'),
      });

      const first = await get('owner', '/v1/me/liked-videos?limit=2');
      const rest = await get('owner', `/v1/me/liked-videos?limit=2&cursor=${first.nextCursor}`);

      expect(first.items.map((item: { id: string }) => item.id)).toEqual([V2, V1]);
      expect(first.items[0]).toMatchObject({
        title: 'Clip 2',
        channel: { handle: 'creator' },
        viewer: { progressSeconds: 30 },
      });
      expect(rest.items.map((item: { id: string }) => item.id)).toEqual([V0]);
      expect(rest.nextCursor).toBeNull();
    });

    it('keeps each viewer likes their own', async () => {
      await ctx.repositories.videoReactions.setReaction(V0, OWNER, 'LIKE');

      expect((await get('stranger', '/v1/me/liked-videos')).items).toEqual([]);
    });

    it('refuses a cursor that is not one with 400', async () => {
      const res = await ctx.call('owner', 'GET', '/v1/me/liked-videos?cursor=nope');

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
    });
  });

  describe('GET /v1/me/comments', () => {
    const comment = (
      id: string,
      authorId: string,
      videoId: string,
      parentId: string | null = null
    ) =>
      ctx.repositories.comments.create({
        id,
        videoId,
        authorId,
        parentId,
        content: `says ${id.slice(-2)}`,
      });

    it('lists the caller comments and replies newest first, a page at a time', async () => {
      await comment(COMMENT(1), OWNER, V0);
      await comment(COMMENT(2), OWNER, V0, COMMENT(1));
      await comment(COMMENT(3), OWNER, PRIVATE_VIDEO);
      await comment(COMMENT(4), STRANGER, V0);

      const first = await get('owner', '/v1/me/comments?limit=1');
      const rest = await get('owner', `/v1/me/comments?limit=1&cursor=${first.nextCursor}`);

      expect(first.items).toMatchObject([
        { id: COMMENT(2), parentId: COMMENT(1), likeCount: 0, video: { id: V0, title: 'Clip 0' } },
      ]);
      expect(rest.items.map((item: { id: string }) => item.id)).toEqual([COMMENT(1)]);
      expect(rest.nextCursor).toBeNull();
    });

    it('lists nothing of another user', async () => {
      await comment(COMMENT(1), OWNER, V0);

      expect((await get('stranger', '/v1/me/comments')).items).toEqual([]);
    });
  });
});
