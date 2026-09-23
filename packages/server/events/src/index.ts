import type { CacheUnavailable } from '@vp/errors';
import { type Result, all, map } from '@vp/result';
import { z } from 'zod';

export { SseEvent } from '@vp/job-contracts';

export function videoChannel(videoId: string): string {
  return `video:${videoId}`;
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

export const VIDEO_WILDCARD_CHANNEL = 'video:*';
export const USER_WILDCARD_CHANNEL = 'user:*';

export const SseMessageEnvelope = z.object({
  id: z.number().int().optional(),
  event: z.enum(['snapshot', 'progress', 'status']),
  data: z.record(z.unknown()),
  ts: z.number().int().optional(),
});
export type SseMessageEnvelope = z.infer<typeof SseMessageEnvelope>;

export interface PublishVideoEventOptions {
  cache: {
    publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>>;
  };
  videoId: string;
  userId?: string;
  event: 'snapshot' | 'progress' | 'status';
  data: Record<string, unknown>;
  id?: number;
  ts: number;
}

/** Publishes to the video's channel and its owner's; a channel that refused is the caller's call. */
export async function publishVideoEvent(
  options: PublishVideoEventOptions
): Promise<Result<number, CacheUnavailable>> {
  const { cache, videoId, userId, event, data, id, ts } = options;
  const payload: SseMessageEnvelope = {
    event,
    data,
    ...(id !== undefined ? { id } : {}),
    ts,
  };
  const message = JSON.stringify(payload);
  const channels = [videoChannel(videoId)];
  if (userId) {
    channels.push(userChannel(userId));
  }
  const published = await Promise.all(channels.map((ch) => cache.publish(ch, message)));
  return map(all(published), (receivers) => receivers.reduce((sum, count) => sum + count, 0));
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
