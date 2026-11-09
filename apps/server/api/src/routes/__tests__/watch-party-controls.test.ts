import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const CONTROLS = '/v1/me/watch-party-controls';
const OTHER_ROOM = '018f0000-0000-7000-8000-00000000a002';

describe('watch party personal control routes', () => {
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

  const put = (who: Account | null, payload: Record<string, unknown>) =>
    ctx.call(who, 'PUT', CONTROLS, payload);
  const targets = async (query = '') =>
    (await ctx.call(member, 'GET', `${CONTROLS}${query}`))
      .json()
      .items.map(({ roomId, targetKey }: { roomId: string | null; targetKey: string }) => [
        targetKey,
        roomId,
      ]);
  const events = async () =>
    expectOk(await ctx.repositories.userEvents.listFrom(member.user.id, 1, 50)).filter(
      ({ type }) => type === 'party.controls.updated'
    );

  it('answers the viewer’s controls after setting one, with the values it chose', async () => {
    const res = await put(member, {
      targetKey: owner.key,
      roomId: ROOM_ID,
      hideMessages: true,
      volume: 40,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: [
        {
          targetKey: owner.key,
          roomId: ROOM_ID,
          voiceMuted: false,
          volume: 40,
          hideMessages: true,
          hideReactions: false,
          hideAvatar: false,
          hideRequests: false,
          blockInvites: false,
          favourite: false,
        },
      ],
    });
  });

  it.each([
    { scope: 'a room', query: `?roomId=${ROOM_ID}`, shown: true },
    { scope: 'no room', query: '', shown: false },
    { scope: 'another room', query: `?roomId=${OTHER_ROOM}`, shown: false },
  ])(
    'returns a room-scoped control only for its room, asking with $scope',
    async ({ query, shown }) => {
      await put(member, { targetKey: owner.key, roomId: ROOM_ID, favourite: true });

      expect((await targets(query)).length).toBe(shown ? 1 : 0);
    }
  );

  it.each([{ query: '' }, { query: `?roomId=${ROOM_ID}` }, { query: `?roomId=${OTHER_ROOM}` }])(
    'returns an everywhere control for every room, asking with "$query"',
    async ({ query }) => {
      await put(member, { targetKey: owner.key, roomId: null, favourite: true });

      expect(await targets(query)).toEqual([[owner.key, null]]);
    }
  );

  it('keeps what an earlier put chose for the flags a later one leaves out', async () => {
    await put(member, { targetKey: owner.key, roomId: null, volume: 50 });

    const res = await put(member, { targetKey: owner.key, roomId: null, favourite: true });

    expect(res.json().items).toEqual([expect.objectContaining({ volume: 50, favourite: true })]);
  });

  it('deletes the row of a control that chooses nothing', async () => {
    await put(member, { targetKey: owner.key, roomId: null, favourite: true });

    const res = await put(member, { targetKey: owner.key, roomId: null, favourite: false });

    expect(res.json()).toEqual({ items: [] });
    expect(await targets()).toEqual([]);
  });

  it('appends one party.controls.updated event of its owner for each put, deletes too', async () => {
    await put(member, { targetKey: owner.key, roomId: ROOM_ID, favourite: true });
    await put(member, { targetKey: owner.key, roomId: ROOM_ID, favourite: false });
    await put(owner, { targetKey: member.key, roomId: null, favourite: true });

    expect((await events()).map(({ payload }) => payload)).toEqual([
      { targetKey: owner.key, roomId: ROOM_ID },
      { targetKey: owner.key, roomId: ROOM_ID },
    ]);
  });

  it('refuses an invite from the member someone blocked, with no reason, and shows that member nothing', async () => {
    await put(member, { targetKey: owner.key, roomId: null, blockInvites: true });

    const invited = await ctx.call(owner, 'POST', `/v1/watch-parties/${ROOM_ID}/invites`, {
      userIds: [member.user.id, (await ctx.account(3)).user.id],
    });
    const seenByTarget = await ctx.call(owner, 'GET', CONTROLS);

    expect(invited.json().refused).toEqual([{ userId: member.user.id }]);
    expect(seenByTarget.json()).toEqual({ items: [] });
  });

  it.each([
    {
      scenario: 'a room-scoped block of invites',
      body: { roomId: ROOM_ID, blockInvites: true },
      status: 400,
    },
    { scenario: 'a volume over 200', body: { roomId: null, volume: 201 }, status: 400 },
    { scenario: 'a volume that is not whole', body: { roomId: null, volume: 12.5 }, status: 400 },
    {
      scenario: 'a target that is no member key',
      body: { targetKey: 'user:abc', roomId: null },
      status: 422,
    },
    {
      scenario: 'a guest controlled everywhere',
      body: { targetKey: 'guest:abcdefghijklmnop', roomId: null },
      status: 422,
    },
    {
      scenario: 'a room that does not exist',
      body: { roomId: OTHER_ROOM, favourite: true },
      status: 422,
    },
  ])('refuses $scenario with $status', async ({ body, status }) => {
    const res = await put(member, { targetKey: owner.key, ...body });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(await events()).toEqual([]);
  });

  it.each([{ method: 'GET' as const }, { method: 'PUT' as const }])(
    'answers $method from nobody signed in with 401',
    async ({ method }) => {
      const res = await ctx.call(
        null,
        method,
        CONTROLS,
        method === 'PUT' ? { targetKey: owner.key, roomId: null } : undefined
      );

      expect(res.statusCode).toBe(401);
    }
  );
});
