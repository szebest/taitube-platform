import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type InvalidClipRange, invalidClipRange } from './failures';

export interface ClipRange {
  readonly startMs: number;
  readonly endMs: number;
}

export function validateClipRange(
  range: ClipRange,
  videoDurationMs: number
): Result<ClipRange, InvalidClipRange> {
  const length = range.endMs - range.startMs;
  const valid =
    range.startMs >= 0 &&
    range.endMs <= videoDurationMs &&
    length >= CLIP_MIN_MS &&
    length <= CLIP_MAX_MS;
  return valid ? ok(range) : err(invalidClipRange(videoDurationMs));
}
