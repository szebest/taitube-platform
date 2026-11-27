import { ErrorCodes } from '@vp/errors';
import { ABSENT, closeSharedCommentsApp, VIDEO } from '../../../__tests__/comments-app';
import {
  AS_SCREENING,
  HELD,
  SCREENING,
  type ScreeningApp,
  type ScreeningWho,
  sharedScreeningApp,
} from '../../../__tests__/screening-app';

describe('admin screening routes', () => {
  let ctx: ScreeningApp;

  beforeEach(async () => {
    ctx = await sharedScreeningApp();
  });

  afterAll(closeSharedCommentsApp);

  const call = (who: ScreeningWho | null, method: 'GET' | 'POST', url: string, payload?: object) =>
    ctx.app.inject({
      method,
      url,
      headers: who ? AS_SCREENING[who] : {},
      ...(payload ? { payload } : {}),
    });
  const queue = (who: ScreeningWho | null, query = '') =>
    call(who, 'GET', `/v1/admin/screening${query}`);
  const decide = (who: ScreeningWho | null, action: string, payload?: object, id = HELD) =>
    call(who, 'POST', `/v1/admin/videos/${id}/screening/${action}`, payload);

  describe('the queue', () => {
    it.each<{ who: ScreeningWho | null; status: number }>([
      { who: null, status: 401 },
      { who: 'stranger', status: 403 },
      { who: 'creator', status: 403 },
      { who: 'moderator', status: 403 },
      { who: 'admin', status: 200 },
    ])('lists for $who with $status', async ({ who, status }) => {
      expect((await queue(who)).statusCode).toBe(status);
    });

    it('shows the held video with its reasons and the video it matched', async () => {
      const res = await queue('admin');

      expect(res.json().items).toMatchObject([
        {
          id: SCREENING,
          videoId: HELD,
          status: 'HELD',
          open: true,
          reasons: [{ reason: 'DUPLICATE', match: { id: VIDEO, title: 'Open' } }],
        },
      ]);
      expect(res.json().nextCursor).toBeNull();
    });

    it.each([
      { query: '?state=open', count: 1 },
      { query: '?state=decided', count: 0 },
      { query: '?limit=1', count: 1 },
    ])('filters with $query', async ({ query, count }) => {
      expect((await queue('admin', query)).json().items).toHaveLength(count);
    });

    it.each([{ query: '?cursor=nonsense' }, { query: '?state=other' }, { query: '?limit=0' }])(
      'answers 400 for $query',
      async ({ query }) => {
        expect((await queue('admin', query)).statusCode).toBe(400);
      }
    );
  });

  describe('decisions', () => {
    it.each<{ action: string; payload?: object }>([
      { action: 'approve' },
      { action: 'reject', payload: { reason: 'A re-upload' } },
      { action: 'dismiss' },
    ])(
      'refuses $action to a non-moderator with 403, and nobody with 401',
      async ({ action, payload }) => {
        expect((await decide('creator', action, payload)).statusCode).toBe(403);
        expect((await decide('stranger', action, payload)).statusCode).toBe(403);
        expect((await decide(null, action, payload)).statusCode).toBe(401);
      }
    );

    it('approves a held video back into processing', async () => {
      const res = await decide('admin', 'approve');

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ videoId: HELD, status: 'PROCESSING' });
    });

    it('tells the second moderator that the video changed', async () => {
      await decide('admin', 'approve');

      const res = await decide('secondAdmin', 'approve');

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
    });

    it.each([
      { name: 'no body', payload: undefined },
      { name: 'no reason', payload: {} },
      { name: 'a blank reason', payload: { reason: '   ' } },
      { name: 'a reason over 500 characters', payload: { reason: 'x'.repeat(501) } },
    ])('refuses a rejection with $name', async ({ payload }) => {
      expect((await decide('admin', 'reject', payload)).statusCode).toBe(400);
    });

    it('rejects with a reason, and the owner reads it', async () => {
      const res = await decide('admin', 'reject', { reason: 'A re-upload' });

      expect(res.json()).toEqual({ videoId: HELD, status: 'REJECTED' });
      const own = await ctx.app.inject({
        method: 'GET',
        url: `/v1/creator/videos/${HELD}/screening`,
        headers: AS_SCREENING.creator,
      });
      expect(own.json()).toMatchObject({ decision: 'rejected', decisionNote: 'A re-upload' });
    });

    it('answers 404 for a video that is not there, and 409 for flags that are not', async () => {
      expect((await decide('admin', 'approve', undefined, ABSENT)).statusCode).toBe(404);
      expect((await decide('admin', 'dismiss')).statusCode).toBe(409);
    });
  });
});
