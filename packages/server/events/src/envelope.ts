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
