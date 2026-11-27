import { type Result, assertNever, err, isErr, ok } from '@kit/result';
import type { ManagedPostView, PostWriteBody } from '@vp/api-contracts';
import type { ChannelPostPlacement } from '@vp/core/repositories';
import type { ActingChannel, ChannelPost } from '@vp/domain';
import {
  type EditPostFailure,
  type PostPollLocked,
  type PostScheduleInvalid,
  decidePollUnlocked,
  decidePostEdit,
  decidePostTiming,
  postNotFound,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { postAuditOf } from './post-audit';
import { toPostTiming } from './post-create';
import { toManagedPostViews } from './post-managed-views';
import type { PostServiceDeps } from './post-service';
import { loadSharedTarget } from './post-share-cards';
import { type PayloadCheckFailure, checkPayloadReferences } from './post-write-checks';

export type EditPostBody = Omit<PostWriteBody, 'commentsEnabled' | 'timing'> & {
  commentsEnabled?: boolean;
  timing?: PostWriteBody['timing'];
  version: number;
};

export type EditPostServiceFailure =
  | EditPostFailure
  | PayloadCheckFailure
  | PostScheduleInvalid
  | PostPollLocked
  | VersionConflict
  | DatabaseUnavailable;

async function votesOn(
  deps: PostServiceDeps,
  post: ChannelPost
): Promise<Result<number, DatabaseUnavailable>> {
  const tallies = await deps.engagement.tallies([post.id]);
  if (isErr(tallies)) return tallies;
  return ok((tallies.value.get(post.id) ?? []).reduce((sum, count) => sum + count, 0));
}

/**
 * An edit under the caller's version. A draft or scheduled post may also be moved, and moved to
 * "now" it is published through the same compare-and-set the scheduler uses.
 */
export async function editPost(
  deps: PostServiceDeps,
  user: UserContext,
  acting: ActingChannel,
  postId: string,
  body: EditPostBody
): Promise<Result<ManagedPostView, EditPostServiceFailure>> {
  const { posts } = deps;
  const now = new Date(deps.now());
  const channel = { id: acting.channelId, ownerId: acting.ownerId };
  const found = await posts.findById(postId);
  if (isErr(found)) return found;
  const shared = await loadSharedTarget(deps, body.payload);
  if (isErr(shared)) return shared;

  const decided = decidePostEdit({
    actor: user,
    channel,
    post: found.value,
    postId,
    payload: body.payload,
    shared: shared.value,
  });
  if (isErr(decided)) return decided;
  const current = found.value;
  if (!current) return err(postNotFound(postId));
  const { payload } = decided.value;

  const referenced = await checkPayloadReferences(deps, channel.id, payload, now);
  if (isErr(referenced)) return referenced;
  const voteCount = await votesOn(deps, current);
  if (isErr(voteCount)) return voteCount;
  const unlocked = decidePollUnlocked({ post: current, next: payload, voteCount: voteCount.value });
  if (isErr(unlocked)) return unlocked;
  const decision = body.timing
    ? decidePostTiming({ current: current.status, timing: toPostTiming(body.timing), now })
    : null;
  if (decision && isErr(decision)) return decision;
  const moved = decision?.value ?? null;
  const placement: ChannelPostPlacement | undefined =
    moved && moved.status !== 'published' ? moved : undefined;

  const written = await posts.edit(
    postId,
    body.version,
    {
      payload,
      commentsEnabled: body.commentsEnabled ?? current.commentsEnabled,
      placement,
    },
    postAuditOf('post.updated', user, channel.id, { id: postId, payload })
  );
  if (isErr(written)) return written;
  const outcome = written.value;
  switch (outcome.type) {
    case 'missing':
      return err(postNotFound(postId));
    case 'stale':
      return err(versionConflict(postId, body.version));
    case 'edited':
      return finish(deps, user, outcome.post, moved?.status === 'published', now);
    default:
      return assertNever(outcome, 'ChannelPostEdited');
  }
}

async function finish(
  deps: PostServiceDeps,
  user: UserContext,
  edited: ChannelPost,
  publish: boolean,
  now: Date
): Promise<Result<ManagedPostView, EditPostServiceFailure>> {
  let post = edited;
  if (publish && edited.status !== 'published') {
    const promoted = await deps.posts.promote(
      edited.id,
      postAuditOf('post.published', user, edited.channelId, edited)
    );
    if (isErr(promoted)) return promoted;
    post = promoted.value ?? edited;
  }
  const views = await toManagedPostViews(deps, [post], { user, now });
  if (isErr(views)) return views;
  const [view] = views.value;
  return view ? ok(view) : err(postNotFound(edited.id));
}
