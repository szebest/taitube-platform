import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  AS,
  type CommentsApp,
  closeSharedCommentsApp,
  PRIVATE_VIDEO,
  sharedCommentsApp,
  type Who,
} from '../../__tests__/comments-app';

describe('comment report routes', () => {
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

  describe('reporting', () => {
    it('takes a report from any signed-in viewer, with a trimmed note', async () => {
      const res = await report('stranger', { reason: 'harassment', note: '  targeted  ' });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        commentId: id,
        reason: 'harassment',
        note: 'targeted',
        resolvedAt: null,
        resolution: null,
      });
    });

    it('refuses a second report by the same viewer and accepts another viewer', async () => {
      await report('stranger');

      const again = await report('stranger', { reason: 'hate' });
      const other = await report('moderator');

      expect(again.statusCode).toBe(409);
      expect(again.json().code).toBe(ErrorCodes.COMMENT_ALREADY_REPORTED);
      expect(other.statusCode).toBe(201);
    });

    it.each([
      { scenario: 'an anonymous caller', who: null, payload: { reason: 'spam' }, status: 401 },
      {
        scenario: 'an unknown reason',
        who: 'stranger' as const,
        payload: { reason: 'rude' },
        status: 400,
      },
      {
        scenario: 'a note over 500 characters',
        who: 'stranger' as const,
        payload: { reason: 'spam', note: 'x'.repeat(501) },
        status: 422,
      },
    ])('refuses $scenario with $status', async ({ who, payload, status }) => {
      expect((await report(who, payload)).statusCode).toBe(status);
    });

    it('answers 404 for an absent comment', async () => {
      const res = await report('stranger', { reason: 'spam' }, ABSENT);

      expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
    });

    it('does not reveal a comment under a private video to a stranger', async () => {
      const hidden = await ctx.post('creator', { content: 'draft talk' }, PRIVATE_VIDEO);

      const res = await report('stranger', { reason: 'spam' }, hidden.json().id);

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });
  });
});
