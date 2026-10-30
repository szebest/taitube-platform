import type { Channel } from '@vp/domain';
import { type UserContext, canSubscribeChannel } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import {
  type SubscribeFailure,
  type UnsubscribeFailure,
  cannotSubscribeToSelf,
  channelForbidden,
  channelNotFound,
} from './failures';

export interface SubscribeInput {
  readonly subscriber: UserContext | null;
  readonly channel: Channel | null;
  readonly channelId: string;
}

/**
 * Permission first, so an anonymous caller cannot probe which channel ids exist; then existence,
 * because a self-check against a channel that is not there is meaningless. The repositories used to
 * decide the last two - one copy each in the Postgres adapter and the in-memory double, which is two
 * places for them to disagree.
 */
export function decideSubscribe(input: SubscribeInput): Result<Channel, SubscribeFailure> {
  const { subscriber, channel, channelId } = input;

  if (!canSubscribeChannel({ user: subscriber })) return err(channelForbidden(channelId));
  if (!channel) return err(channelNotFound(channelId));
  if (subscriber?.id === channel.userId) return err(cannotSubscribeToSelf(channel.id));
  return ok(channel);
}

/** Unsubscribing from your own channel is a no-op, not a conflict, so the self check is absent. */
export function decideUnsubscribe(input: SubscribeInput): Result<Channel, UnsubscribeFailure> {
  const { subscriber, channel, channelId } = input;

  if (!canSubscribeChannel({ user: subscriber })) return err(channelForbidden(channelId));
  if (!channel) return err(channelNotFound(channelId));
  return ok(channel);
}
