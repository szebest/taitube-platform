import type { FingerprintRepository } from '@vp/core/repositories';
import type { ScreeningThresholds } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';
import { type AudioMatch, alignAudio, verifyAudio } from './audio-match';
import { audioIndexTerms } from './audio-terms';
import type { FrameSample } from './frame-hash';
import { type FrameMatch, matchFrames } from './frame-match';

export interface FingerprintMatchSettings {
  thresholds: Pick<
    ScreeningThresholds,
    'frameMaxHamming' | 'audioMaxBitErrorRate' | 'partialCoverage' | 'partialRunSeconds'
  >;
  /** Seconds between two hashed frames. */
  hashIntervalSeconds: number;
  /** Every `audioIndexStride`th Chromaprint term is stored and indexed. */
  audioIndexStride: number;
}

export interface NewVideoFingerprint {
  videoId: string;
  frames: readonly FrameSample[];
  /** The whole Chromaprint sequence; empty for a video without audio. */
  audioTerms: readonly number[];
}

export interface VideoMatch {
  videoId: string;
  /** `max(video coverage, audio coverage)`: evidence for a person, never a verdict. */
  score: number;
  video: Omit<FrameMatch, 'videoId'> | null;
  audio: AudioMatch | null;
}

type Fingerprints = Pick<
  FingerprintRepository,
  'storeFrames' | 'storeAudio' | 'findFramesSharingBand' | 'findAudioTerms' | 'audioTermsOf'
>;

/** Stores the frame hashes and the audio subsample that later uploads are looked up against. */
export async function storeFingerprint(
  fingerprints: Pick<FingerprintRepository, 'storeFrames' | 'storeAudio'>,
  fingerprint: NewVideoFingerprint,
  settings: Pick<FingerprintMatchSettings, 'audioIndexStride'>
): Promise<Result<void, DatabaseUnavailable>> {
  const frames = await fingerprints.storeFrames(
    fingerprint.videoId,
    fingerprint.frames.map((frame, idx) => ({ idx, hash: frame.hash }))
  );
  if (isErr(frames)) return frames;
  return fingerprints.storeAudio(
    fingerprint.videoId,
    audioIndexTerms(fingerprint.audioTerms, settings.audioIndexStride)
  );
}

/**
 * The stored videos a new one overlaps, strongest first: those with a score of at least
 * `partialCoverage`, or a run of at least `partialRunSeconds`. The new video's own rows are never
 * candidates.
 */
export async function findMatches(
  fingerprints: Fingerprints,
  fingerprint: NewVideoFingerprint,
  settings: FingerprintMatchSettings
): Promise<Result<VideoMatch[], DatabaseUnavailable>> {
  const { thresholds, hashIntervalSeconds, audioIndexStride } = settings;
  const { videoId, frames, audioTerms } = fingerprint;

  const frameHits = await fingerprints.findFramesSharingBand(
    frames.flatMap((frame) => [frame.hash, frame.mirroredHash]),
    videoId
  );
  if (isErr(frameHits)) return frameHits;
  const audioHits = await fingerprints.findAudioTerms([...new Set(audioTerms)], videoId);
  if (isErr(audioHits)) return audioHits;

  const byVideo = new Map<string, VideoMatch>();
  const entry = (id: string): VideoMatch => {
    const match = byVideo.get(id) ?? { videoId: id, score: 0, video: null, audio: null };
    byVideo.set(id, match);
    return match;
  };

  for (const found of matchFrames(frames, frameHits.value, {
    maxHamming: thresholds.frameMaxHamming,
    intervalSeconds: hashIntervalSeconds,
  })) {
    const { videoId: id, ...video } = found;
    entry(id).video = video;
  }

  for (const aligned of alignAudio(audioTerms, audioHits.value)) {
    const stored = await fingerprints.audioTermsOf(aligned.videoId);
    if (isErr(stored)) return stored;
    const audio = verifyAudio(audioTerms, stored.value, aligned.offset, {
      maxBitErrorRate: thresholds.audioMaxBitErrorRate,
      stride: audioIndexStride,
    });
    if (audio) entry(aligned.videoId).audio = audio;
  }

  const matches = [...byVideo.values()]
    .map((match) => ({
      ...match,
      score: Math.max(match.video?.coverage ?? 0, match.audio?.coverage ?? 0),
    }))
    .filter(
      (match) =>
        match.score >= thresholds.partialCoverage ||
        Math.max(match.video?.longestRunSeconds ?? 0, match.audio?.longestRunSeconds ?? 0) >=
          thresholds.partialRunSeconds
    )
    .sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId));
  return ok(matches);
}
