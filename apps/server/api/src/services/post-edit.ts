import { type DatabaseUnavailable } from '@kit/errors';
import { type Result, assertNever, err, isErr, ok } from '@kit/result';
import type { ManagedPostView, PostWriteBody } from '@vp/api-contracts';
import type { ChannelPostPlacement } from '@vp/core/repositories';
import { type ActingChannel, type ChannelPost, isPostPublished } from '@vp/domain';
import {
  type EditPostFailure,
  type PostPollLocked,
  type PostScheduleInvalid,
  decidePostEdit,
  decidePostTiming,
  isPublishNow,
  postNotFound,
  postPollLocked,
} from '@vp/domain-rules';
import { type VersionConflict, versionConflict } from '@vp/errors';
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
  restoredFromVersion?: number;
};

export type EditPostServiceFailure =
  | EditPostFailure
  | PayloadCheckFailure
  | PostScheduleInvalid
  | PostPollLocked
  | VersionConflict
  | DatabaseUnavailable;

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

  const decision = body.timing
    ? decidePostTiming({ current: current.status, timing: toPostTiming(body.timing), now })
    : null;
  if (decision && isErr(decision)) return decision;
  const moved = decision?.value ?? null;
  const placement: ChannelPostPlacement | undefined =
    moved && !isPublishNow(moved) ? moved : undefined;
  const referenced = await checkPayloadReferences(deps, channel.id, payload, {
    at: placement?.publishAt ?? current.publishAt ?? now,
    previous: current.payload,
  });
  if (isErr(referenced)) return referenced;

  const written = await posts.edit(
    postId,
    body.version,
    {
      payload,
      commentsEnabled: body.commentsEnabled ?? current.commentsEnabled,
      placement,
      revision: {
        authorUserId: user.id,
        restoredFromVersion: body.restoredFromVersion ?? null,
      },
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
    case 'locked':
      return err(postPollLocked(postId));
    case 'edited':
      return finish(deps, user, outcome.post, moved !== null && isPublishNow(moved), now);
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
  if (publish && !isPostPublished(edited.status)) {
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
