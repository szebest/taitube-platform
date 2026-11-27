import type { FrameFingerprintHit } from '@vp/core/repositories';
import { frameBands, hammingDistance } from '@vp/domain';
import type { FrameSample } from './frame-hash';
import { type VotePair, longestRun, voteOffset } from './offset-vote';

export interface FrameMatch {
  videoId: string;
  /** Matched frames over the new video's frames, in the winning alignment. */
  coverage: number;
  longestRunSeconds: number;
  /** Where the longest run sits in the new video. */
  runFromSeconds: number;
  runToSeconds: number;
  /** Seconds into the candidate at which the new video's start would sit. */
  offsetSeconds: number;
  /** The copy is a left-right mirror of the candidate. */
  mirrored: boolean;
}

type Orientation = 'direct' | 'mirrored';

function bandIndex(frames: readonly FrameSample[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (const [idx, frame] of frames.entries()) {
    for (const hash of [frame.hash, frame.mirroredHash]) {
      for (const [position, band] of frameBands(hash).entries()) {
        const key = `${position}:${band}`;
        index.set(key, [...(index.get(key) ?? []), idx]);
      }
    }
  }
  return index;
}

/**
 * Which frames of the new video each stored frame agrees with, within `maxHamming`, read straight
 * and as a mirror image. Candidates come from the shared bands, the distance check is exact.
 */
function pairsByOrientation(
  frames: readonly FrameSample[],
  hits: readonly FrameFingerprintHit[],
  maxHamming: number
): Record<Orientation, VotePair[]> {
  const index = bandIndex(frames);
  const pairs: Record<Orientation, VotePair[]> = { direct: [], mirrored: [] };
  for (const hit of hits) {
    const candidates = new Set(
      frameBands(hit.hash).flatMap((band, position) => index.get(`${position}:${band}`) ?? [])
    );
    for (const queryIdx of candidates) {
      const frame = frames[queryIdx] as FrameSample;
      if (hammingDistance(frame.hash, hit.hash) <= maxHamming) {
        pairs.direct.push({ queryIdx, matchIdx: hit.idx });
      }
      if (hammingDistance(frame.mirroredHash, hit.hash) <= maxHamming) {
        pairs.mirrored.push({ queryIdx, matchIdx: hit.idx });
      }
    }
  }
  return pairs;
}

/** One match per candidate video that has any frame within reach, the better orientation of the two. */
export function matchFrames(
  frames: readonly FrameSample[],
  hits: readonly FrameFingerprintHit[],
  options: { maxHamming: number; intervalSeconds: number }
): FrameMatch[] {
  const byVideo = new Map<string, FrameFingerprintHit[]>();
  for (const hit of hits) byVideo.set(hit.videoId, [...(byVideo.get(hit.videoId) ?? []), hit]);

  const matches: FrameMatch[] = [];
  for (const [videoId, videoHits] of byVideo) {
    const pairs = pairsByOrientation(frames, videoHits, options.maxHamming);
    for (const orientation of ['direct', 'mirrored'] as const) {
      const vote = voteOffset(pairs[orientation]);
      const run = vote ? longestRun(vote.queryIdxs) : null;
      if (!vote || !run) continue;
      matches.push({
        videoId,
        coverage: vote.queryIdxs.length / frames.length,
        longestRunSeconds: run.length * options.intervalSeconds,
        runFromSeconds: run.startIdx * options.intervalSeconds,
        runToSeconds: (run.endIdx + 1) * options.intervalSeconds,
        offsetSeconds: vote.offset * options.intervalSeconds,
        mirrored: orientation === 'mirrored',
      });
    }
  }
  return strongestPerVideo(matches);
}

function strongestPerVideo(matches: readonly FrameMatch[]): FrameMatch[] {
  const best = new Map<string, FrameMatch>();
  for (const match of matches) {
    const current = best.get(match.videoId);
    if (!current || match.coverage > current.coverage) best.set(match.videoId, match);
  }
  return [...best.values()];
}
