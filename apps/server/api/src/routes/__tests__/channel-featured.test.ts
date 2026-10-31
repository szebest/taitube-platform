import { ErrorCodes } from '@vp/errors';
import {
  buildLibraryApp,
  type LibraryApp,
  OWNER,
  PRIVATE_VIDEO,
  VIDEOS,
} from '../../__tests__/library-app';
import { seedVideo } from '../../__tests__/test-app';

const mine = (n: number) => `55555555-5555-7555-8555-55555555550${n}`;
const MINE_PRIVATE = '55555555-5555-7555-8555-555555555599';
const MINE_PROCESSING = '55555555-5555-7555-8555-555555555598';
const ABSENT = '99999999-9999-7999-8999-999999999999';
const SEVEN = [1, 2, 3, 4, 5, 6, 7].map(mine);

describe('channel featured routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    await ctx.repositories.channels.create({
      userId: OWNER,
      handle: 'owner',
      displayName: 'Owner',
    });
    for (let n = 1; n <= 7; n++) {
      await seedVideo(ctx.repositories, { id: mine(n), ownerId: OWNER, viewsCount: n });
    }
    await seedVideo(ctx.repositories, { id: MINE_PRIVATE, ownerId: OWNER, visibility: 'private' });
    await seedVideo(ctx.repositories, {
      id: MINE_PROCESSING,
      ownerId: OWNER,
      status: 'PROCESSING',
    });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const put = (who: 'owner' | 'stranger' | 'anonymous', videoIds: unknown) =>
    ctx.call(who, 'PUT', '/v1/me/channel/featured', { videoIds } as Record<string, unknown>);
  const get = (idOrHandle = '@owner') =>
    ctx.call('anonymous', 'GET', `/v1/channels/${idOrHandle}/featured`);
  const ids = (res: { json(): { items: { id: string }[] } }) =>
    res.json().items.map((item) => item.id);

  describe('GET /v1/channels/:idOrHandle/featured', () => {
    it('shows the six most-viewed public uploads as popular when nothing is pinned', async () => {
      const res = await get();

      expect(res.statusCode).toBe(200);
      expect(res.json().source).toBe('popular');
      expect(ids(res)).toEqual([7, 6, 5, 4, 3, 2].map(mine));
    });

    it('shows the pins in order for a visitor who is not signed in', async () => {
      await put('owner', [mine(3), mine(1), mine(2)]);

      const res = await get();

      expect(res.json().source).toBe('pinned');
      expect(ids(res)).toEqual([mine(3), mine(1), mine(2)]);
      expect(res.json().items[0]).toMatchObject({ channel: { handle: 'owner' } });
    });

    it('drops a pinned video that turned private on the next read', async () => {
      await put('owner', [mine(1), mine(2)]);
      expect(
        (
          await ctx.call('owner', 'PATCH', `/v1/videos/${mine(1)}`, {
            visibility: 'private',
            version: 1,
          })
        ).statusCode
      ).toBe(200);

      expect(ids(await get())).toEqual([mine(2)]);
    });

    it('returns to the most watched when the list is cleared', async () => {
      await put('owner', [mine(1)]);

      await put('owner', []);

      expect((await get()).json().source).toBe('popular');
    });

    it('reads by channel id too', async () => {
      const channelId = (await ctx.call('anonymous', 'GET', '/v1/channels/@owner')).json().id;

      expect((await get(channelId)).statusCode).toBe(200);
    });

    it('answers 404 for an unknown channel', async () => {
      const res = await get('@nobody');

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('PUT /v1/me/channel/featured', () => {
    it('answers the shelf as it now reads', async () => {
      const res = await put('owner', [mine(2), mine(1)]);

      expect(res.statusCode).toBe(200);
      expect(res.json().source).toBe('pinned');
      expect(ids(res)).toEqual([mine(2), mine(1)]);
    });

    it.each([
      {
        scenario: 'a seventh video',
        who: 'owner' as const,
        videoIds: SEVEN,
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a video twice',
        who: 'owner' as const,
        videoIds: [mine(1), mine(1)],
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a private video',
        who: 'owner' as const,
        videoIds: [MINE_PRIVATE],
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a video still processing',
        who: 'owner' as const,
        videoIds: [MINE_PROCESSING],
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: "another creator's video",
        who: 'owner' as const,
        videoIds: [VIDEOS[0]],
        status: 403,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: "another creator's private video, which they cannot know of",
        who: 'owner' as const,
        videoIds: [PRIVATE_VIDEO],
        status: 404,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'an unknown video',
        who: 'owner' as const,
        videoIds: [ABSENT],
        status: 404,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'an id that is not a UUID',
        who: 'owner' as const,
        videoIds: ['nope'],
        status: 400,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'no sign-in',
        who: 'anonymous' as const,
        videoIds: [mine(1)],
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
      },
    ])(
      'refuses $scenario with $status $code and saves nothing',
      async ({ who, videoIds, status, code }) => {
        await put('owner', [mine(7)]);

        const res = await put(who, videoIds);

        expect(res.statusCode).toBe(status);
        expect(res.json().code).toBe(code);
        expect(ids(await get())).toEqual([mine(7)]);
      }
    );

    it("lets one creator's pins stay out of another's shelf", async () => {
      await put('owner', [mine(1)]);

      const res = await put('stranger', [mine(1)]);

      expect(res.statusCode).toBe(403);
      expect((await get('@owner')).json().source).toBe('pinned');
    });
  });
});
