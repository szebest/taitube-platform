import type { LiveStream } from '@vp/domain';
import { canModerateLiveStream, type UserContext } from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type LiveChatClosed,
  type LiveChatSubscribersOnly,
  liveChatClosed,
  liveChatSubscribersOnly,
} from './failures';
import { LIVE_STREAM } from './live-stream.machine';

export interface LiveChatPostInput {
  readonly actor: UserContext;
  readonly stream: LiveStream;
  /** The user who owns the stream's channel. */
  readonly ownerId: string;
  readonly isSubscriber: boolean;
}

/** How long this sender waits between lines: the stream's slow mode, or none for a moderator. */
export interface LiveChatPostGrant {
  readonly slowModeSeconds: number;
}

/** The owner and moderators chat past slow mode and subscribers-only, as the rooms they keep. */
export function decideLiveChatPost(
  input: LiveChatPostInput
): Result<LiveChatPostGrant, LiveChatClosed | LiveChatSubscribersOnly> {
  const { actor, stream, ownerId, isSubscriber } = input;
  if (!LIVE_STREAM.next(stream.status, 'end')) return err(liveChatClosed(stream.id));

  const moderator = canModerateLiveStream({ user: actor, stream: { ownerId } });
  if (moderator) return ok({ slowModeSeconds: 0 });
  if (stream.chatSubscribersOnly && !isSubscriber) return err(liveChatSubscribersOnly(stream.id));
  return ok({ slowModeSeconds: stream.chatSlowModeSeconds });
}

export interface LiveChatModerateInput {
  readonly actor: UserContext | null;
  readonly stream: LiveStream;
  readonly ownerId: string;
}

export function decideLiveChatModerate(
  input: LiveChatModerateInput
): Result<LiveStream, AuthorizationFailure> {
  const { actor, stream, ownerId } = input;
  const allowed = canModerateLiveStream({ user: actor, stream: { ownerId } });
  return andThen(authorize(actor, allowed, { action: 'moderate', subject: 'LiveStream' }), () =>
    ok(stream)
  );
}
