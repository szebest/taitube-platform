import { type Result, andThen, map } from '@kit/result';
import type { CommentModerationAction, ModerationOutcome, Video, VideoThread } from '@vp/domain';
import {
  type UserContext,
  canDeleteThread,
  canModerateComment,
  canPinThread,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { applyModeration } from '../comments/apply-moderation.rule';
import type { ModerationNotApplicable } from '../comments/failures';
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

const threadResource = (thread: VideoThread, video: Video) => ({
  ownerId: video.ownerId,
  channelId: video.channelId,
  authorId: thread.authorId,
});

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
    (actor, { thread, video }) =>
      canPinThread({ user: actor, thread: threadResource(thread, video) }),
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
      canDeleteThread({ user: actor, thread: threadResource(thread, video) }) ||
      canModerateComment({
        user: actor,
        action: 'remove',
        videoOwnerId: video.ownerId,
        videoChannelId: video.channelId,
      }),
    { action: 'remove', subject: 'Thread' }
  );
}

export type ModerateThreadFailure = ManageThreadFailure | ModerationNotApplicable;

/** A thread is moderated by the same permission and the same state machine as a comment. */
export function decideThreadModeration(
  input: ManageThreadInput & { readonly action: CommentModerationAction }
): Result<ManagedThread & { readonly outcome: ModerationOutcome }, ModerateThreadFailure> {
  const { action, ...rest } = input;
  return andThen(
    decideManage(
      rest,
      (actor, { video }) =>
        canModerateComment({
          user: actor,
          action: action.action,
          videoOwnerId: video.ownerId,
          videoChannelId: video.channelId,
        }),
      { action: action.action, subject: 'Thread' }
    ),
    (managed) =>
      map(applyModeration(managed.thread.moderationState, action), (outcome) => ({
        ...managed,
        outcome,
      }))
  );
}
