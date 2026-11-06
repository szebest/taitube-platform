import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyTeamInviteJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifyTeamInviteProcessor } from '../notify-team-invite';
import {
  CHANNEL_ID,
  CREATOR_ID,
  logger,
  notificationsOf,
  seedCreator,
  userId,
} from './notification-harness';

const INVITEE = userId(42);
const INVITE = '00000000-0000-7000-8000-000000000a01';
const DAY_MS = 24 * 60 * 60 * 1000;

const audit = (action: 'invite.created' | 'invite.accepted', actorUserId: string) =>
  ({
    channelId: CHANNEL_ID,
    actorUserId,
    action,
    targetType: 'invite',
    targetId: INVITE,
    meta: { inviteeUserId: INVITEE, role: 'editor' },
  }) as const;

describe('apps/server/worker/stages: notify-team-invite', () => {
  let repositories: InMemoryRepositories;

  const setUp = async (expiresAt = new Date(Date.now() + DAY_MS)) => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    expectOk(await repositories.users.upsert({ id: INVITEE, email: 'invitee@example.com' }));
    expectOk(
      await repositories.channelInvites.create(
        {
          id: INVITE,
          channelId: CHANNEL_ID,
          inviteeUserId: INVITEE,
          role: 'editor',
          invitedBy: CREATOR_ID,
          expiresAt,
        },
        audit('invite.created', CREATOR_ID)
      )
    );
  };

  const notify = async (inviteId = INVITE) => {
    const job: QueueJob<NotifyTeamInviteJob> = {
      id: `${inviteId}--notify-team-invite`,
      name: 'notify-team-invite',
      data: { inviteId },
    };
    return expectOk(await createNotifyTeamInviteProcessor({ repositories, logger })(job));
  };

  it('tells the invitee, with the inviting channel as the actor', async () => {
    await setUp();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: true });

    expect(await notificationsOf(repositories, INVITEE)).toMatchObject([
      {
        kind: 'team_invite',
        actorChannelId: CHANNEL_ID,
        videoId: null,
        commentId: null,
        payload: {
          actor: { handle: 'night-kitchen', displayName: 'Night Kitchen' },
          videoTitle: null,
          excerpt: null,
          count: 1,
        },
      },
    ]);
  });

  it.each([
    {
      scenario: 'the invite is gone',
      prepare: async () => setUp(),
      inviteId: '00000000-0000-7000-8000-000000000a02',
    },
    {
      scenario: 'the invite has expired',
      prepare: async () => setUp(new Date(Date.now() - DAY_MS)),
      inviteId: INVITE,
    },
    {
      scenario: 'the invite was accepted',
      prepare: async () => {
        await setUp();
        expectOk(
          await repositories.channelInvites.accept(
            INVITE,
            INVITEE,
            audit('invite.accepted', INVITEE)
          )
        );
      },
      inviteId: INVITE,
    },
  ])('says nothing when $scenario', async ({ prepare, inviteId }) => {
    await prepare();

    expect(await notify(inviteId)).toMatchObject({ recorded: false });
    expect(await notificationsOf(repositories, INVITEE)).toEqual([]);
  });
});
