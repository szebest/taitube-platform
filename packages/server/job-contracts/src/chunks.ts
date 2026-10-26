export const CHUNKED_TRANSCODE = { thresholdSeconds: 300, chunkSeconds: 30 } as const;

export function chunkCountFor(durationMs: number): number | undefined {
  if (durationMs <= CHUNKED_TRANSCODE.thresholdSeconds * 1000) return undefined;
  return Math.ceil(durationMs / (CHUNKED_TRANSCODE.chunkSeconds * 1000));
}

export const CAPTIONS_CHUNKED = {
  thresholdSeconds: 300,
  windowSeconds: 180,
  overlapSeconds: 5,
} as const;

/**
 * The audio one captions window transcribes (`startMs`, `durationMs`, with the overlap) and the cues
 * it keeps (`ownsFromMs` up to `ownsUntilMs`): a cue belongs to the window its start falls in, so the
 * overlap neither duplicates a cue nor cuts a sentence.
 */
export interface CaptionsWindow {
  index: number;
  startMs: number;
  durationMs: number;
  ownsFromMs: number;
  ownsUntilMs: number;
}

export function captionsWindowCountFor(durationMs: number): number | undefined {
  if (durationMs <= CAPTIONS_CHUNKED.thresholdSeconds * 1000) return undefined;
  return Math.ceil(durationMs / (CAPTIONS_CHUNKED.windowSeconds * 1000));
}

export function captionsWindow(index: number, count: number, durationMs: number): CaptionsWindow {
  const windowMs = CAPTIONS_CHUNKED.windowSeconds * 1000;
  const overlapMs = CAPTIONS_CHUNKED.overlapSeconds * 1000;
  const ownsFromMs = index * windowMs;
  const last = index === count - 1;
  const startMs = Math.max(0, ownsFromMs - overlapMs);
  const endMs = last ? durationMs : Math.min(durationMs, ownsFromMs + windowMs + overlapMs);

  return {
    index,
    startMs,
    durationMs: endMs - startMs,
    ownsFromMs: index === 0 ? 0 : ownsFromMs,
    ownsUntilMs: last ? Number.POSITIVE_INFINITY : ownsFromMs + windowMs,
  };
}
