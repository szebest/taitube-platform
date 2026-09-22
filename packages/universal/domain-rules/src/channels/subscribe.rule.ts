import type { Channel } from '@vp/domain';
import { type UserContext, canSubscribeChannel } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import {
  type SubscribeFailure,
  cannotSubscribeToSelf,
  channelForbidden,
} from './failures.js';

export interface SubscribeInput {
  readonly subscriber: UserContext | null;
  readonly channel: Channel;
}

export function decideSubscribe(input: SubscribeInput): Result<Channel, SubscribeFailure> {
  const { subscriber, channel } = input;

  if (!canSubscribeChannel({ user: subscriber })) return err(channelForbidden(channel.id));
  if (subscriber?.id === channel.userId) return err(cannotSubscribeToSelf(channel.id));
  return ok(channel);
}
