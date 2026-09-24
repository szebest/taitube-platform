import { z } from 'zod';
import { LadderEntry, RENDITIONS, type RenditionName } from './ladder';

export * from './ladder';
export * from './policies';

export const QUEUES = [
  'probe',
  'transcode-1080p',
  'transcode-720p',
  'transcode-480p',
  'thumbnail',
  'package',
  'notify',
  'housekeeping',
  'dlq',
] as const;
export type QueueName = (typeof QUEUES)[number];

const Base = z.object({
  videoId: z.string().uuid(),
  generation: z.number().int().min(1),
  traceparent: z.string(),
});

export const ProbeJob = Base.extend({
  sourceKey: z.string(),
});
export type ProbeJob = z.infer<typeof ProbeJob>;

export const TranscodeJob = Base.extend({
  sourceKey: z.string(),
  rendition: LadderEntry,
  fps: z.number().positive(),
  durationMs: z.number().int().positive(),
  chunkIndex: z.number().int().min(0).optional(),
  chunkCount: z.number().int().min(1).optional(),
  streamingInput: z.boolean().optional(),
});
export type TranscodeJob = z.infer<typeof TranscodeJob>;

export const ThumbnailJob = Base.extend({
  sourceKey: z.string(),
  durationMs: z.number().int().positive(),
});
export type ThumbnailJob = z.infer<typeof ThumbnailJob>;

export const PackageJob = Base.extend({
  ladder: z.array(LadderEntry).min(1),
});
export type PackageJob = z.infer<typeof PackageJob>;

export const NotifyJob = z.object({
  videoId: z.string().uuid(),
  userId: z.string().uuid(),
  event: z.enum(['video.processing', 'video.ready', 'video.failed']),
  eventSeq: z.number().int(),
  payload: z.record(z.unknown()),
  traceparent: z.string(),
});
export type NotifyJob = z.infer<typeof NotifyJob>;

export const HousekeepingJob = z.object({
  task: z.enum([
    'reconcile-uploads',
    'reconcile-processing',
    'purge-deleted',
    'expire-raw',
    'tmp-sweep',
    'reconcile-reaction-counters',
  ]),
});
export type HousekeepingJob = z.infer<typeof HousekeepingJob>;

export const DlqJob = z.object({
  originQueue: z.enum(QUEUES),
  originJobId: z.string(),
  payload: z.unknown(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    unrecoverable: z.boolean(),
  }),
  attemptsMade: z.number().int(),
  workerId: z.string(),
  failedAt: z.string().datetime(),
});
export type DlqJob = z.infer<typeof DlqJob>;

// Return values
export const TranscodeResult = z.object({
  type: z.literal('transcode'),
  rendition: z.enum(RENDITIONS),
  playlistKey: z.string(),
  segmentCount: z.number().int(),
  bytes: z.number().int(),
  durationMs: z.number().int(),
  avgBitrateBps: z.number().int(),
  processingMs: z.number().int(),
});
export type TranscodeResult = z.infer<typeof TranscodeResult>;

export const ThumbnailResult = z.object({
  type: z.literal('thumbnail'),
  posterKey: z.string(),
  spriteKey: z.string(),
  spriteVttKey: z.string(),
});
export type ThumbnailResult = z.infer<typeof ThumbnailResult>;

/** What a package job reads back from its flow children, told apart by the stage that wrote it. */
export const ChildResult = z.discriminatedUnion('type', [TranscodeResult, ThumbnailResult]);
export type ChildResult = z.infer<typeof ChildResult>;

// Deterministic job IDs
export const ids = {
  probe: (v: string, g: number) => `${v}--probe--g${g}`,
  transcode: (v: string, r: RenditionName, g: number) => `${v}--transcode--${r}--g${g}`,
  thumbnail: (v: string, g: number) => `${v}--thumbnail--g${g}`,
  package: (v: string, g: number) => `${v}--package--g${g}`,
  notify: (v: string, e: string, seq: number) => `${v}--notify--${e}--${seq}`,
  dlq: (q: string, j: string, a: number) => `${q}--${j}--a${a}`,
  replay: (original: string, n: number) => `${original}--r${n}`,
};

export function generateReplayJobId(originalJobId: string): string {
  const match = originalJobId.match(/--r(\d+)$/);
  if (match?.[1]) {
    const nextNum = Number.parseInt(match[1], 10) + 1;
    return originalJobId.replace(/--r\d+$/, `--r${nextNum}`);
  }
  return `${originalJobId}--r1`;
}
