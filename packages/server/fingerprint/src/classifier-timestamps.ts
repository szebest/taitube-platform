export interface ClassifierSampling {
  classifyIntervalSeconds: number;
  classifyMaxFrames: number;
}

/** The last frame is taken this far from the end, since a frame at the exact end may not decode. */
const LAST_FRAME_MARGIN_SECONDS = 0.5;
/** Two sampled moments closer than this are one frame to the classifier. */
const MIN_GAP_SECONDS = 1;
const MILLIS = 1000;

/**
 * One moment every `classifyIntervalSeconds`, at most `classifyMaxFrames` of them spread over a long
 * video, plus the first, the middle and the last, which an even spacing can miss. Sorted, with
 * moments under a second apart merged into the earlier one.
 */
export function classifierTimestamps(
  durationSeconds: number,
  sampling: ClassifierSampling
): number[] {
  const { classifyIntervalSeconds, classifyMaxFrames } = sampling;
  const wanted = Math.floor(durationSeconds / classifyIntervalSeconds) + 1;
  const count = Math.min(wanted, classifyMaxFrames);
  const spacing =
    wanted > classifyMaxFrames ? durationSeconds / classifyMaxFrames : classifyIntervalSeconds;

  const moments = [
    ...Array.from({ length: count }, (_, index) => index * spacing),
    durationSeconds / 2,
    Math.max(0, durationSeconds - LAST_FRAME_MARGIN_SECONDS),
  ]
    .map((moment) => Math.round(moment * MILLIS) / MILLIS)
    .sort((a, b) => a - b);

  const kept: number[] = [];
  for (const moment of moments) {
    const previous = kept.at(-1);
    if (previous === undefined || moment - previous >= MIN_GAP_SECONDS) kept.push(moment);
  }
  return kept;
}
