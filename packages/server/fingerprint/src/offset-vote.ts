export interface VotePair {
  queryIdx: number;
  matchIdx: number;
}

export interface OffsetVote {
  /** `matchIdx - queryIdx` of the winning bucket: where the new video sits in the candidate. */
  offset: number;
  /** The distinct query positions that voted for it, ascending. */
  queryIdxs: number[];
}

/** An encoder that drops or repeats a frame shifts a match by one sample, so neighbours vote together. */
const OFFSET_TOLERANCE = 1;

/**
 * Each matched pair votes for the offset between the two positions; the offset with the most distinct
 * query positions behind it (neighbouring offsets count with it) is the alignment. Ties go to the
 * smaller offset, so the answer does not depend on the order of the pairs.
 */
export function voteOffset(pairs: readonly VotePair[]): OffsetVote | null {
  const byOffset = new Map<number, Set<number>>();
  for (const { queryIdx, matchIdx } of pairs) {
    const offset = matchIdx - queryIdx;
    const voters = byOffset.get(offset) ?? new Set<number>();
    voters.add(queryIdx);
    byOffset.set(offset, voters);
  }

  let best: OffsetVote | null = null;
  for (const offset of [...byOffset.keys()].sort((a, b) => a - b)) {
    const voters = new Set<number>();
    for (let near = offset - OFFSET_TOLERANCE; near <= offset + OFFSET_TOLERANCE; near++) {
      for (const queryIdx of byOffset.get(near) ?? []) voters.add(queryIdx);
    }
    if (!best || voters.size > best.queryIdxs.length) {
      best = { offset, queryIdxs: [...voters].sort((a, b) => a - b) };
    }
  }
  return best;
}

export interface Run {
  startIdx: number;
  endIdx: number;
  /** Samples from the first to the last, gaps inside the run included. */
  length: number;
}

/** A run may miss one sample between two matches: a single mismatched frame does not split a copy. */
const MAX_RUN_STEP = 2;

export function longestRun(sortedIdxs: readonly number[]): Run | null {
  let best: Run | null = null;
  let start = 0;
  for (let i = 0; i < sortedIdxs.length; i++) {
    const idx = sortedIdxs[i] as number;
    const previous = sortedIdxs[i - 1];
    if (previous !== undefined && idx - previous > MAX_RUN_STEP) start = i;
    const startIdx = sortedIdxs[start] as number;
    const length = idx - startIdx + 1;
    if (!best || length > best.length) best = { startIdx, endIdx: idx, length };
  }
  return best;
}
