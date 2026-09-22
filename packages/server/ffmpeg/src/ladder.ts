import type { LadderEntry } from '@vp/job-contracts';

/**
 * Authoritative HLS rendition ladder matching SDD §8.1.
 * Bitrates and profiles follow Apple HLS Authoring Specifications.
 */
export const CANONICAL_LADDER: readonly LadderEntry[] = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoKbps: 5000,
    maxrateKbps: 5350,
    bufsizeKbps: 7500,
    audioKbps: 128,
    profile: 'high',
    level: '4.1',
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    videoKbps: 2800,
    maxrateKbps: 2996,
    bufsizeKbps: 4200,
    audioKbps: 128,
    profile: 'high',
    level: '3.1',
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    videoKbps: 1400,
    maxrateKbps: 1498,
    bufsizeKbps: 2100,
    audioKbps: 96,
    profile: 'main',
    level: '3.1',
  },
] as const;

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
  const sourceHeight = dims.effectiveHeight;

  // Filter out rungs taller than the source
  const ladder = CANONICAL_LADDER.filter((rung) => rung.height <= sourceHeight);

  // Always keep at least the lowest rung (SDD §8.1, AC 17 for sd360)
  if (ladder.length === 0) {
    const smallestRung = CANONICAL_LADDER[CANONICAL_LADDER.length - 1];
    if (smallestRung) {
      return [{ ...smallestRung }];
    }
  }

  return ladder.map((rung) => ({ ...rung }));
}
