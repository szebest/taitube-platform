import { MS_PER_DAY } from '@kit/primitives';
import { type Result, err, isErr, ok } from '@kit/result';
import type { ManagedPostView, PostWriteBody } from '@vp/api-contracts';
import type {
  ActingChannel,
  ChannelPost,
  NewChannelAuditEntry,
  NewChannelPostInput,
} from '@vp/domain';
import {
  type CreatePostFailure,
  type PostDraftLimit,
  type PostNotFound,
  type PostScheduleInvalid,
  type PostTiming,
  type PostTimingDecision,
  decidePostCreate,
  decidePostPendingLimit,
  decidePostTiming,
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
  const referenced = await checkPayloadReferences(deps, channel.id, payload, now);
  if (isErr(referenced)) return referenced;
  const timing = decidePostTiming({ current: null, timing: toPostTiming(body.timing), now });
  if (isErr(timing)) return timing;

  const input = {
    id: uuidv7(),
    channelId: channel.id,
    authorUserId: user.id,
    payload,
    commentsEnabled: body.commentsEnabled,
  };
  const written = await write(deps, input, timing.value, (action) =>
    postAuditOf(action, user, channel.id, input)
  );
  if (isErr(written)) return written;
  const views = await toManagedPostViews(deps, [written.value], { user, now });
  if (isErr(views)) return views;
  const [view] = views.value;
  return view ? ok(view) : err(postNotFound(input.id));
}

async function write(
  deps: PostServiceDeps,
  input: NewChannelPostInput,
  timing: PostTimingDecision,
  audit: (action: 'post.published' | 'post.updated') => NewChannelAuditEntry
): Promise<Result<ChannelPost, PostDraftLimit | DatabaseUnavailable>> {
  if (timing.status === 'published') return deps.posts.publish(input, audit('post.published'));
  const pending = await deps.posts.countPending(input.channelId);
  if (isErr(pending)) return pending;
  const limit = decidePostPendingLimit(pending.value);
  if (isErr(limit)) return limit;
  return deps.posts.saveUnpublished(
    { ...input, status: timing.status, publishAt: timing.publishAt },
    audit('post.updated')
  );
}
