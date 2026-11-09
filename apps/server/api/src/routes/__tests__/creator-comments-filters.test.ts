import { DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  CREATOR,
  type CommentsApp,
  closeSharedCommentsApp,
  sharedCommentsApp,
} from '../../__tests__/comments-app';

describe('creator comment inbox routes: the moderation filters', () => {
  let ctx: CommentsApp;

  beforeEach(async () => {
    ctx = await sharedCommentsApp();
  });

  afterAll(closeSharedCommentsApp);

  const inbox = (filter: string) =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/creator/comments?filter=${filter}`,
      headers: AS.creator,
    });

  const contents = (res: { json(): { items: { content: string }[] } }) =>
    res.json().items.map((item) => item.content);

  it.each([
    {
      scenario: 'a question mark or a leading question word and nothing else',
      posted: [
        'Where is the link?',
        'how did you film this',
        'Nice work',
        'I know how you did it',
        'Wow! What a shot',
      ],
      listed: ['Wow! What a shot', 'how did you film this', 'Where is the link?'],
    },
  ])('lists under questions $scenario', async ({ posted, listed }) => {
    for (const content of posted) await ctx.comment('author', content);

    expect(contents(await inbox('questions'))).toEqual(listed);
  });

  it('lists held and hidden comments only under their own filter, with their state', async () => {
    expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    );
    const saved = await ctx.app.inject({
      method: 'PUT',
      url: '/v1/me/channel/comment-settings',
      headers: AS.creator,
      payload: { ...DEFAULT_COMMENT_SETTINGS, reviewMode: 'all' },
    });
    expect(saved.statusCode).toBe(200);
    await ctx.comment('author', 'waiting for a decision');

    const held = await inbox('held');
    const all = await inbox('all');

    expect(contents(held)).toEqual(['waiting for a decision']);
    expect(held.json().items[0]).toMatchObject({ status: 'held', moderation: { state: 'held' } });
    expect(contents(await inbox('hidden'))).toEqual([]);
    expect(contents(all)).toEqual(['waiting for a decision']);
  });

  it('refuses a filter that does not exist with 400', async () => {
    expect((await inbox('moods')).statusCode).toBe(400);
  });
});
