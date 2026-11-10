import { WATCH_PARTY_PERMISSIONS_VERSION } from '@vp/domain';
import { MS_PER_HOUR } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { createRoom } from '../watch-party-create';
import { OWNER_KEY, setUpCreate } from './watch-party-create-fixture';
import {
  ANONYMOUS,
  MEMBER,
  OTHER,
  OWNER,
  partyBody,
  VIDEO_A,
  VIDEO_B,
  VIDEO_PRIVATE,
  VIDEO_UNLISTED,
} from './watch-party-test-deps';

describe('apps/server/api/services: createRoom', () => {
  it.each([
    {
      scenario: 'a quick party with no source',
      body: partyBody(),
      expected: {
        name: "Olivia Owner's watch party",
        visibility: 'unlisted',
        allowGuests: true,
        chatEnabled: true,
        capacity: null,
        effectiveCapacity: 200,
        hasPassword: false,
        phase: 'lobby',
        currentVideo: null,
        queueLength: 0,
        status: 'open',
        version: 1,
        asChannelId: null,
      },
    },
    {
      scenario: 'a private room, which keeps guests out by default',
      body: partyBody({ visibility: 'private' }),
      expected: { visibility: 'private', allowGuests: false },
    },
    {
      scenario: 'a private room that lets guests in on request',
      body: partyBody({ visibility: 'private', allowGuests: true }),
      expected: { allowGuests: true },
    },
    {
      scenario: 'settings sent by the owner',
      body: partyBody({
        name: '  Friday   film ',
        capacity: 10,
        slowModeSeconds: 10,
        bufferPolicy: 'continue',
        idleClose: 'never',
        accent: '#336699',
        language: 'pl',
        autoplay: false,
        skipVotePercent: 70,
      }),
      expected: {
        name: 'Friday film',
        capacity: 10,
        effectiveCapacity: 10,
        slowModeSeconds: 10,
        bufferPolicy: 'continue',
        idleClose: 'never',
        accent: '#336699',
        language: 'pl',
        autoplay: false,
        skipVotePercent: 70,
      },
    },
    {
      scenario: 'a source video, which names the room and starts the lobby at its offset',
      body: partyBody({ source: { videoId: VIDEO_A, startMs: 42_000 } }),
      expected: {
        name: 'First',
        queueLength: 1,
        currentVideo: { id: VIDEO_A, title: 'First' },
      },
    },
    {
      scenario: 'an unlisted video in an unlisted room',
      body: partyBody({ source: { videoId: VIDEO_UNLISTED } }),
      expected: { currentVideo: { id: VIDEO_UNLISTED } },
    },
  ])('creates $scenario', async ({ body, expected }) => {
    const { create } = await setUpCreate();

    expect(expectOk(await create(body))).toMatchObject(expected);
  });

  it('writes the eleven roles, the owner seat, the queue and the lobby clock in one go', async () => {
    const { create, repositories, deps } = await setUpCreate();
    const view = expectOk(
      await create(partyBody({ source: { videoId: VIDEO_B, startMs: 5_000 } }))
    );

    const room = expectOk(await repositories.watchPartyRooms.findById(view.id));
    const roles = expectOk(await repositories.watchPartyRoles.list(view.id, deps.now()));
    const seat = expectOk(await repositories.watchPartyMembers.find(view.id, OWNER_KEY));
    const queue = expectOk(await repositories.watchPartyQueue.list(view.id));
    expect(room).toMatchObject({
      ownerKey: OWNER_KEY,
      permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
      currentVideoId: VIDEO_B,
      playback: { phase: 'lobby', positionMs: 5_000, itemId: queue.items[0]?.id },
    });
    expect(roles).toHaveLength(11);
    expect(seat).toMatchObject({ joinedVia: 'owner', kind: 'user', leftAt: null });
    expect(queue.items.map(({ videoId }) => videoId)).toEqual([VIDEO_B]);
  });

  it.each([
    { preset: 'friends' as const, playback: true },
    { preset: 'public' as const, playback: false },
  ])(
    'gives Member the $preset preset: playback control $playback',
    async ({ preset, playback }) => {
      const { create, repositories, deps } = await setUpCreate();
      const view = expectOk(await create(partyBody({ preset })));

      const roles = expectOk(await repositories.watchPartyRoles.list(view.id, deps.now()));
      const member = roles.find(({ key }) => key === 'member');
      expect(member?.permissions.includes('playback.control')).toBe(playback);
    }
  );

  it('stores a password only as an scrypt hash', async () => {
    const { create, repositories } = await setUpCreate();
    const view = expectOk(await create(partyBody({ password: 'let me in' })));

    const room = expectOk(await repositories.watchPartyRooms.findById(view.id));
    expect(view.hasPassword).toBe(true);
    expect(room?.passwordHash).toMatch(/^scrypt\$/);
  });

  it('logs the new room with its owner', async () => {
    const { create, log } = await setUpCreate();
    const view = expectOk(await create());

    expect(log.lines()).toContainEqual(
      expect.objectContaining({ level: 'info', roomId: view.id, ownerKey: OWNER_KEY })
    );
  });

  it('hosts as the channel of an owner with a public ready video', async () => {
    const { create, repositories } = await setUpCreate();
    const channel = expectOk(await repositories.channels.findByUserId(OWNER.id));

    expect(expectOk(await create(partyBody({ hostAs: 'channel' }))).asChannelId).toBe(channel?.id);
  });

  it.each([
    { scenario: 'a signed-out caller', as: null, body: partyBody(), code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a capacity over the ceiling',
      body: partyBody({ capacity: 201 }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a capacity of one',
      body: partyBody({ capacity: 1 }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a name that is a link',
      body: partyBody({ name: 'visit https://example.com' }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a password under four characters',
      body: partyBody({ password: 'abc' }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a schedule in the past',
      body: partyBody({ scheduledFor: '2026-02-01T12:00:00.000Z' }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'hosting as a channel without a public video',
      as: OTHER,
      body: partyBody({ hostAs: 'channel' }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a private video',
      body: partyBody({ source: { videoId: VIDEO_PRIVATE } }),
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    },
    {
      scenario: 'an unlisted video in a public room',
      body: partyBody({ visibility: 'public', source: { videoId: VIDEO_UNLISTED } }),
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    },
    {
      scenario: 'a list of videos none of which the room may play',
      body: partyBody({ source: { videoIds: [VIDEO_PRIVATE] } }),
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    },
    {
      scenario: 'a list started past its end',
      body: partyBody({ source: { videoIds: [VIDEO_A], startIndex: 1 } }),
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    },
  ])('refuses $scenario with $code', async ({ body, code, as = OWNER }) => {
    const { create, deps } = await setUpCreate();

    const result = as === null ? await createRoom(deps, ANONYMOUS, body) : await create(body, as);

    expect(expectErr(result).code).toBe(code);
  });

  it('refuses the fourth open room and counts only open ones', async () => {
    const { create, repositories } = await setUpCreate();
    const first = expectOk(await create());
    await create();
    await create();

    expect(expectErr(await create())).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_LIMIT_REACHED,
      limit: 3,
    });
    expectOk(await repositories.watchPartyRooms.close(first.id, 'owner', null, new Date()));
    expectOk(await create());
  });

  it('refuses the eleventh create in an hour with the wait, and lets the next hour in', async () => {
    const { create, clock } = await setUpCreate({
      config: { watchParties: { maxOpenPerUser: 20 } },
    });
    for (let created = 0; created < 10; created += 1) expectOk(await create());

    expect(expectErr(await create())).toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      retryAfterSeconds: 3_600,
    });
    expectOk(await create(partyBody(), MEMBER));

    clock.advance(MS_PER_HOUR);
    expectOk(await create());
  });
});
