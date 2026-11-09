export interface Span {
  startMs: number;
  endMs: number;
}

export interface AlignmentReport {
  cues: number;
  utterances: number;
  startOffsetMs: number;
  endOffsetMs: number;
  driftMs: number;
  maxStartDeviationMs: number;
  maxEndDeviationMs: number;
  failures: string[];
}

const overlaps = (a: Span, b: Span): boolean => a.startMs < b.endMs && b.startMs < a.endMs;

function nearestDistance(edges: readonly number[], at: number): number {
  return Math.min(...edges.map((edge) => Math.abs(edge - at)));
}

/**
 * Checks the cue track against the spans where the media really holds speech, for offset and drift
 * only: the first cue start and the last cue end must sit within `toleranceMs` of the first speech
 * start and the last speech end, and those two signed offsets may differ by at most `toleranceMs`.
 * Whisper's segments are about ten seconds long, so per-cue edges are reported, never failed.
 */
export function compareCues(
  utterances: readonly Span[],
  cues: readonly Span[],
  toleranceMs: number
): AlignmentReport {
  const failures: string[] = [];
  const firstUtterance = utterances[0];
  const lastUtterance = utterances.at(-1);
  const firstCue = cues[0];
  const lastCue = cues.at(-1);
  const report = {
    cues: cues.length,
    utterances: utterances.length,
    startOffsetMs: 0,
    endOffsetMs: 0,
    driftMs: 0,
    maxStartDeviationMs: 0,
    maxEndDeviationMs: 0,
    failures,
  };
  if (!firstUtterance || !lastUtterance || !firstCue || !lastCue) {
    failures.push('there are no cues or no speech spans to compare');
    return report;
  }

  report.startOffsetMs = firstCue.startMs - firstUtterance.startMs;
  report.endOffsetMs = lastCue.endMs - lastUtterance.endMs;
  report.driftMs = Math.abs(report.endOffsetMs - report.startOffsetMs);
  if (Math.abs(report.startOffsetMs) > toleranceMs) {
    failures.push(
      `the first cue starts at ${firstCue.startMs} ms, ${report.startOffsetMs} ms from the first speech start at ${firstUtterance.startMs} ms`
    );
  }
  if (Math.abs(report.endOffsetMs) > toleranceMs) {
    failures.push(
      `the last cue ends at ${lastCue.endMs} ms, ${report.endOffsetMs} ms from the last speech end at ${lastUtterance.endMs} ms`
    );
  }
  if (report.driftMs > toleranceMs) {
    failures.push(
      `the offset drifts by ${report.driftMs} ms across the file, from ${report.startOffsetMs} ms at the start to ${report.endOffsetMs} ms at the end`
    );
  }

  const starts = utterances.map((utterance) => utterance.startMs);
  const ends = utterances.map((utterance) => utterance.endMs);
  for (const [index, cue] of cues.entries()) {
    if (!utterances.some((utterance) => overlaps(cue, utterance))) {
      failures.push(`cue ${index} (${cue.startMs}-${cue.endMs} ms) overlaps no utterance`);
      continue;
    }
    report.maxStartDeviationMs = Math.max(
      report.maxStartDeviationMs,
      nearestDistance(starts, cue.startMs)
    );
    report.maxEndDeviationMs = Math.max(report.maxEndDeviationMs, nearestDistance(ends, cue.endMs));
    const previous = cues[index - 1];
    if (previous && cue.startMs < previous.startMs) {
      failures.push(
        `cue ${index} starts at ${cue.startMs} ms, before cue ${index - 1} at ${previous.startMs} ms`
      );
    }
  }
  return report;
}

export const describeAlignment = (report: AlignmentReport, toleranceMs: number): string =>
  `${report.cues} cues over ${report.utterances} utterances, first cue start ${report.startOffsetMs} ms off, last cue end ${report.endOffsetMs} ms off, drift ${report.driftMs} ms (tolerance ${toleranceMs} ms); per-cue edges up to ${report.maxStartDeviationMs} ms (start) and ${report.maxEndDeviationMs} ms (end) off, information only`;
