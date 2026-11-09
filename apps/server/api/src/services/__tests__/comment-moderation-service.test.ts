import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { CommentModerationService } from '../comment-moderation-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const AUTHOR = '22222222-2222-7222-8222-222222222222';
const VIDEO = '33333333-3333-7333-8333-333333333333';
const COMMENT = '44444444-4444-7444-8444-444444444444';

describe('apps/server/api/services: comment moderation', () => {
  let repositories: InMemoryRepositories;

  const service = () =>
    new CommentModerationService({
      comments: repositories.comments,
      videos: repositories.videos,
      channels: repositories.channels,
      settings: repositories.commentSettings,
      moderation: repositories.commentModeration,
      notifications: repositories.notifications,
      commentCache: { getHot: async (_id, fetch) => fetch(), invalidate: async () => ok() },
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await repositories.users.upsert({ id: OWNER.id, email: 'o@example.com' });
    await repositories.users.upsert({ id: AUTHOR, email: 'a@example.com' });
    expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
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
  });

  it.each([
    {
      scenario: 'the state moved under it',
      written: { type: 'stale', state: 'held' } as const,
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
    },
    {
      scenario: 'the comment was removed under it',
      written: { type: 'missing' } as const,
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
  ])('refuses the action when $scenario', async ({ written, code }) => {
    vi.spyOn(repositories.commentModeration, 'moderate').mockResolvedValue(ok(written));

    const result = await service().moderate(OWNER, COMMENT, {
      action: 'hide',
      disclosure: 'silent',
    });

    expect(expectErr(result).code).toBe(code);
  });

  it('takes the visible default of the channel for a removal and needs its reason', async () => {
    const result = await service().moderate(OWNER, COMMENT, { action: 'remove' });

    expect(expectErr(result)).toMatchObject({
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
      why: 'reason_required',
    });
  });
});
