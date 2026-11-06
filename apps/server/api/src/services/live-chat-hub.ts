import { type LiveChatBroadcast, LiveChatBroadcastSchema } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { LiveStream } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { LIVE_CHAT_WILDCARD_CHANNEL, liveChatChannel, liveStreamIdOfChat } from '@vp/events';
import type { Logger } from '@vp/logger';
import { ignore, isErr, map, parseJson, type Result } from '@vp/result';
import { liveChatMode } from './live-views';

type Listener = (event: LiveChatBroadcast) => void;

export async function publishLiveChat(
  cache: Pick<CacheClient, 'publish'>,
  liveStreamId: string,
  event: LiveChatBroadcast
): Promise<Result<void, CacheUnavailable>> {
  return map(
    await cache.publish(liveChatChannel(liveStreamId), JSON.stringify(event)),
    () => undefined
  );
}

/** A changed chat mode reaches the sockets open on the stream; senders are held to it either way. */
export async function announceChatMode(
  cache: Pick<CacheClient, 'publish'>,
  stream: LiveStream
): Promise<void> {
  ignore(
    await publishLiveChat(cache, stream.id, { type: 'mode', mode: liveChatMode(stream) }),
    'the mode is stored, and a socket that missed it is held to it on its next line anyway'
  );
}

export class LiveChatHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private subscribing: Promise<Result<void, CacheUnavailable>> | undefined;
  private readonly onMessage = (_pattern: string, channel: string, raw: string) => {
    this.deliver(channel, raw);
  };

  constructor(
    private readonly deps: {
      cache: Pick<CacheClient, 'psubscribe' | 'punsubscribe'>;
      logger: Logger;
    }
  ) {}

  /** Idempotent, and retried by the next caller after a failure. */
  async init(): Promise<Result<void, CacheUnavailable>> {
    this.subscribing ??= this.deps.cache.psubscribe(LIVE_CHAT_WILDCARD_CHANNEL, this.onMessage);
    const subscribed = await this.subscribing;
    if (isErr(subscribed)) this.subscribing = undefined;
    return subscribed;
  }

  join(liveStreamId: string, listener: Listener): () => void {
    const listeners = new Set(this.listeners.get(liveStreamId)).add(listener);
    this.listeners.set(liveStreamId, listeners);
    return () => {
      const remaining = new Set(this.listeners.get(liveStreamId));
      remaining.delete(listener);
      if (remaining.size === 0) this.listeners.delete(liveStreamId);
      else this.listeners.set(liveStreamId, remaining);
    };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    if (!this.subscribing) return;
    this.subscribing = undefined;
    ignore(
      await this.deps.cache.punsubscribe(LIVE_CHAT_WILDCARD_CHANNEL, this.onMessage),
      'a cache that is already gone has nothing to unsubscribe from'
    );
  }

  private deliver(channel: string, raw: string): void {
    const liveStreamId = liveStreamIdOfChat(channel);
    const listeners = liveStreamId === null ? undefined : this.listeners.get(liveStreamId);
    if (!listeners) return;

    const decoded = parseJson(raw);
    const event = isErr(decoded) ? null : LiveChatBroadcastSchema.safeParse(decoded.value);
    if (!event?.success) {
      this.deps.logger.warn({ channel }, 'dropped a chat broadcast the contract does not know');
      return;
    }
    for (const listener of listeners) listener(event.data);
  }
}
