import { type Result, err, ok } from '@kit/result';
import type { ChannelPost } from '@vp/domain';
import { type UserContext, canManagePost } from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type PostNotFound, postNotFound } from './failures';

export interface PostWriteInput {
  readonly actor: UserContext | null;
  readonly action: 'create' | 'update' | 'delete';
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
