import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import {
  AS,
  CREATOR,
  type CommentsApp,
  closeSharedCommentsApp,
  type Who,
  VIDEO,
  sharedCommentsApp,
} from '../../__tests__/comments-app';

const OTHER_VIDEO = '88888888-8888-7888-8888-888888888888';
const ELSEWHERE = 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa';

describe('creator comment inbox routes', () => {
  let ctx: CommentsApp;

  beforeEach(async () => {
    ctx = await sharedCommentsApp();
    await seedVideo(ctx.repositories, { id: OTHER_VIDEO, ownerId: CREATOR, title: 'Second' });
    await seedVideo(ctx.repositories, {
      id: ELSEWHERE,
      ownerId: '55555555-5555-7555-8555-555555555555',
      title: 'Not theirs',
    });
  });

  afterAll(closeSharedCommentsApp);

  const inbox = (who: Who | null, query = '') =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/creator/comments${query}`,
      headers: who ? AS[who] : {},
    });

  const contents = (res: { json(): { items: { content: string }[] } }) =>
    res.json().items.map((item) => item.content);

  it('lists comments across the creator videos, newest first, with the video summary', async () => {
    await ctx.post('author', { content: 'on the first' }, VIDEO);
    await ctx.post('stranger', { content: 'on the second' }, OTHER_VIDEO);
    await ctx.post('author', { content: 'on somebody else' }, ELSEWHERE);

    const res = await inbox('creator');

    expect(res.statusCode).toBe(200);
    expect(contents(res)).toEqual(['on the second', 'on the first']);
    expect(res.json().items[0]).toMatchObject({
      video: { id: OTHER_VIDEO, title: 'Second' },
      heartedByCreator: false,
    });
  });

  it('leaves out what the creator wrote and shows nothing to a caller without videos', async () => {
    await ctx.post('creator', { content: 'my own words' });
    await ctx.post('author', { content: 'a fan' });

    expect(contents(await inbox('creator'))).toEqual(['a fan']);
    expect((await inbox('stranger')).json().items).toEqual([]);
  });

  it('keeps only what the creator has not answered under unanswered', async () => {
    const answered = await ctx.comment('author', 'answered');
    await ctx.comment('stranger', 'waiting');
    await ctx.comment('creator', 'thanks', answered);
    await ctx.comment('stranger', 'a follow up', answered);

    const res = await inbox('creator', '?filter=unanswered');

    expect(contents(res).sort()).toEqual(['a follow up', 'waiting']);
  });

  it('keeps only what has an open report under reported', async () => {
    const flagged = await ctx.comment('author', 'flagged');
    await ctx.comment('stranger', 'fine');
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${flagged}/reports`,
      headers: AS.stranger,
      payload: { reason: 'spam' },
    });

    expect(contents(await inbox('creator', '?filter=reported'))).toEqual(['flagged']);

    const queued = (
      await ctx.app.inject({ method: 'GET', url: '/v1/admin/reports', headers: AS.admin })
    ).json();
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/admin/reports/${queued.items[0].id}/resolve`,
      headers: AS.admin,
      payload: { resolution: 'dismissed' },
    });
    expect(contents(await inbox('creator', '?filter=reported'))).toEqual([]);
  });

  it('walks the inbox by keyset and refuses an unknown filter or cursor', async () => {
    for (const content of ['one', 'two', 'three']) await ctx.comment('author', content);

    const page = (await inbox('creator', '?limit=2')).json();
    const rest = (await inbox('creator', `?limit=2&cursor=${page.nextCursor}`)).json();

    expect(page.items).toHaveLength(2);
    expect(rest.items).toHaveLength(1);
    expect(rest.nextCursor).toBeNull();
    expect((await inbox('creator', '?filter=mine')).statusCode).toBe(400);
    expect((await inbox('creator', '?cursor=garbage')).json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it('refuses an anonymous caller with 401', async () => {
    const res = await inbox(null);

    expect(res.statusCode).toBe(401);
  });

  it('tells the creator of every new comment on their video, and not of their own', async () => {
    await ctx.comment('author', 'a fan writes');
    await ctx.comment('creator', 'the creator writes');

    const events = expectOk(await ctx.repositories.userEvents.listFrom(CREATOR, 1, 10));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'comment.created',
      payload: {
        comment: { content: 'a fan writes', author: { handle: 'author' } },
        video: { id: VIDEO, title: 'Open' },
      },
    });
  });
});
