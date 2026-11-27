export const BLUR_SHAPES = ['rect', 'ellipse'] as const;
type BlurShape = (typeof BLUR_SHAPES)[number];

export const MAX_BLURS = 20;
export const BLUR_MIN_STRENGTH = 1;
export const BLUR_MAX_STRENGTH = 20;
export const BLUR_MIN_MS = 500;
/** What a trim has to leave of the video. */
export const TRIM_MIN_MS = 1_000;

export interface TimeRange {
  startMs: number;
  endMs: number;
}

/** A region of the frame, each of `x`, `y`, `w` and `h` a share of the frame from 0 to 1. */
export interface BlurRegion extends TimeRange {
  shape: BlurShape;
  x: number;
  y: number;
  w: number;
  h: number;
  strength: number;
}

/** Trim and blur ranges are on the base generation's timeline. */
export interface VideoEditList {
  trim: TimeRange | null;
  blurs: BlurRegion[];
}

export const VIDEO_EDIT_STATUSES = ['rendering', 'applied', 'failed', 'reverted'] as const;
export type VideoEditStatus = (typeof VIDEO_EDIT_STATUSES)[number];

/** `VIDEO_EDIT` in `@vp/domain-rules` is the machine over these edges; a save starts a render from any state. */
export const VIDEO_EDIT_EDGES = {
  render: { from: ['applied', 'failed', 'reverted'], to: 'rendering' },
  apply: { from: ['rendering'], to: 'applied' },
  fail: { from: ['rendering'], to: 'failed' },
  revert: { from: ['applied', 'failed'], to: 'reverted' },
} as const satisfies Record<string, { from: readonly VideoEditStatus[]; to: VideoEditStatus }>;

export interface VideoEdit extends VideoEditList {
  videoId: string;
  baseGeneration: number;
  /** The generation the edit list renders into. */
  generation: number;
  status: VideoEditStatus;
  updatedAt: Date;
}
