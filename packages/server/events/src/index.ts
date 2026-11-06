import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import { z } from 'zod';
import { videoChannel } from './channels';

export * from './channels';
export * from './keys';

/** `live.status` and `live.viewers` ride the broadcast's video stream; the rest are processing. */
const VIDEO_EVENT_NAMES = [
  'snapshot',
  'progress',
  'status',
  'live.status',
  'live.viewers',
] as const;
type VideoEventName = (typeof VIDEO_EVENT_NAMES)[number];

export const SseMessageEnvelope = z.object({
  id: z.number().int().optional(),
  event: z.enum(VIDEO_EVENT_NAMES),
  data: z.record(z.string(), z.unknown()),
  ts: z.number().int().optional(),
});
export type SseMessageEnvelope = z.infer<typeof SseMessageEnvelope>;

export interface PublishVideoEventOptions {
  cache: {
    publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>>;
  };
  videoId: string;
  event: VideoEventName;
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

export function formatSseFrame(options: {
  id?: number | string;
  event?: string;
  data?: unknown;
}): string {
  let frame = '';
  if (options.id !== undefined && options.id !== null) {
    frame += `id: ${options.id}\n`;
  }
  if (options.event) {
    frame += `event: ${options.event}\n`;
  }
  if (options.data !== undefined) {
    frame += `data: ${typeof options.data === 'string' ? options.data : JSON.stringify(options.data)}\n`;
  }
  frame += '\n';
  return frame;
}

export const SSE_PING_COMMENT = ': ping\n\n';
