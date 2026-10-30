import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  AS,
  type CommentsApp,
  closeSharedCommentsApp,
  sharedCommentsApp,
  type Who,
} from '../../../__tests__/comments-app';

describe('admin report routes', () => {
  let ctx: CommentsApp;
  let id: string;

  beforeEach(async () => {
    ctx = await sharedCommentsApp();
    id = await ctx.comment('author', 'buy my followers');
  });

  afterAll(closeSharedCommentsApp);

  const report = (who: Who | null, payload: object = { reason: 'spam' }, target = id) =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${target}/reports`,
      headers: who ? AS[who] : {},
      payload,
    });

  const queue = (who: Who | null, query = '') =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/admin/reports${query}`,
      headers: who ? AS[who] : {},
    });

  const resolve = (who: Who | null, reportId: string, resolution: string) =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/admin/reports/${reportId}/resolve`,
      headers: who ? AS[who] : {},
      payload: { resolution },
    });

  describe('the admin queue', () => {
    it.each<{ who: Who | null; status: number }>([
      { who: null, status: 401 },
      { who: 'stranger', status: 403 },
      { who: 'creator', status: 403 },
      { who: 'moderator', status: 403 },
      { who: 'admin', status: 200 },
    ])('lists for $who with $status', async ({ who, status }) => {
      expect((await queue(who)).statusCode).toBe(status);
    });

    it('lists open reports before resolved ones, each newest first, with the comment', async () => {
      const second = await ctx.comment('stranger', 'second');
      const first = (await report('stranger')).json();
      const resolvedOne = (await report('moderator', { reason: 'other' }, second)).json();
      await resolve('admin', resolvedOne.id, 'dismissed');
      const open = (await report('stranger', { reason: 'hate' }, second)).json();

      const res = await queue('admin');

      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([
        open.id,
        first.id,
        resolvedOne.id,
      ]);
      expect(res.json().items[1]).toMatchObject({
        comment: { id, content: 'buy my followers', removed: false },
      });
    });

    it('walks the queue by keyset', async () => {
      const other = await ctx.comment('stranger', 'other');
      await report('stranger');
      await report('stranger', { reason: 'spam' }, other);

      const page = (await queue('admin', '?limit=1')).json();
      const rest = (await queue('admin', `?limit=1&cursor=${page.nextCursor}`)).json();

      expect(page.items).toHaveLength(1);
      expect(rest.items).toHaveLength(1);
      expect(rest.nextCursor).toBeNull();
      expect(rest.items[0].id).not.toBe(page.items[0].id);
    });

    it('refuses a cursor that was not issued', async () => {
      const res = await queue('admin', '?cursor=garbage');

      expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
    });
  });

  describe('resolving', () => {
    it('removes the comment and its replies, and closes every report on it', async () => {
      await ctx.comment('stranger', 'a reply', id);
      const mine = (await report('stranger')).json();
      const theirs = (await report('moderator', { reason: 'hate' })).json();

      const res = await resolve('admin', mine.id, 'removed');

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: mine.id, resolution: 'removed' });
      expect((await ctx.list()).json()).toMatchObject({ items: [], total: 0 });
      const items = (await queue('admin')).json().items;
      expect(items.map((item: { resolution: string }) => item.resolution)).toEqual([
        'removed',
        'removed',
      ]);
      expect(items.map((item: { id: string }) => item.id).sort()).toEqual(
        [mine.id, theirs.id].sort()
      );
      expect(items[0].comment.removed).toBe(true);
    });

    it('dismisses one report and keeps the comment', async () => {
      const mine = (await report('stranger')).json();
      const theirs = (await report('moderator')).json();

      const res = await resolve('admin', mine.id, 'dismissed');

      expect(res.json()).toMatchObject({ resolution: 'dismissed' });
      expect((await ctx.list()).json().total).toBe(1);
      const items = (await queue('admin')).json().items;
      expect(items.find((item: { id: string }) => item.id === theirs.id).resolvedAt).toBeNull();
    });

    it.each([
      { scenario: 'an anonymous caller', who: null, status: 401 },
      { scenario: 'the video owner', who: 'creator' as const, status: 403 },
      { scenario: 'a moderator', who: 'moderator' as const, status: 403 },
    ])('refuses $scenario with $status and leaves the comment', async ({ who, status }) => {
      const mine = (await report('stranger')).json();

      const res = await resolve(who, mine.id, 'removed');

      expect(res.statusCode).toBe(status);
      expect((await ctx.list()).json().total).toBe(1);
    });

    it('refuses a resolved report with 409 and an absent one with 404', async () => {
      const mine = (await report('stranger')).json();
      await resolve('admin', mine.id, 'dismissed');

      const again = await resolve('admin', mine.id, 'removed');
      const absent = await resolve('admin', ABSENT, 'removed');

      expect(again.json().code).toBe(ErrorCodes.REPORT_ALREADY_RESOLVED);
      expect(absent.json().code).toBe(ErrorCodes.REPORT_NOT_FOUND);
    });

    it('resolves as removed a report whose comment its author already deleted', async () => {
      const mine = (await report('stranger')).json();
      await ctx.app.inject({ method: 'DELETE', url: `/v1/comments/${id}`, headers: AS.author });

      const res = await resolve('admin', mine.id, 'removed');

      expect(res.statusCode).toBe(200);
      expect(res.json().resolution).toBe('removed');
    });
  });
});
