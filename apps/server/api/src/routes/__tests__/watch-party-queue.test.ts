import type { WatchPartyPermission } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  videoId,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const QUEUE = `/v1/watch-parties/${ROOM_ID}/queue`;
const ABSENT = '018f0000-0000-7000-8000-00000000ffff';

describe('watch party queue routes', () => {
  let ctx: RoomApp;
  let owner: Account;
  let member: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner, member } = ctx);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const add = async (who: Account | null, n: number) =>
    ctx.call(who, 'POST', QUEUE, { videoId: videoId(n) });
  const queue = async () => (await ctx.call(owner, 'GET', QUEUE)).json();
  const itemIds = async () => (await queue()).items.map((item: { id: string }) => item.id);
  const seedVideos = async (count: number) => {
    for (let n = 1; n <= count; n += 1) await ctx.video(n);
  };

  it('reads the queue with each video, for a member', async () => {
    await seedVideos(2);
    await add(owner, 1);
    await add(owner, 2);

    const res = await ctx.call(member, 'GET', QUEUE);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      version: 2,
      items: [
        { video: { id: videoId(1), title: 'Video 1' }, addedBy: owner.key, startMs: 0 },
        { video: { id: videoId(2), title: 'Video 2' }, addedBy: owner.key, playedAt: null },
      ],
    });
  });

  it.each([
    { who: 'a stranger', method: 'GET' as const, url: QUEUE },
    { who: 'an anonymous caller', method: 'GET' as const, url: QUEUE },
    { who: 'a stranger', method: 'POST' as const, url: QUEUE, payload: { videoId: videoId(1) } },
    {
      who: 'a stranger',
      method: 'PATCH' as const,
      url: `${QUEUE}/${ABSENT}`,
      payload: { toIndex: 0 },
    },
    { who: 'a stranger', method: 'DELETE' as const, url: `${QUEUE}/${ABSENT}` },
  ])('answers $method as $who with a missing room', async ({ who, method, url, payload }) => {
    const caller = who === 'a stranger' ? await ctx.account(3) : null;

    const res = await ctx.call(caller, method, url, payload);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it('appends a video at its start and tells the room', async () => {
    await seedVideos(1);

    const res = await ctx.call(owner, 'POST', QUEUE, { videoId: videoId(1), startMs: 9000 });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      items: [{ startMs: 9000, addedBy: owner.key }],
      version: 1,
    });
    const frames = ctx.cache.publishedMessages.map(({ message }) => JSON.parse(message).frame);
    expect(frames).toEqual([expect.objectContaining({ type: 'queue', version: 1 })]);
  });

  it('refuses a malformed body', async () => {
    const res = await ctx.call(owner, 'POST', QUEUE, { startMs: 5 });

    expect(res.statusCode).toBe(400);
  });

  it('refuses the 4th pending add of a member holding queue.add alone', async () => {
    await seedVideos(4);
    await ctx.memberMayOnly('queue.add');

    const statuses = [];
    for (const n of [1, 2, 3, 4]) statuses.push((await add(member, n)).statusCode);
    const refused = await add(member, 4);

    expect(statuses).toEqual([201, 201, 201, 403]);
    expect(refused.json()).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    });
    expect(await itemIds()).toHaveLength(3);
  });

  it('lets a member who can also reorder pass the pending cap', async () => {
    await seedVideos(5);
    await ctx.memberMayOnly('queue.add', 'queue.reorder');

    const statuses = await Promise.all([1, 2, 3, 4, 5].map((n) => add(member, n)));

    expect(statuses.map((res) => res.statusCode)).toEqual([201, 201, 201, 201, 201]);
  });

  it.each([
    { held: ['queue.add'], removing: 'their own', status: 204 },
    { held: ['queue.add'], removing: "someone else's", status: 403 },
    { held: ['queue.add', 'queue.remove'], removing: "someone else's", status: 204 },
    { held: ['queue.remove'], removing: 'their own', status: 204 },
    { held: ['queue.vote'], removing: 'their own', status: 403 },
  ] as { held: WatchPartyPermission[]; removing: string; status: number }[])(
    'answers $status to a member holding $held removing $removing pending item',
    async ({ held, removing, status }) => {
      await seedVideos(2);
      await ctx.memberMayOnly('queue.add', 'queue.remove');
      await add(member, 1);
      await add(owner, 2);
      const [own, other] = await itemIds();
      await ctx.memberMayOnly(...held);

      const res = await ctx.call(
        member,
        'DELETE',
        `${QUEUE}/${removing === 'their own' ? own : other}`
      );

      expect(res.statusCode).toBe(status);
      expect(await itemIds()).toHaveLength(status === 204 ? 1 : 2);
      if (status === 403) expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_PERMISSION_MISSING);
    }
  );

  describe('moving an item', () => {
    const move = (who: Account, itemId: string, toIndex: number) =>
      ctx.call(who, 'PATCH', `${QUEUE}/${itemId}`, { toIndex });

    it('puts it at the index and answers the queue', async () => {
      await seedVideos(3);
      for (const n of [1, 2, 3]) await add(owner, n);
      const [first, second, third] = await itemIds();

      const res = await move(owner, third, 0);

      expect(res.statusCode).toBe(200);
      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([
        third,
        first,
        second,
      ]);
      expect(res.json().version).toBe(4);
    });

    it.each([
      { scenario: 'an item that is not in the queue', who: 'owner', status: 404 },
      { scenario: 'a member without queue.reorder', who: 'member', status: 403 },
    ])('refuses $scenario', async ({ who, status }) => {
      await seedVideos(1);
      await add(owner, 1);
      await ctx.memberMayOnly('queue.add');
      const [itemId] = await itemIds();

      const res = await move(
        who === 'owner' ? owner : member,
        who === 'owner' ? ABSENT : itemId,
        0
      );

      expect(res.statusCode).toBe(status);
    });
  });

  it('refuses every change to a room that has closed', async () => {
    await seedVideos(1);
    await ctx.closeRoom();

    const res = await add(owner, 1);

    expect(res.statusCode).toBe(404);
  });
});
