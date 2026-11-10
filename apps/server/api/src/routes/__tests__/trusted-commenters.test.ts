import { CHANNEL_HEADER } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  STRANGER,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';
import { seedTeamMember } from '../../__tests__/test-app';

describe('trusted commenters routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const url = (userId = AUTHOR) => `/v1/me/channel/trusted-commenters/${userId}`;
  const as = (who: Who) => ({ ...AS[who], [CHANNEL_HEADER]: channelId });
  const trust = (who: Who = 'creator', userId = AUTHOR) =>
    ctx.app.inject({ method: 'PUT', url: url(userId), headers: as(who) });
  const untrust = (who: Who = 'creator') =>
    ctx.app.inject({ method: 'DELETE', url: url(), headers: as(who) });
  const list = (who: Who = 'creator', query = '') =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/me/channel/trusted-commenters${query}`,
      headers: as(who),
    });
  const audited = async () =>
    expectOk(await ctx.repositories.channelAudit.list(channelId, { cursor: null, limit: 20 }))
      .map(({ action, actorUserId, targetId }) => ({ action, actorUserId, targetId }))
      .reverse();

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    channelId = expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    ).id;
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each<{ role: ChannelRole | 'owner'; status: number }>([
    { role: 'owner', status: 200 },
    { role: 'manager', status: 200 },
    { role: 'moderator', status: 403 },
    { role: 'editor', status: 403 },
    { role: 'analytics', status: 403 },
  ])('answers a $role listing with $status', async ({ role, status }) => {
    const who: Who = role === 'owner' ? 'creator' : 'stranger';
    if (role !== 'owner') {
      await seedTeamMember(ctx.repositories, { ownerId: CREATOR, memberId: STRANGER, role });
    }

    const read = await list(who);
    const write = await trust(who);
    const undo = await untrust(who);

    expect([read.statusCode, write.statusCode, undo.statusCode]).toEqual([
      status,
      status === 200 ? 204 : status,
      status === 200 ? 204 : status,
    ]);
  });

  it('trusts a user once, lists them with their channel, and logs only the changes', async () => {
    await trust();
    await trust();
    const listed = await list();
    await untrust();
    await untrust();

    expect(listed.json().items).toMatchObject([
      { userId: AUTHOR, createdBy: CREATOR, user: { handle: 'author' } },
    ]);
    expect((await list()).json().items).toEqual([]);
    expect(await audited()).toEqual([
      { action: 'trusted.added', actorUserId: CREATOR, targetId: AUTHOR },
      { action: 'trusted.removed', actorUserId: CREATOR, targetId: AUTHOR },
    ]);
  });

  it('lets a trusted commenter past a hold', async () => {
    await ctx.app.inject({
      method: 'PUT',
      url: '/v1/me/channel/comment-settings',
      headers: AS.creator,
      payload: {
        reviewMode: 'all',
        blockedWords: [],
        linkAllowlist: [],
        slowModeSeconds: null,
        subscribersOnly: false,
        minAccountAgeDays: 0,
        disclosure: {
          hide: 'silent',
          remove: 'visible',
          manual_hold: 'visible',
          'auto.blocked_words': 'silent',
          'auto.links': 'visible',
          'auto.review_all': 'visible',
        },
      },
    });
    await trust();

    const created = await ctx.post('author', { content: 'hello' });

    expect(created.json()).toMatchObject({ status: 'published' });
  });

  it('answers 422 for a user that does not exist and 401 for nobody', async () => {
    const missing = await trust('creator', '99999999-9999-7999-8999-999999999999');
    const anonymous = await ctx.app.inject({
      method: 'GET',
      url: '/v1/me/channel/trusted-commenters',
    });

    expect([missing.statusCode, anonymous.statusCode]).toEqual([422, 401]);
  });
});
