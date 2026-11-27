import { type Result, err, ok } from '@kit/result';
import type { ChannelPost } from '@vp/domain';
import {
  type PostAction,
  type UserContext,
  canManagePost,
  canReactPost,
  canReadPostStats,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type PostNotFound, postNotFound } from './failures';

export interface PostWriteInput {
  readonly actor: UserContext | null;
  readonly action: PostAction;
  readonly channel: { readonly id: string; readonly ownerId: string };
}

export function decidePostWrite(input: PostWriteInput): Result<UserContext, AuthorizationFailure> {
  const { actor, action, channel } = input;
  const post = { ownerId: channel.ownerId, channelId: channel.id };
  return authorize(actor, canManagePost({ user: actor, action, post }), {
    action,
    subject: 'Post',
  });
}

export interface PostTargetInput {
  readonly post: ChannelPost | null;
  readonly postId: string;
  readonly channelId: string;
}

/** A post of another channel is absent here, whatever the caller may do there. */
export function decidePostTarget(input: PostTargetInput): Result<ChannelPost, PostNotFound> {
  const { post, postId, channelId } = input;
  return post && post.channelId === channelId ? ok(post) : err(postNotFound(postId));
}

/** Liking is for a signed-in account; a guest identity is refused like an anonymous caller is. */
export function decidePostReact(
  reactor: UserContext | null
): Result<UserContext, AuthorizationFailure> {
  return authorize(reactor, canReactPost({ user: reactor }), { action: 'react', subject: 'Post' });
}

/** Only the team's analytics grants read what a post collected; it is never on a public resource. */
export function decidePostStatsRead(
  input: Pick<PostWriteInput, 'actor' | 'channel'>
): Result<UserContext, AuthorizationFailure> {
  const { actor, channel } = input;
  const post = { ownerId: channel.ownerId, channelId: channel.id };
  return authorize(actor, canReadPostStats({ user: actor, post }), {
    action: 'read',
    subject: 'PostStats',
  });
}
