import { type Result, err, ok } from '@kit/result';
import {
  BLUR_MAX_STRENGTH,
  BLUR_MIN_MS,
  BLUR_MIN_STRENGTH,
  type BlurRegion,
  MAX_BLURS,
  TRIM_MIN_MS,
  type TimeRange,
  type VideoEditList,
} from '@vp/domain';
import { type InvalidVideoEdit, invalidVideoEdit } from './failures';

const within = (range: TimeRange, durationMs: number, minMs: number) =>
  range.startMs >= 0 && range.endMs <= durationMs && range.endMs - range.startMs >= minMs;

const share = (value: number) => value >= 0 && value <= 1;

function blurFits(blur: BlurRegion, durationMs: number): boolean {
  return (
    within(blur, durationMs, BLUR_MIN_MS) &&
    [blur.x, blur.y, blur.x + blur.w, blur.y + blur.h].every(share) &&
    blur.w > 0 &&
    blur.h > 0 &&
    Number.isInteger(blur.strength) &&
    blur.strength >= BLUR_MIN_STRENGTH &&
    blur.strength <= BLUR_MAX_STRENGTH
  );
}

/**
 * An edit list over the base generation's timeline: a trim that leaves at least a second, and up to
 * twenty blurred regions inside the frame and the video. An edit that changes nothing is refused;
 * reverting is how a creator goes back.
 */
export function decideVideoEdit(
  input: VideoEditList,
  context: { readonly durationMs: number }
): Result<VideoEditList, InvalidVideoEdit> {
  const { trim, blurs } = input;
  if (trim && !within(trim, context.durationMs, TRIM_MIN_MS)) {
    return err(
      invalidVideoEdit('trim', `A trim stays inside the video and keeps ${TRIM_MIN_MS} ms of it`)
    );
  }
  if (blurs.length > MAX_BLURS) {
    return err(invalidVideoEdit('blurs', `An edit holds at most ${MAX_BLURS} blurs`));
  }
  if (!blurs.every((blur) => blurFits(blur, context.durationMs))) {
    return err(
      invalidVideoEdit(
        'blurs',
        `A blur runs at least ${BLUR_MIN_MS} ms inside the video, covers a region inside the frame and has a strength of ${BLUR_MIN_STRENGTH} to ${BLUR_MAX_STRENGTH}`
      )
    );
  }
  if (!trim && blurs.length === 0) {
    return err(invalidVideoEdit('trim', 'An edit trims or blurs something'));
  }
  return ok({ trim, blurs });
}
