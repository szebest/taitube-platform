import { ErrorCodes } from '@vp/errors';
import {
  buildLibraryApp,
  type LibraryApp,
  OWNER,
  PRIVATE_VIDEO,
  VIDEOS,
} from '../../__tests__/library-app';
import { seedVideo } from '../../__tests__/test-app';

const CLIPPABLE = '88888888-8888-7888-8888-888888888888';
const ABSENT = '99999999-9999-7999-8999-999999999999';
const RANGE = { startMs: 10_000, endMs: 30_000, title: 'The goal' };

describe('clip routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    await seedVideo(ctx.repositories, {
      id: CLIPPABLE,
      ownerId: OWNER,
      title: 'Match',
      durationMs: 120_000,
    });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const create = (who: 'owner' | 'stranger' | 'anonymous', body = RANGE, videoId = CLIPPABLE) =>
    ctx.call(who, 'POST', `/v1/videos/${videoId}/clips`, body);

  const made = async () => (await create('owner')).json().id as string;

  describe('POST /v1/videos/:id/clips', () => {
    it('creates a clip of a public video for a signed-in viewer', async () => {
      const res = await create('owner');

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        videoId: CLIPPABLE,
        userId: OWNER,
        startMs: 10_000,
        endMs: 30_000,
        title: 'The goal',
        video: { id: CLIPPABLE, title: 'Match' },
      });
    });

    it.each([
      {
        scenario: 'a guest',
        who: 'anonymous' as const,
        videoId: CLIPPABLE,
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
      },
      {
        scenario: 'a private video of someone else',
        who: 'stranger' as const,
        videoId: PRIVATE_VIDEO,
        status: 404,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'an unknown video',
        who: 'owner' as const,
        videoId: ABSENT,
        status: 404,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'a video that has no duration yet',
        who: 'owner' as const,
        videoId: VIDEOS[0],
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario with $status', async ({ who, videoId, status, code }) => {
      const res = await create(who, RANGE, videoId);

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });

    it.each([
      { scenario: 'under five seconds', body: { ...RANGE, endMs: 12_000 } },
      { scenario: 'over sixty seconds', body: { ...RANGE, endMs: 80_000 } },
      {
        scenario: 'past the end of the video',
        body: { ...RANGE, startMs: 110_000, endMs: 130_000 },
      },
    ])('refuses a range $scenario with 422', async ({ body }) => {
      const res = await create('owner', body);

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
    });

    it('refuses a body of the wrong shape with 400', async () => {
      expect((await create('owner', { ...RANGE, startMs: 'soon' } as never)).statusCode).toBe(400);
    });
  });

  describe('GET /v1/clips/:id', () => {
    it('serves the clip to a guest, with the video it plays from', async () => {
      const id = await made();

      const res = await ctx.call('anonymous', 'GET', `/v1/clips/${id}`);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id,
        startMs: 10_000,
        endMs: 30_000,
        video: { id: CLIPPABLE },
      });
    });

    it('answers 404 for an unknown clip and for one whose video turned private', async () => {
      const id = await made();
      const stored = await ctx.repositories.videos.findById(CLIPPABLE);
      if (stored.ok && stored.value) stored.value.visibility = 'private';

      const gone = await ctx.call('anonymous', 'GET', `/v1/clips/${id}`);
      const unknown = await ctx.call('anonymous', 'GET', `/v1/clips/${ABSENT}`);

      expect([gone.statusCode, unknown.statusCode]).toEqual([404, 404]);
      expect(gone.json().code).toBe(ErrorCodes.CLIP_NOT_FOUND);
    });
  });

  describe('GET /v1/me/clips', () => {
    it('refuses a guest with 401', async () => {
      expect((await ctx.call('anonymous', 'GET', '/v1/me/clips')).statusCode).toBe(401);
    });

    it('lists only the caller clips, a page at a time', async () => {
      const ids = [await made(), await made(), await made()];
      await create('stranger');

      const first = (await ctx.call('owner', 'GET', '/v1/me/clips?limit=2')).json();
      const rest = (
        await ctx.call('owner', 'GET', `/v1/me/clips?limit=2&cursor=${first.nextCursor}`)
      ).json();

      expect([...first.items, ...rest.items].map((item: { id: string }) => item.id).sort()).toEqual(
        [...ids].sort()
      );
      expect(first.items).toHaveLength(2);
      expect(rest.nextCursor).toBeNull();
      expect(first.items[0].video).toMatchObject({ id: CLIPPABLE, title: 'Match' });
    });
  });

  describe('DELETE /v1/clips/:id', () => {
    it.each([
      { who: 'anonymous' as const, status: 401 },
      { who: 'stranger' as const, status: 403 },
    ])('keeps the clip from $who with $status', async ({ who, status }) => {
      const id = await made();

      expect((await ctx.call(who, 'DELETE', `/v1/clips/${id}`)).statusCode).toBe(status);
      expect((await ctx.call('anonymous', 'GET', `/v1/clips/${id}`)).statusCode).toBe(200);
    });

    it('lets the creator delete it with 204, and answers 404 the second time', async () => {
      const id = await made();

      expect((await ctx.call('owner', 'DELETE', `/v1/clips/${id}`)).statusCode).toBe(204);
      expect((await ctx.call('owner', 'DELETE', `/v1/clips/${id}`)).statusCode).toBe(404);
      expect((await ctx.call('anonymous', 'GET', `/v1/clips/${id}`)).statusCode).toBe(404);
    });
  });
});
