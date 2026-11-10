import type { BulkActionBody } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { err, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { CommentBulkService } from '../comment-bulk-service';

const USER = { id: 'user-1', role: 'USER' } as const;
const ACTING = { channelId: 'channel-1', ownerId: 'owner-1', role: 'owner' } as const;

describe('apps/server/api/services: comment bulk', () => {
  const service = (moderate = vi.fn(), restrict = vi.fn(), lift = vi.fn()) =>
    new CommentBulkService({
      comments: {
        findById: async (id) =>
          ok(
            id === 'gone'
              ? null
              : ({ id, videoId: 'video-1', authorId: `author-of-${id}` } as never)
          ),
      },
      videos: { findById: async () => ok({ ownerId: 'owner-1' } as never) },
      moderation: { moderate },
      restrictions: { restrict, lift },
    });
  const apply = async (s: CommentBulkService, ids: string[], action: BulkActionBody) =>
    expectOk(await s.apply(USER, ACTING, ids, action)).results;

  it('answers every id in order and carries a refusal as that id code only', async () => {
    const moderate = vi
      .fn()
      .mockResolvedValueOnce(ok({ state: 'hidden', comment: null }))
      .mockResolvedValueOnce(err({ code: ErrorCodes.FORBIDDEN, message: 'no' }));

    const results = await apply(service(moderate), ['a', 'b'], { action: 'approve' });

    expect(results).toEqual([
      { id: 'a', ok: true },
      { id: 'b', ok: false, code: ErrorCodes.FORBIDDEN },
    ]);
  });

  it('applies a user action once per author and answers for each comment', async () => {
    const restrict = vi.fn().mockResolvedValue(ok({}));

    const results = await apply(service(vi.fn(), restrict), ['a', 'a', 'gone'], {
      action: 'shadow_ban',
    });

    expect(restrict).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { id: 'a', ok: true },
      { id: 'a', ok: true },
      { id: 'gone', ok: false, code: ErrorCodes.COMMENT_NOT_FOUND },
    ]);
  });

  it('lifts through the restriction service', async () => {
    const lift = vi.fn().mockResolvedValue(ok());

    await apply(service(vi.fn(), vi.fn(), lift), ['a'], { action: 'lift' });

    expect(lift).toHaveBeenCalledWith(USER, ACTING, 'author-of-a');
  });
});
