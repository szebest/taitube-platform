import { type Result, andThen, map } from '@kit/result';
import type { Video, VideoThread } from '@vp/domain';
import { type UserContext, canModerateComment, canPinThread } from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ReadThreadFailure, decideThreadRead } from './read-thread.rule';

export interface ManageThreadInput {
  readonly actor: UserContext | null;
  readonly thread: VideoThread | null;
  readonly threadId: string;
  readonly video: Video | null;
}

interface ManagedThread {
  readonly actor: UserContext;
  readonly thread: VideoThread;
  readonly video: Video;
}

export type ManageThreadFailure = AuthorizationFailure | ReadThreadFailure;

function decideManage(
  input: ManageThreadInput,
  allowed: (actor: UserContext, managed: Pick<ManagedThread, 'thread' | 'video'>) => boolean,
  context: { action: string; subject: string }
): Result<ManagedThread, ManageThreadFailure> {
  const { actor, ...rest } = input;
  return andThen(decideThreadRead({ ...rest, viewer: actor }), (managed) =>
    map(authorize(actor, actor !== null && allowed(actor, managed), context), (signedIn) => ({
      ...managed,
      actor: signedIn,
    }))
  );
}

/** Pinning is the video channel's: the owner, a manager and an editor. */
export function decideThreadPin(
  input: ManageThreadInput
): Result<ManagedThread, ManageThreadFailure> {
  return decideManage(
    input,
    (actor, { video }) =>
      canPinThread({ user: actor, thread: { ownerId: video.ownerId, channelId: video.channelId } }),
    { action: 'pin', subject: 'Thread' }
  );
}

/** A thread goes at its author's hand or a moderator's, the way a comment does. */
export function decideThreadRemove(
  input: ManageThreadInput
): Result<ManagedThread, ManageThreadFailure> {
  return decideManage(
    input,
    (actor, { thread, video }) =>
      actor.id === thread.authorId ||
      canModerateComment({
        user: actor,
        action: 'remove',
        videoOwnerId: video.ownerId,
        videoChannelId: video.channelId,
      }),
    { action: 'remove', subject: 'Thread' }
  );
}
