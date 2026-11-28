import type { CacheUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import { videoChannel } from './channels';
import type { SseMessageEnvelope } from './envelope';

export * from './channels';
export * from './envelope';
export * from './keys';

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
