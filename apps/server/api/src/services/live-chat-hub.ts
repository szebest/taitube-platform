import { type LiveChatBroadcast, LiveChatBroadcastSchema } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { LiveStream } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { LIVE_CHAT_WILDCARD_CHANNEL, liveChatChannel, liveStreamIdOfChat } from '@vp/events';
import { ignore, map, type Result } from '@vp/result';
import { liveChatMode } from './live-views';
import { PatternHub, type PatternHubOptions } from './pattern-hub';

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

/** The stream chat's pattern hub: every pod hears every stream's lines and writes its own sockets'. */
export class LiveChatHub extends PatternHub<LiveChatBroadcast> {
  constructor(deps: Pick<PatternHubOptions<LiveChatBroadcast>, 'cache' | 'logger'>) {
    super({
      ...deps,
      pattern: LIVE_CHAT_WILDCARD_CHANNEL,
      keyOf: liveStreamIdOfChat,
      schema: LiveChatBroadcastSchema,
    });
  }
}
