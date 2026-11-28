import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, type Result } from '@kit/result';
import type {
  ChannelPostCreated,
  ChannelPostRevisionAuthor,
  EntityRevisionRepository,
  PostWriteLimits,
} from '@vp/core/repositories';
import { isPostPublished, type ChannelPost, type NewPostInput } from '@vp/domain';

/** The state before the first edit is recorded too, so the first edit can be undone. */
export async function recordPostRevisions(
  revisions: Pick<EntityRevisionRepository, 'append' | 'list'>,
  before: ChannelPost,
  after: ChannelPost,
  author: ChannelPostRevisionAuthor
): Promise<Result<void, DatabaseUnavailable>> {
  const recorded = await revisions.list('channel_post', after.id, {
    beforeVersion: null,
    limit: 1,
  });
  if (isErr(recorded)) return recorded;
  if (recorded.value.length === 0) {
    const first = await revisions.append({
      entityType: 'channel_post',
      entityId: before.id,
      version: before.version,
      snapshot: { payload: before.payload },
      authorUserId: null,
      restoredFromVersion: null,
    });
    if (isErr(first)) return first;
  }
  return revisions.append({
    entityType: 'channel_post',
    entityId: after.id,
    version: after.version,
    snapshot: { payload: after.payload },
    authorUserId: author.authorUserId,
    restoredFromVersion: author.restoredFromVersion,
  });
}

export function limitRefusal(
  posts: readonly ChannelPost[],
  input: NewPostInput,
  limits: PostWriteLimits
): Extract<ChannelPostCreated, { type: 'daily_limit' | 'pending_limit' }> | null {
  const own = posts.filter((post) => post.channelId === input.channelId);
  if (own.filter((post) => post.createdAt >= limits.dailySince).length >= limits.daily) {
    return { type: 'daily_limit' };
  }
  const pending = own.filter((post) => !isPostPublished(post.status)).length;
  return !isPostPublished(input.status) && pending >= limits.pending
    ? { type: 'pending_limit' }
    : null;
}
