import type { Chapter } from './chapters';
import type { RetentionPoint } from './retention';

/** `upload` is the file a video was created from; the others are rendered while the video stays `READY`. */
export const GENERATION_KINDS = ['upload', 'replacement', 'edit'] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

export const GENERATION_STATUSES = [
  'uploading',
  'rendering',
  'failed',
  'active',
  'retired',
  'purged',
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/**
 * `VIDEO_GENERATION` in `@vp/domain-rules` is the machine over these edges. `swap` and `restore` are one
 * compare-and-set on the video: the generation coming in turns `active` as the one going out turns `retired`.
 */
export const VIDEO_GENERATION_EDGES = {
  render: { from: ['uploading'], to: 'rendering' },
  swap: { from: ['rendering'], to: 'active' },
  fail: { from: ['uploading', 'rendering'], to: 'failed' },
  retire: { from: ['active'], to: 'retired' },
  restore: { from: ['retired'], to: 'active' },
  purge: { from: ['retired'], to: 'purged' },
} as const satisfies Record<string, { from: readonly GenerationStatus[]; to: GenerationStatus }>;

/** Players holding the old master finish the video they started before its renditions go. */
export const RETIRED_GENERATION_GRACE_MS = 24 * 60 * 60 * 1000;
/** The raw source expires after 7 days, so an edit renders from the base generation, kept this long after the last edit. */
export const EDIT_BASE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
/** A replacement whose duration moves further than this flags the timed extras for review. */
const TIMELINE_DRIFT_MS = 2_000;

export interface TimedCorrection {
  startMs: number;
  endMs: number;
  text: string;
}

/** The chapters and corrections a generation was watched with, kept so a swap back restores them. */
export interface GenerationTimeline {
  chapters: Chapter[];
  corrections: TimedCorrection[];
}

/** What the video plays while a generation is active, copied onto the video by the swap. */
export interface GenerationPlayback {
  masterPlaylistKey: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number | null;
  ladder: unknown;
}

export interface VideoGeneration {
  videoId: string;
  generation: number;
  kind: GenerationKind;
  status: GenerationStatus;
  /** The uploaded file of a replacement; `null` for an edit and for a generation recorded at a swap. */
  sourceKey: string | null;
  /** The generation an edit renders from. */
  baseGeneration: number | null;
  /** The generation playing when the render started, so the swap lands only while it still is; a row recorded at a swap names itself. */
  replacesGeneration: number;
  playback: GenerationPlayback | null;
  timeline: GenerationTimeline | null;
  retention: RetentionPoint[] | null;
  /** The duration moved past `TIMELINE_DRIFT_MS`, so chapters, corrections and captions may be off. */
  needsReview: boolean;
  errorCode: string | null;
  purgeAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One past every generation the video has had, so a new render never writes into a live prefix. */
export function nextGeneration(current: number, known: readonly { generation: number }[]): number {
  return Math.max(current, ...known.map(({ generation }) => generation)) + 1;
}

export function drifted(beforeMs: number | null, afterMs: number): boolean {
  return beforeMs !== null && Math.abs(afterMs - beforeMs) > TIMELINE_DRIFT_MS;
}
