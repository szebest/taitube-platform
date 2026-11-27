import type { AudioTerm, AudioTermHit } from '@vp/core/repositories';
import { CHROMAPRINT_ITEM_SECONDS, TERM_BITS, bitErrors } from './audio-terms';
import { type VotePair, longestRun, voteOffset } from './offset-vote';

export interface AudioMatch {
  /** Aligned terms within the bit-error limit, over the new video's terms. */
  coverage: number;
  /** Mean share of differing bits over the terms in the longest matching run. */
  bitErrorRate: number;
  longestRunSeconds: number;
  runFromSeconds: number;
  runToSeconds: number;
}

/** The candidates the term lookup voted for most; only these have their stored terms read back. */
const MAX_VERIFIED_CANDIDATES = 20;

export interface AlignedAudio {
  videoId: string;
  offset: number;
  votes: number;
}

/**
 * A candidate's stored terms equal to some term of the new video vote on an offset; returns who won
 * it and by how many votes. Every term of the new video is looked up, because only the stored side
 * is a subsample: the two would otherwise line up on one offset in `stride`. Bit errors come after,
 * against the stored terms.
 */
export function alignAudio(
  queryTerms: readonly number[],
  hits: readonly AudioTermHit[]
): AlignedAudio[] {
  const positions = new Map<number, number[]>();
  for (const [idx, term] of queryTerms.entries()) {
    positions.set(term, [...(positions.get(term) ?? []), idx]);
  }
  const byVideo = new Map<string, VotePair[]>();
  for (const hit of hits) {
    const pairs = byVideo.get(hit.videoId) ?? [];
    for (const queryIdx of positions.get(hit.term) ?? []) {
      pairs.push({ queryIdx, matchIdx: hit.idx });
    }
    byVideo.set(hit.videoId, pairs);
  }

  const aligned: AlignedAudio[] = [];
  for (const [videoId, pairs] of byVideo) {
    const vote = voteOffset(pairs);
    if (vote) aligned.push({ videoId, offset: vote.offset, votes: vote.queryIdxs.length });
  }
  return aligned.sort((a, b) => b.votes - a.votes).slice(0, MAX_VERIFIED_CANDIDATES);
}

/**
 * Compares the new video's terms with a candidate's stored ones at the aligned offset. Each stored
 * term stands for `stride` terms, so a matching one counts that many towards the coverage.
 */
export function verifyAudio(
  queryTerms: readonly number[],
  stored: readonly AudioTerm[],
  offset: number,
  options: { maxBitErrorRate: number; stride: number }
): AudioMatch | null {
  const compared = stored
    .map((entry) => ({ queryIdx: entry.idx - offset, term: entry.term }))
    .filter(({ queryIdx }) => queryIdx >= 0 && queryIdx < queryTerms.length)
    .map(({ queryIdx, term }) => ({
      queryIdx,
      rate: bitErrors(queryTerms[queryIdx] as number, term) / TERM_BITS,
    }));
  const matching = compared.filter(({ rate }) => rate <= options.maxBitErrorRate);
  const run = longestRun(matching.map(({ queryIdx }) => Math.floor(queryIdx / options.stride)));
  if (!run) return null;

  const inRun = matching.filter(({ queryIdx }) => {
    const slot = Math.floor(queryIdx / options.stride);
    return slot >= run.startIdx && slot <= run.endIdx;
  });
  const secondsPerSlot = options.stride * CHROMAPRINT_ITEM_SECONDS;
  return {
    coverage: Math.min(1, (matching.length * options.stride) / queryTerms.length),
    bitErrorRate: inRun.reduce((sum, { rate }) => sum + rate, 0) / inRun.length,
    longestRunSeconds: run.length * secondsPerSlot,
    runFromSeconds: run.startIdx * secondsPerSlot,
    runToSeconds: (run.endIdx + 1) * secondsPerSlot,
  };
}
