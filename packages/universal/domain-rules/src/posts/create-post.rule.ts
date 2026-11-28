import { type Result, andThen, map } from '@kit/result';
import type { ChannelPost, PostPayload } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type InvalidPostPayload, validatePostPayload } from '@vp/validation';
import type { AuthorizationFailure } from '../authorize';
import { decidePostDailyLimit } from './daily-limit.rule';
import type { PostDailyLimit, PostNotFound, PostShareNotPublic } from './failures';
import { decidePostTarget, decidePostWrite } from './manage-post.rule';
import { type SharedTarget, decidePostShare } from './share-target.rule';

interface PostChannel {
  readonly id: string;
  readonly ownerId: string;
}

export interface CreatePostInput {
  readonly actor: UserContext | null;
  readonly channel: PostChannel;
  readonly payload: PostPayload;
  readonly shared: SharedTarget | null;
  readonly createdToday: number;
}

export interface EditPostInput {
  readonly actor: UserContext | null;
  readonly channel: PostChannel;
  readonly post: ChannelPost | null;
  readonly postId: string;
  readonly payload: PostPayload;
  readonly shared: SharedTarget | null;
}

export interface PostToWrite {
  readonly payload: PostPayload;
}

export type CreatePostFailure =
  | AuthorizationFailure
  | InvalidPostPayload
  | PostDailyLimit
  | PostShareNotPublic;

export type EditPostFailure =
  | AuthorizationFailure
  | PostNotFound
  | InvalidPostPayload
  | PostShareNotPublic;

function checkedShare(
  payload: PostPayload,
  shared: SharedTarget | null
): Result<PostToWrite, PostShareNotPublic> {
  return map(decidePostShare({ payload, shared }), () => ({ payload }));
}

/** Permission first, so a stranger learns nothing about the limits or the shared target. */
export function decidePostCreate(input: CreatePostInput): Result<PostToWrite, CreatePostFailure> {
  const { actor, channel, shared, createdToday } = input;
  return andThen(
    decidePostWrite({ actor, action: 'create', channel }),
    (): Result<PostToWrite, CreatePostFailure> =>
      andThen(validatePostPayload(input.payload), (payload) =>
        andThen(decidePostDailyLimit(createdToday), () => checkedShare(payload, shared))
      )
  );
}

export function decidePostEdit(input: EditPostInput): Result<PostToWrite, EditPostFailure> {
  const { actor, channel, post, postId, shared } = input;
  return andThen(
    decidePostWrite({ actor, action: 'update', channel }),
    (): Result<PostToWrite, EditPostFailure> =>
      andThen(decidePostTarget({ post, postId, channelId: channel.id }), () =>
        andThen(validatePostPayload(input.payload), (payload) => checkedShare(payload, shared))
      )
  );
}
