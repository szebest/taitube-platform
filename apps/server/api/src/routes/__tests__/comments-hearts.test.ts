import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  AS,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';

describe('comment heart routes', () => {
  let ctx: CommentsApp;
  let id: string;

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    id = await ctx.comment('author', 'worth a heart');
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const heart = (who: Who | null, target = id, method: 'POST' | 'DELETE' = 'POST') =>
    ctx.app.inject({
      method,
      url: `/v1/comments/${target}/heart`,
      headers: who ? AS[who] : {},
    });

  it.each<{ who: Who; status: number }>([
    { who: 'creator', status: 200 },
    { who: 'admin', status: 200 },
    { who: 'author', status: 403 },
    { who: 'stranger', status: 403 },
    { who: 'moderator', status: 403 },
  ])('lets the video owner heart: $who gets $status', async ({ who, status }) => {
    const res = await heart(who);

    expect(res.statusCode).toBe(status);
    expect((await ctx.list()).json().items[0].heartedByCreator).toBe(status === 200);
  });

  it('shows the heart to every viewer, anonymous ones too', async () => {
    await heart('creator');

    const seen = await Promise.all([ctx.list(), ctx.list('', AS.stranger)]);

    for (const res of seen) expect(res.json().items[0]).toMatchObject({ heartedByCreator: true });
  });

  it('hearts once however often it is asked, and takes the heart back on DELETE', async () => {
    await heart('creator');
    const again = await heart('creator');
    const removed = await heart('creator', id, 'DELETE');

    expect(again.json().heartedByCreator).toBe(true);
    expect(removed.json().heartedByCreator).toBe(false);
    expect((await ctx.list()).json().items[0].heartedByCreator).toBe(false);
  });

  it.each([
    { method: 'POST' as const, who: null, status: 401, code: ErrorCodes.UNAUTHORIZED },
    { method: 'DELETE' as const, who: null, status: 401, code: ErrorCodes.UNAUTHORIZED },
    {
      method: 'DELETE' as const,
      who: 'stranger' as const,
      status: 403,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $method from $who with $status', async ({ method, who, status, code }) => {
    const res = await heart(who, id, method);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });

  it('answers 404 for a comment that is not there', async () => {
    const res = await heart('creator', ABSENT);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});
