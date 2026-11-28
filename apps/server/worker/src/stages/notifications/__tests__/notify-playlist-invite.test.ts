import type { QueueJob } from '@kit/ports';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { PlaylistInvite } from '@vp/domain';
import type { NotifyPlaylistInviteJob } from '@vp/job-contracts';
import { createNotifyPlaylistInviteProcessor } from '../notify-playlist-invite';
import {
  CHANNEL_ID,
  CREATOR_ID,
  logger,
  notificationsOf,
  seedCreator,
  userId,
} from './notification-harness';

const INVITEE = userId(42);
const PLAYLIST = '00000000-0000-7000-8000-000000000b01';
const INVITE = '00000000-0000-7000-8000-000000000b02';
const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const invite = (overrides: Partial<PlaylistInvite> = {}): PlaylistInvite => ({
  id: INVITE,
  playlistId: PLAYLIST,
  role: 'editor',
  token: 't'.repeat(22),
  inviteeUserId: INVITEE,
  createdBy: CREATOR_ID,
  expiresAt: new Date(NOW + DAY_MS),
  maxUses: 1,
  useCount: 0,
  revokedAt: null,
  createdAt: new Date(NOW),
  ...overrides,
});

describe('apps/server/worker/stages: notify-playlist-invite', () => {
  let repositories: InMemoryRepositories;

  const setUp = async (overrides: Partial<PlaylistInvite> = {}) => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    expectOk(
      await repositories.playlists.create({
        id: PLAYLIST,
        ownerId: CREATOR_ID,
        title: 'Road trip',
        description: '',
        visibility: 'private',
      })
    );
    expectOk(await repositories.playlistCollaborators.createInvite(invite(overrides)));
  };

  const notify = async () => {
    const job: QueueJob<NotifyPlaylistInviteJob> = {
      id: `${INVITE}--notify-playlist-invite`,
      name: 'notify-playlist-invite',
      data: { inviteId: INVITE },
    };
    return expectOk(
      await createNotifyPlaylistInviteProcessor({ repositories, logger, now: () => NOW })(job)
    );
  };

  it('tells the invitee, with the inviter as the actor and the token to accept with', async () => {
    await setUp();

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: true });
    expect(await notificationsOf(repositories, INVITEE)).toMatchObject([
      {
        kind: 'playlist_invite',
        actorChannelId: CHANNEL_ID,
        payload: {
          actor: { handle: 'night-kitchen' },
          playlist: {
            id: PLAYLIST,
            title: 'Road trip',
            invite: { token: 't'.repeat(22), role: 'editor' },
          },
        },
      },
    ]);
  });

  it.each([
    { scenario: 'the invite has expired', overrides: { expiresAt: new Date(NOW) } },
    { scenario: 'the invite was revoked', overrides: { revokedAt: new Date(NOW) } },
    { scenario: 'the invite is a link', overrides: { inviteeUserId: null } },
  ])('says nothing when $scenario', async ({ overrides }) => {
    await setUp(overrides);

    expect(await notify()).toEqual({ inviteId: INVITE, recorded: false });
    expect(await notificationsOf(repositories, INVITEE)).toEqual([]);
  });
});
