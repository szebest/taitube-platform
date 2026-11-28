import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import {
  builtInRoles,
  lobbyPlayback,
  memberKeyOf,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
} from '@vp/domain';
import type { NotifyPartyReminderJob } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import { createNotifyPartyReminderProcessor } from '../notify-party-reminder';
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
const INVITEE = userId(43);
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const AT = new Date(NOW);
const SCHEDULED = new Date(NOW + 3_600_000);

describe('apps/server/worker/stages: notify-party-reminder', () => {
  let repositories: InMemoryRepositories;

  const setUp = async () => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO);
    for (const [id, email] of [
      [FAN, 'fan@example.com'],
      [INVITEE, 'invitee@example.com'],
    ] as const) {
      expectOk(await repositories.users.upsert({ id, email }));
    }
    const ownerKey = memberKeyOf({ kind: 'user', userId: CREATOR_ID });
    expectOk(
      await repositories.watchPartyRooms.create({
        room: {
          ...QUICK_PARTY_SETTINGS,
          id: ROOM,
          name: 'Movie night',
          ownerKey,
          asChannelId: null,
          passwordHash: null,
          playback: lobbyPlayback(null),
          permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
          scheduledFor: SCHEDULED,
          createdAt: AT,
        },
        roles: builtInRoles('friends').map((role) => ({ ...role, id: uuidv7() })),
        owner: {
          roomId: ROOM,
          memberKey: ownerKey,
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
            addedBy: ownerKey,
            startMs: 0,
            createdAt: AT,
          },
        ],
      })
    );
  };

  const interested = async (...ids: string[]) => {
    for (const id of ids) expectOk(await repositories.watchPartyInterest.add(ROOM, id, AT));
  };

  const invite = async (expiresAt = new Date(NOW + 24 * 3_600_000)) =>
    expectOk(
      await repositories.watchPartyInvites.create(
        {
          id: INVITE,
          roomId: ROOM,
          inviterId: CREATOR_ID,
          inviteeId: INVITEE,
          status: 'pending',
          watching: { names: [], count: 0 },
          expiresAt,
          createdAt: AT,
        },
        { kind: 'notification', payload: { type: 'pubsub', channel: 'x', message: 'x' } }
      )
    );

  const remind = async (
    scheduledFor = SCHEDULED,
    lead: NotifyPartyReminderJob['lead'] = 'before'
  ) => {
    const job: QueueJob<NotifyPartyReminderJob> = {
      id: `${ROOM}--notify-party-reminder--${scheduledFor.getTime()}--${lead}`,
      name: 'notify-party-reminder',
      data: { roomId: ROOM, scheduledFor: scheduledFor.toISOString(), lead },
    };
    return expectOk(
      await createNotifyPartyReminderProcessor({ repositories, logger, now: () => NOW })(job)
    ).recorded;
  };

  it('tells the interested and the pending invitees, each once, the invitee with the invite to join by', async () => {
    await setUp();
    await interested(FAN, INVITEE);
    await invite();

    expect(await remind()).toBe(2);

    expect(await notificationsOf(repositories, FAN)).toMatchObject([
      {
        kind: 'party_starting',
        watchPartyId: ROOM,
        groupKey: `party_starting:${ROOM}`,
        payload: { party: { roomId: ROOM, inviteId: null, scheduledFor: SCHEDULED.toISOString() } },
      },
    ]);
    expect(await notificationsOf(repositories, INVITEE)).toMatchObject([
      { payload: { party: { inviteId: INVITE } } },
    ]);
  });

  it('says nothing twice when the job runs again', async () => {
    await setUp();
    await interested(FAN);
    await remind();

    expect(await remind()).toBe(0);
    expect(await notificationsOf(repositories, FAN)).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'the room moved to another time',
      change: async () => {
        expectOk(
          await repositories.watchPartyRooms.updateSettings(
            ROOM,
            { scheduledFor: new Date(NOW + 7_200_000) },
            1,
            null,
            AT
          )
        );
      },
    },
    {
      scenario: 'the room closed',
      change: async () => {
        expectOk(await repositories.watchPartyRooms.close(ROOM, 'owner', null, AT));
      },
    },
    {
      scenario: 'the account switched party notifications off',
      change: () => saveSwitches(repositories, FAN, { watchParties: false }),
    },
    {
      scenario: 'the interest was withdrawn',
      change: async () => {
        expectOk(await repositories.watchPartyInterest.remove(ROOM, FAN));
      },
    },
  ])('records nothing when $scenario before the job ran', async ({ change }) => {
    await setUp();
    await interested(FAN);
    await change();

    expect(await remind()).toBe(0);
    expect(await notificationsOf(repositories, FAN)).toEqual([]);
  });

  it('leaves out an invite that has expired and one that was declined', async () => {
    await setUp();
    await invite(new Date(NOW - 1));

    expect(await remind()).toBe(0);
  });
});
