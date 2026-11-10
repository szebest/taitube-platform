import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelRestrictionService } from '../channel-restriction-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const AUTHOR = '22222222-2222-7222-8222-222222222222';
const VIDEO = '33333333-3333-7333-8333-333333333333';
const COMMENT = '44444444-4444-7444-8444-444444444444';

describe('apps/server/api/services: channel restrictions', () => {
  let repositories: InMemoryRepositories;
  let service: ChannelRestrictionService;
  let acting: { channelId: string; ownerId: string; role: 'owner' };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    for (const id of [OWNER.id, AUTHOR]) {
      await repositories.users.upsert({ id, email: `${id.slice(0, 4)}@example.com` });
    }
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    acting = { channelId: channel.id, ownerId: OWNER.id, role: 'owner' };
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        sourceKey: 'raw/v/source.mp4',
        title: 'Open',
        visibility: 'public',
        status: 'READY',
      })
    );
    expectOk(
      await repositories.comments.create({
        id: COMMENT,
        videoId: VIDEO,
        authorId: AUTHOR,
        parentId: null,
        content: 'hello',
      })
    );
    service = new ChannelRestrictionService({
      restrictions: repositories.channelUserRestrictions,
      members: repositories.channelMembers,
      users: repositories.users,
      channels: repositories.channels,
      moderation: repositories.commentModeration,
      notifications: repositories.notifications,
      commentCache: { getHot: async (_id, fetch) => fetch(), invalidate: async () => ok() },
      paginator: new Paginator({ defaultLimit: 10, maxLimit: 50 }),
      now: Date.now,
    });
  });

  const notify = async () =>
    expectOk(
      await repositories.notifications.record({
        userId: OWNER.id,
        kind: 'comment',
        actorChannelId: null,
        videoId: VIDEO,
        commentId: COMMENT,
        groupKey: null,
        payload: { actor: null, videoTitle: 'Open', excerpt: 'hello', outcome: null },
      })
    );
  const unread = async () => expectOk(await repositories.notifications.unreadCount(OWNER.id));

  it('withdraws the unread notifications about the comments of a user it shadow bans, not of one it bans', async () => {
    await notify();

    expectOk(await service.restrict(OWNER, acting, AUTHOR, { action: 'ban' }));
    const afterBan = await unread();
    expectOk(await service.restrict(OWNER, acting, AUTHOR, { action: 'shadow_ban' }));

    expect([afterBan, await unread()]).toEqual([1, 0]);
  });

  it('enqueues one notification job for a ban and none for a shadow ban', async () => {
    expectOk(await service.restrict(OWNER, acting, AUTHOR, { action: 'shadow_ban' }));
    const afterShadow = repositories.outbox.getAll().length;

    expectOk(await service.restrict(OWNER, acting, AUTHOR, { action: 'ban', reason: 'spam' }));

    expect(repositories.outbox.getAll().length - afterShadow).toBe(1);
  });

  it('answers a user with no ban, or a shadow ban, as having none', async () => {
    const none = await service.ownBan({ id: AUTHOR, role: 'USER' }, acting.channelId);
    expectOk(await service.restrict(OWNER, acting, AUTHOR, { action: 'shadow_ban' }));
    const shadow = await service.ownBan({ id: AUTHOR, role: 'USER' }, acting.channelId);

    expect([expectErr(none).code, expectErr(shadow).code]).toEqual([
      ErrorCodes.RESTRICTION_NOT_FOUND,
      ErrorCodes.RESTRICTION_NOT_FOUND,
    ]);
  });
});
