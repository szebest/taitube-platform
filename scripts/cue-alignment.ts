export interface Span {
  startMs: number;
  endMs: number;
}

export interface AlignmentReport {
  cues: number;
  utterances: number;
  maxStartDeviationMs: number;
  maxEndDeviationMs: number;
  failures: string[];
}

const overlaps = (a: Span, b: Span): boolean => a.startMs < b.endMs && b.startMs < a.endMs;

function nearest(edges: readonly number[], at: number): { edge: number; distance: number } {
  let best = { edge: at, distance: Number.POSITIVE_INFINITY };
  for (const edge of edges) {
    const distance = Math.abs(edge - at);
    if (distance < best.distance) best = { edge, distance };
  }
  return best;
}

/**
 * Checks cues against the spans where the media really holds speech. A cue may span several
 * utterances, so each cue edge must sit on a speech edge within `toleranceMs`, every utterance must
 * lie inside a cue, no cue may sit over silence and the cues must stay in order.
 */
export function compareCues(
  utterances: readonly Span[],
  cues: readonly Span[],
  toleranceMs: number
): AlignmentReport {
  const failures: string[] = [];
  const starts = utterances.map((utterance) => utterance.startMs);
  const ends = utterances.map((utterance) => utterance.endMs);
  let maxStartDeviationMs = 0;
  let maxEndDeviationMs = 0;

  for (const [index, cue] of cues.entries()) {
    if (!utterances.some((utterance) => overlaps(cue, utterance))) {
      failures.push(`cue ${index} (${cue.startMs}-${cue.endMs} ms) overlaps no utterance`);
      continue;
    }
    const start = nearest(starts, cue.startMs);
    const end = nearest(ends, cue.endMs);
    maxStartDeviationMs = Math.max(maxStartDeviationMs, start.distance);
    maxEndDeviationMs = Math.max(maxEndDeviationMs, end.distance);
    if (start.distance > toleranceMs) {
      failures.push(
        `cue ${index} starts at ${cue.startMs} ms, ${start.distance} ms from the nearest speech start at ${start.edge} ms`
      );
    }
    if (end.distance > toleranceMs) {
      failures.push(
        `cue ${index} ends at ${cue.endMs} ms, ${end.distance} ms from the nearest speech end at ${end.edge} ms`
      );
    }
    const previous = cues[index - 1];
    if (previous && cue.startMs < previous.startMs) {
      failures.push(
        `cue ${index} starts at ${cue.startMs} ms, before cue ${index - 1} at ${previous.startMs} ms`
      );
    }
  }

  for (const [index, utterance] of utterances.entries()) {
    const covered = cues.some(
      (cue) =>
        cue.startMs <= utterance.startMs + toleranceMs && cue.endMs >= utterance.endMs - toleranceMs
    );
    if (!covered) {
      failures.push(
        `utterance ${index} (${utterance.startMs}-${utterance.endMs} ms) is not covered by a cue`
      );
    }
  }

  return {
    cues: cues.length,
    utterances: utterances.length,
    maxStartDeviationMs,
    maxEndDeviationMs,
    failures,
  };
}
