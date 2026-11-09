import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import {
  builtInRoles,
  lobbyPlayback,
  memberKeyOf,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
} from '@vp/domain';
import type { NotifyPartyInviteJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createNotifyPartyInviteProcessor } from '../notify-party-invite';
import {
  CREATOR_ID,
  logger,
  notificationsOf,
  saveSwitches,
  seedCreator,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const ROOM = '00000000-0000-7000-8000-00000000e001';
const INVITE = '00000000-0000-7000-8000-00000000e101';
const VIDEO = videoId(1);
const FAN = userId(42);
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const AT = new Date(NOW);

describe('apps/server/worker/stages: notify-party-invite', () => {
  let repositories: InMemoryRepositories;

  const setUp = async (options: { visibility?: 'public' | 'private' } = {}) => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO, { visibility: options.visibility });
    expectOk(await repositories.users.upsert({ id: FAN, email: 'fan@example.com' }));
    expectOk(
      await repositories.watchPartyRooms.create({
        room: {
          ...QUICK_PARTY_SETTINGS,
          id: ROOM,
          name: 'Movie night',
          ownerKey: memberKeyOf({ kind: 'user', userId: CREATOR_ID }),
          asChannelId: null,
          passwordHash: null,
          playback: lobbyPlayback(null),
          permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
          createdAt: AT,
        },
        roles: builtInRoles('friends').map((role) => ({ ...role, id: uuidv7() })),
        owner: {
          roomId: ROOM,
          memberKey: memberKeyOf({ kind: 'user', userId: CREATOR_ID }),
          kind: 'user',
          userId: CREATOR_ID,
          discordUserId: null,
          displayName: null,
          avatarUrl: null,
          ipHash: null,
          joinedVia: 'owner',
          joinedAt: AT,
        },
        queue: [
          {
            id: uuidv7(),
            roomId: ROOM,
            videoId: VIDEO,
            addedBy: memberKeyOf({ kind: 'user', userId: CREATOR_ID }),
            startMs: 0,
            createdAt: AT,
          },
        ],
      })
    );
  };

  const invite = async (overrides: { expiresAt?: Date } = {}) =>
    expectOk(
      await repositories.watchPartyInvites.create(
        {
          id: INVITE,
          roomId: ROOM,
          inviterId: CREATOR_ID,
          inviteeId: FAN,
          status: 'pending',
          watching: { names: ['Ana', 'Tom'], count: 5 },
          expiresAt: overrides.expiresAt ?? new Date(NOW + 24 * 3_600_000),
          createdAt: AT,
        },
        { kind: 'notification', payload: { type: 'pubsub', channel: 'x', message: 'x' } }
      )
    );

  const notify = async () => {
    const job: QueueJob<NotifyPartyInviteJob> = {
      id: `${INVITE}--notify-party-invite`,
      name: 'notify-party-invite',
      data: { inviteId: INVITE },
    };
    return expectOk(
      await createNotifyPartyInviteProcessor({ repositories, logger, now: () => NOW })(job)
    );
  };

  it('tells the invitee, with the room, the inviter and who was watching', async () => {
    await setUp();
    await invite();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: true });

    expect(await notificationsOf(repositories, FAN)).toMatchObject([
      {
        kind: 'party_invite',
        watchPartyId: ROOM,
        groupKey: `party_invite:${ROOM}`,
        payload: {
          actor: { handle: 'night-kitchen' },
          party: {
            roomId: ROOM,
            name: 'Movie night',
            videoTitle: expect.any(String),
            scheduledFor: null,
            inviteId: INVITE,
            watching: { names: ['Ana', 'Tom'], count: 5 },
          },
        },
      },
    ]);
  });

  it('names no video the invitee may not see', async () => {
    await setUp({ visibility: 'private' });
    await invite();

    await notify();

    const [row] = await notificationsOf(repositories, FAN);
    expect(row?.payload.party?.videoTitle).toBeNull();
  });

  it('says nothing twice for one invite', async () => {
    await setUp();
    await invite();
    await notify();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: false });
    expect(await notificationsOf(repositories, FAN)).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'the invite was revoked',
      change: async () => {
        expectOk(await repositories.watchPartyInvites.revoke(ROOM, INVITE));
      },
    },
    {
      scenario: 'the invitee declined',
      change: async () => {
        expectOk(await repositories.watchPartyInvites.decline(FAN, INVITE));
      },
    },
    {
      scenario: 'the room closed',
      change: async () => {
        expectOk(await repositories.watchPartyRooms.close(ROOM, 'owner', null, AT));
      },
    },
    {
      scenario: 'the invitee switched party notifications off',
      change: () => saveSwitches(repositories, FAN, { watchParties: false }),
    },
  ])('records nothing when $scenario before the job ran', async ({ change }) => {
    await setUp();
    await invite();
    await change();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: false });
    expect(await notificationsOf(repositories, FAN)).toEqual([]);
  });

  it('records nothing for an invite that has expired', async () => {
    await setUp();
    await invite({ expiresAt: new Date(NOW - 1) });

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: false });
  });

  it('records nothing for an invite that is not there', async () => {
    await setUp();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: false });
  });
});
