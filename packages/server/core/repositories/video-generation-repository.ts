import type { Result } from '@kit/result';
import type { GenerationPlayback, VideoEdit, VideoEditList, VideoGeneration } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NewOutboxInput } from './outbox-repository';

export interface OpenReplacementInput {
  videoId: string;
  generation: number;
  replacesGeneration: number;
  sourceKey: string;
  /** When the presigned upload lapses; housekeeping fails the generation after it. */
  uploadExpiresAt: Date;
}

export interface SaveEditInput {
  videoId: string;
  generation: number;
  baseGeneration: number;
  replacesGeneration: number;
  edit: VideoEditList;
  outbox: NewOutboxInput;
}

/** A render swaps in under the token it claimed with; a revert under the video version the creator saw. */
type SwapClaim =
  | { type: 'render'; lockToken: string; playback: GenerationPlayback }
  | { type: 'revert'; expectedVersion: number };

export interface SwapGenerationInput {
  videoId: string;
  generation: number;
  claim: SwapClaim;
  now: Date;
}

/**
 * `fenced`: the render no longer holds the generation (a retry already swapped it, or another claim took
 * it). `superseded`: the video moved on (it is no longer `READY`, plays another generation, or its version
 * changed), so nothing was written.
 */
export type SwapOutcome =
  | { type: 'swapped'; version: number }
  | { type: 'fenced' }
  | { type: 'superseded' };

/**
 * A video's generations and its edit list. Every write that moves a generation is a compare-and-set on
 * its status, and the swap is one transaction over the video, both generation rows, the chapters,
 * corrections, retention steps, the edit list and the `video.replaced` event.
 */
export abstract class VideoGenerationRepository {
  /** Newest first. */
  abstract list(videoId: string): Promise<Result<VideoGeneration[], DatabaseUnavailable>>;
  abstract findEdit(videoId: string): Promise<Result<VideoEdit | null, DatabaseUnavailable>>;
  /** `false` when another generation of the video is already uploading or rendering. */
  abstract openReplacement(
    input: OpenReplacementInput
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Moves an uploaded replacement to `rendering` with the outbox row that queues it; `false` when it was not uploading. */
  abstract startRender(
    videoId: string,
    generation: number,
    outbox: NewOutboxInput
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Writes the edit list and its `rendering` generation with the outbox row; `false` when another is in flight. */
  abstract saveEdit(input: SaveEditInput): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Hands a `rendering` generation to the render holding `lockToken`; `null` when it is rendering no more. */
  abstract claim(
    videoId: string,
    generation: number,
    lockToken: string
  ): Promise<Result<VideoGeneration | null, DatabaseUnavailable>>;
  abstract swap(input: SwapGenerationInput): Promise<Result<SwapOutcome, DatabaseUnavailable>>;
  /** Fails an uploading or rendering generation and the edit list rendering into it; the video is untouched. */
  abstract fail(
    videoId: string,
    generation: number,
    errorCode: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Retired generations past their grace and uploads past their expiry, oldest first. */
  abstract listDue(
    now: Date,
    limit: number
  ): Promise<Result<VideoGeneration[], DatabaseUnavailable>>;
  /**
   * Marks a retired generation purged. Purging an edit list's base bakes the list into what plays now:
   * the list empties and further edits render from the current generation.
   */
  abstract markPurged(
    videoId: string,
    generation: number
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
