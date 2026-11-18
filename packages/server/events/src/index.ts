import type { Result } from '@kit/result';
import type { CacheUnavailable } from '@vp/errors';
import { videoChannel } from './channels';
import type { SseMessageEnvelope } from './sse';

export * from './channels';
export * from './keys';
export * from './sse';

export interface PublishVideoEventOptions {
  cache: {
    publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>>;
  };
  videoId: string;
  event: SseMessageEnvelope['event'];
  data: Record<string, unknown>;
  id?: number;
  ts: number;
}

/** Publishes on the video's channel; its owner hears the status through the `user_events` log. */
export async function publishVideoEvent(
  options: PublishVideoEventOptions
): Promise<Result<number, CacheUnavailable>> {
  const { cache, videoId, event, data, id, ts } = options;
  const payload: SseMessageEnvelope = {
    event,
    data,
    ...(id !== undefined ? { id } : {}),
    ts,
  };
  return cache.publish(videoChannel(videoId), JSON.stringify(payload));
}
