import type { LiveStream } from '@vp/domain';
import { canUpdateLiveStream, type UserContext } from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type LiveStreamNotFound,
  type LiveStreamNotLive,
  liveStreamNotFound,
  liveStreamNotLive,
} from './failures';

export interface ManageLiveStreamInput {
  readonly actor: UserContext | null;
  readonly streamId: string;
  readonly stream: LiveStream | null;
  /** The user who owns the stream's channel; absent when the stream is. */
  readonly ownerId: string | null;
}

export type ManageLiveStreamFailure = AuthorizationFailure | LiveStreamNotFound;

/** Someone else's stream reads as absent, so its id says nothing about whose it is. */
export function decideLiveStreamUpdate(
  input: ManageLiveStreamInput
): Result<LiveStream, ManageLiveStreamFailure> {
  const { actor, streamId, stream, ownerId } = input;
  return andThen(authorize(actor, true, { action: 'update', subject: 'LiveStream' }), (user) =>
    stream && ownerId !== null && canUpdateLiveStream({ user, stream: { ownerId } })
      ? ok(stream)
      : err(liveStreamNotFound(streamId))
  );
}

export function decideLiveStreamStop(
  input: ManageLiveStreamInput
): Result<LiveStream, ManageLiveStreamFailure | LiveStreamNotLive> {
  return andThen(decideLiveStreamUpdate(input), (stream) =>
    stream.status === 'LIVE' ? ok(stream) : err(liveStreamNotLive(stream.id))
  );
}
