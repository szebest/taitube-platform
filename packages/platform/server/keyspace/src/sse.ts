import { z } from 'zod';

const VIDEO_EVENT_NAMES = [
  'snapshot',
  'progress',
  'status',
  'live.status',
  'live.viewers',
] as const;

export const SseMessageEnvelope = z.object({
  id: z.number().int().optional(),
  event: z.enum(VIDEO_EVENT_NAMES),
  data: z.record(z.string(), z.unknown()),
  ts: z.number().int().optional(),
});
export type SseMessageEnvelope = z.infer<typeof SseMessageEnvelope>;

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
