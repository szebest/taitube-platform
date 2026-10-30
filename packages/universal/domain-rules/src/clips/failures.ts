import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { ErrorCodes, type Failure } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type ClipNotFound = Failure<typeof ErrorCodes.CLIP_NOT_FOUND, { clipId: string }>;

export interface ClipRangeBounds {
  readonly minMs: number;
  readonly maxMs: number;
  readonly videoDurationMs: number;
}

export type InvalidClipRange = InvalidField<ClipRangeBounds>;

export function clipNotFound(clipId: string): ClipNotFound {
  return { code: ErrorCodes.CLIP_NOT_FOUND, message: 'Clip not found', clipId };
}

export function invalidClipRange(videoDurationMs: number): InvalidClipRange {
  return invalidField(
    'range',
    `A clip runs from ${CLIP_MIN_MS / 1000} to ${CLIP_MAX_MS / 1000} seconds inside the video`,
    { minMs: CLIP_MIN_MS, maxMs: CLIP_MAX_MS, videoDurationMs }
  );
}
