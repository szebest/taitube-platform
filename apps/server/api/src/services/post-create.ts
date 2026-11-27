import { MS_PER_DAY } from '@kit/primitives';
import { type Result, err, isErr, ok } from '@kit/result';
import type { ManagedPostView, PostWriteBody } from '@vp/api-contracts';
import { type ActingChannel, POSTS_PENDING_LIMIT, POSTS_PER_DAY } from '@vp/domain';
import {
  type CreatePostFailure,
  type PostDraftLimit,
  type PostNotFound,
  type PostScheduleInvalid,
  type PostTiming,
  decidePostCreate,
  postDailyLimit,
  postDraftLimit,
  decidePostTiming,
  isPublishNow,
  postNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { postAuditOf } from './post-audit';
import { toManagedPostViews } from './post-managed-views';
import type { PostServiceDeps } from './post-service';
import { loadSharedTarget } from './post-share-cards';
import { type PayloadCheckFailure, checkPayloadReferences } from './post-write-checks';

export type CreatePostBody = Omit<PostWriteBody, 'timing'> & {
  timing?: PostWriteBody['timing'];
};

export type CreatePostServiceFailure =
  | CreatePostFailure
  | PayloadCheckFailure
  | PostScheduleInvalid
  | PostDraftLimit
  | PostNotFound
  | DatabaseUnavailable;

export function toPostTiming(timing: PostWriteBody['timing'] | undefined): PostTiming {
  if (!timing) return { mode: 'now' };
  return timing.mode === 'schedule'
    ? { mode: 'schedule', publishAt: new Date(timing.publishAt) }
    : timing;
}

/** Permission, the payload and the limits are decided before anything is written; a draft or a schedule announces nothing. */
export async function createPost(
  deps: PostServiceDeps,
  user: UserContext,
  acting: ActingChannel,
  body: CreatePostBody
): Promise<Result<ManagedPostView, CreatePostServiceFailure>> {
  const { posts } = deps;
  const now = new Date(deps.now());
  const channel = { id: acting.channelId, ownerId: acting.ownerId };
  const today = Math.floor(now.getTime() / MS_PER_DAY) * MS_PER_DAY;
  const created = await posts.countCreatedSince(channel.id, new Date(today));
  if (isErr(created)) return created;
  const shared = await loadSharedTarget(deps, body.payload);
  if (isErr(shared)) return shared;

  const decided = decidePostCreate({
    actor: user,
    channel,
    payload: body.payload,
    shared: shared.value,
    createdToday: created.value,
  });
  if (isErr(decided)) return decided;
  const { payload } = decided.value;
  const timing = decidePostTiming({ current: null, timing: toPostTiming(body.timing), now });
  if (isErr(timing)) return timing;
  const publishAt = isPublishNow(timing.value) ? null : timing.value.publishAt;
  const referenced = await checkPayloadReferences(deps, channel.id, payload, {
    at: publishAt ?? now,
    previous: null,
  });
  if (isErr(referenced)) return referenced;

  const input = {
    id: uuidv7(),
    channelId: channel.id,
    authorUserId: user.id,
    payload,
    commentsEnabled: body.commentsEnabled,
    status: timing.value.status,
    publishAt,
  };
  const action = isPublishNow(timing.value) ? 'post.published' : 'post.updated';
  const written = await posts.create(input, postAuditOf(action, user, channel.id, input), {
    dailySince: new Date(today),
    daily: POSTS_PER_DAY,
    pending: POSTS_PENDING_LIMIT,
  });
  if (isErr(written)) return written;
  const outcome = written.value;
  if (outcome.type === 'daily_limit') return err(postDailyLimit(POSTS_PER_DAY));
  if (outcome.type === 'pending_limit') return err(postDraftLimit(POSTS_PENDING_LIMIT));
  const views = await toManagedPostViews(deps, [outcome.post], { user, now });
  if (isErr(views)) return views;
  const [view] = views.value;
  return view ? ok(view) : err(postNotFound(input.id));
}
