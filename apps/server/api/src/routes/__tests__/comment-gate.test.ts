import { CHANNEL_HEADER } from '@vp/api-contracts';
import { DEFAULT_COMMENT_SETTINGS, type DisclosureRule } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  VIDEO,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';

const SETTINGS_URL = '/v1/me/channel/comment-settings';
const SETTINGS = { ...DEFAULT_COMMENT_SETTINGS };
const HOUR_MS = 3_600_000;

describe('comment gate routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const putSettings = (changes: Partial<typeof SETTINGS>, who: Who = 'creator', channel?: string) =>
    ctx.app.inject({
      method: 'PUT',
      url: SETTINGS_URL,
      headers: { ...AS[who], ...(channel && { [CHANNEL_HEADER]: channel }) },
      payload: { ...SETTINGS, ...changes },
    });

  const configure = async (changes: Partial<typeof SETTINGS>) => {
    expect((await putSettings(changes)).statusCode).toBe(200);
  };

  const listAs = (who: Who | null) => ctx.list('', who ? AS[who] : {});

  const ids = (res: { json(): { items: { id: string }[] } }) =>
    res.json().items.map(({ id }) => id);

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

  describe('a new comment', () => {
    it('refuses a visibly banned author with the reason and the end, and lets them in after it', async () => {
      const expiresAt = new Date(Date.now() + HOUR_MS);
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId,
          userId: AUTHOR,
          kind: 'ban',
          reason: 'spam',
          expiresAt,
          createdBy: CREATOR,
        })
      );

      const refused = await ctx.post('author', { content: 'hi' });

      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({
        code: ErrorCodes.COMMENTS_BANNED,
        errors: [{ reason: 'spam', expiresAt: expiresAt.toISOString() }],
      });
    });

    it('refuses a second comment inside the slow mode window with Retry-After', async () => {
      await configure({ slowModeSeconds: 30 });
      await ctx.comment('author', 'first');

      const refused = await ctx.post('author', { content: 'second' });

      expect(refused.statusCode).toBe(429);
      expect(refused.json().code).toBe(ErrorCodes.COMMENTS_SLOW_MODE);
      const wait = Number(refused.headers['retry-after']);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(30);
      expect(refused.json().errors).toEqual([{ retryAfter: wait }]);
    });

    it('refuses an account younger than the minimum, naming the day it opens', async () => {
      await ctx.repositories.users.upsert({ id: AUTHOR, email: 'a@example.com', tier: 'free' });
      await configure({ minAccountAgeDays: 7 });

      const refused = await ctx.post('author', { content: 'hi' });

      expect(refused.statusCode).toBe(403);
      expect(refused.json().code).toBe(ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW);
      expect(Date.parse(refused.json().errors[0].opensAt)).toBeGreaterThan(Date.now());
    });

    it('refuses an author who is not subscribed once the channel is subscribers only', async () => {
      await configure({ subscribersOnly: true });

      const refused = await ctx.post('author', { content: 'hi' });

      expect(refused.statusCode).toBe(403);
      expect(refused.json().code).toBe(ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY);
    });

    it('refuses everyone but the team once the creator turns comments off, and turns them back on', async () => {
      const video = expectOk(await ctx.repositories.videos.findById(VIDEO));
      const patch = (commentsEnabled: boolean, version: number) =>
        ctx.app.inject({
          method: 'PATCH',
          url: `/v1/creator/videos/${VIDEO}`,
          headers: AS.creator,
          payload: { commentsEnabled, version },
        });

      expect((await patch(false, video?.version ?? 0)).json().commentsEnabled).toBe(false);

      const refused = await ctx.post('author', { content: 'hi' });
      expect(refused.statusCode).toBe(403);
      expect(refused.json().code).toBe(ErrorCodes.COMMENTS_DISABLED);
      expect((await ctx.post('creator', { content: 'still here' })).statusCode).toBe(201);

      const after = expectOk(await ctx.repositories.videos.findById(VIDEO));
      expect((await patch(true, after?.version ?? 0)).statusCode).toBe(200);
      expect((await ctx.post('author', { content: 'hi' })).statusCode).toBe(201);
    });
  });

  describe('holding a comment', () => {
    it.each<{ rule: DisclosureRule; settings: Partial<typeof SETTINGS>; content: string }>([
      { rule: 'auto.review_all', settings: { reviewMode: 'all' }, content: 'hello' },
      {
        rule: 'auto.links',
        settings: { reviewMode: 'links', linkAllowlist: ['example.com'] },
        content: 'see https://other.dev/a',
      },
      { rule: 'auto.blocked_words', settings: { blockedWords: ['spoiler'] }, content: 'a spoiler' },
    ])(
      'tells the author of a comment held by $rule only when the default says visible',
      async ({ rule, settings, content }) => {
        for (const disclosure of ['visible', 'silent'] as const) {
          await configure({
            ...settings,
            disclosure: { ...SETTINGS.disclosure, [rule]: disclosure },
          });

          const created = await ctx.post('author', { content });

          expect(created.statusCode).toBe(201);
          expect(created.json()).toMatchObject(
            disclosure === 'visible'
              ? { status: 'held', moderation: { state: 'held' } }
              : { status: 'published', moderation: null }
          );
        }
      }
    );

    it('keeps a held comment out of every public read and its count, and shows it to its author', async () => {
      await configure({ reviewMode: 'all' });
      const anonymousBefore = await listAs(null);
      expect(ids(anonymousBefore)).toEqual([]);

      const held = (await ctx.post('author', { content: 'waiting' })).json();

      const anonymous = await listAs(null);
      const stranger = await listAs('stranger');
      const author = await listAs('author');
      expect([ids(anonymous), ids(stranger), anonymous.json().total]).toEqual([[], [], 0]);
      expect([ids(author), author.json().total]).toEqual([[held.id], 1]);
      expect(author.json().items[0]).toMatchObject({ status: 'held' });
    });

    it('answers a stranger asking for a held comment as if it was not there', async () => {
      await configure({ reviewMode: 'all' });
      const held = (await ctx.post('author', { content: 'waiting' })).json();
      const stranger = await ctx.app.inject({
        method: 'GET',
        url: `/v1/comments/${held.id}/replies`,
      });

      expect(stranger.statusCode).toBe(404);
    });
  });

  describe('a shadow ban', () => {
    const ban = async () =>
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId,
          userId: AUTHOR,
          kind: 'shadow',
          reason: null,
          expiresAt: null,
          createdBy: CREATOR,
        })
      );

    it('answers 201 with the same shape, shows the comment to its author only, and never leaks it through the hot cache', async () => {
      await ctx.comment('stranger', 'ordinary');
      const warm = await listAs(null);
      await ban();

      const ordinary = (await ctx.post('stranger', { content: 'same shape' })).json();
      const shadowed = await ctx.post('author', { content: 'same shape' });

      expect(shadowed.statusCode).toBe(201);
      expect(Object.keys(shadowed.json()).sort()).toEqual(Object.keys(ordinary).sort());
      expect(shadowed.json()).toMatchObject({ status: 'published', moderation: null });
      const anonymous = await listAs(null);
      const author = await listAs('author');
      expect(ids(anonymous)).toEqual(ids(warm).concat([ordinary.id]).sort().reverse());
      expect(ids(anonymous)).not.toContain(shadowed.json().id);
      expect(ids(author)).toContain(shadowed.json().id);
      expect(author.json().total).toBe(anonymous.json().total + 1);
    });

    it('shows the comment to everyone once the ban is lifted, with nothing rewritten', async () => {
      await ban();
      const shadowed = (await ctx.post('author', { content: 'hidden for now' })).json();
      expect(ids(await listAs(null))).toEqual([]);

      expectOk(await ctx.repositories.channelUserRestrictions.lift(channelId, AUTHOR));
      ctx.cache.clear();

      expect(ids(await listAs(null))).toEqual([shadowed.id]);
    });
  });
});
