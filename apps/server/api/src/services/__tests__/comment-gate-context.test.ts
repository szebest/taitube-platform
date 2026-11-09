import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { loadCommentGate } from '../comment-gate-context';
import { commentCreateDeps } from './comment-deps';

const OWNER = '11111111-1111-7111-8111-111111111111';
const AUTHOR: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';
const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('apps/server/api/services: comment gate context', () => {
  let repositories: InMemoryRepositories;
  let video: Video;

  const load = async (author: UserContext = AUTHOR) =>
    expectOk(await loadCommentGate(commentCreateDeps(repositories), author, video, NOW));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    video = expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER,
        sourceKey: 'raw/x/source.mp4',
        visibility: 'public',
        status: 'READY',
      })
    );
  });

  it('has no gate for a video whose owner has no channel', async () => {
    expect(await load()).toBeNull();
  });

  describe('on a channel', () => {
    let channelId: string;

    beforeEach(async () => {
      channelId = expectOk(
        await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
      ).id;
    });

    it('reads what the author is to the channel, in one lookup', async () => {
      expectOk(
        await repositories.users.upsert({ id: AUTHOR.id, email: 'a@example.com', tier: 'free' })
      );
      expectOk(await repositories.subscriptions.subscribe(AUTHOR.id, channelId));
      expectOk(await repositories.trustedCommenters.add(channelId, AUTHOR.id, OWNER));
      expectOk(
        await repositories.channelUserRestrictions.apply({
          channelId,
          userId: AUTHOR.id,
          kind: 'ban',
          reason: 'spam',
          expiresAt: null,
          createdBy: OWNER,
        })
      );

      const gate = await load();

      expect(gate?.channelId).toBe(channelId);
      expect(gate?.context).toMatchObject({
        videoId: VIDEO_ID,
        commentsEnabled: true,
        isSubscribed: true,
        isTrusted: true,
        isTeamMember: false,
        restriction: { kind: 'ban', reason: 'spam', expiresAt: null },
      });
    });

    it.each<{ scenario: string; author: (channelId: string) => UserContext }>([
      { scenario: 'the owner', author: () => ({ id: OWNER, role: 'CREATOR' }) },
      {
        scenario: 'a member of the team',
        author: (channelId) => ({
          ...AUTHOR,
          memberships: { [channelId]: { role: 'moderator', ownerId: OWNER } },
        }),
      },
    ])('counts $scenario as the team', async ({ author }) => {
      const gate = await load(author(channelId));

      expect(gate?.context.isTeamMember).toBe(true);
    });

    it('treats a restriction that ended as none and a missing account as an old one', async () => {
      expectOk(
        await repositories.channelUserRestrictions.apply({
          channelId,
          userId: AUTHOR.id,
          kind: 'ban',
          reason: null,
          expiresAt: new Date(NOW.getTime() - 1),
          createdBy: OWNER,
        })
      );

      const gate = await load();

      expect(gate?.context.restriction).toBeNull();
      expect(gate?.context.accountCreatedAt).toEqual(new Date(0));
    });

    it('turns comments off from the video', async () => {
      video = { ...video, commentsEnabled: false };

      expect((await load())?.context.commentsEnabled).toBe(false);
    });
  });
});
