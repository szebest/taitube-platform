import { CANONICAL_LADDER, type LadderEntry } from '@vp/job-contracts';

export interface ProbeDimensions {
  effectiveWidth: number;
  effectiveHeight: number;
}

/**
 * Selects renditions for a given video (SDD §8.1).
 * Never upscales: keeps candidate rungs with height <= sourceHeight.
 * Always retains at least the smallest rung (480p).
 */
export function selectLadder(dims: ProbeDimensions): LadderEntry[] {
  const ladder = CANONICAL_LADDER.filter((rung) => rung.height <= dims.effectiveHeight);
  const kept = ladder.length > 0 ? ladder : CANONICAL_LADDER.slice(-1);

  return kept.map((rung) => ({ ...rung }));
}
