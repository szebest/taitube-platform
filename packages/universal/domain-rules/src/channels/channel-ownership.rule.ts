import { type Result, andThen, err, ok } from '@kit/result';
import type { Channel } from '@vp/domain';
import { type ChannelLimitReached, channelLimitReached } from '@vp/errors';
import { type UserContext, canOwnChannel } from '@vp/permissions';
import {
  type ClaimHandleFailure,
  type ClaimHandleInput,
  decideHandleClaim,
} from './claim-handle.rule';
import {
  type ChannelNotFound,
  type ChannelNotOwned,
  channelNotFound,
  channelNotOwned,
} from './failures';

export interface ChannelCreationInput extends ClaimHandleInput {
  /** How many channels the caller owns now. */
  readonly owned: number;
  readonly limit: number;
}

/** The cap first, so a caller at it is told so whatever handle they tried. */
export function decideCreateChannel({
  owned,
  limit,
  ...claim
}: ChannelCreationInput): Result<string, ChannelLimitReached | ClaimHandleFailure> {
  return owned >= limit ? err(channelLimitReached(limit)) : decideHandleClaim(claim);
}

export interface PromoteChannelInput {
  readonly user: UserContext;
  readonly channelId: string;
  /** The channel as a repository read found it. */
  readonly channel: Channel | null;
}

export function decidePromote({
  user,
  channelId,
  channel,
}: PromoteChannelInput): Result<Channel, ChannelNotFound | ChannelNotOwned> {
  return andThen(channel ? ok(channel) : err(channelNotFound(channelId)), (found) =>
    canOwnChannel({ user, channel: { id: found.id, ownerId: found.userId } })
      ? ok(found)
      : err(channelNotOwned(found.id))
  );
}
