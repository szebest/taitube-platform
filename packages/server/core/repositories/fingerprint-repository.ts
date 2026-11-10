import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** A frame's position in the video's sample sequence and its 64-bit dHash. */
export interface FrameFingerprint {
  idx: number;
  hash: bigint;
}

export interface FrameFingerprintHit extends FrameFingerprint {
  videoId: string;
}

/** One Chromaprint term; `idx` is its position in the full sequence, the stored ones a subsample. */
export interface AudioTerm {
  idx: number;
  term: number;
}

export interface AudioTermHit extends AudioTerm {
  videoId: string;
}

/**
 * What keeps a lookup bounded. A band or term with fewer than `minBandSetBits` or `minTermSetBits`
 * set (or clear) bits is left out of the query, and the answer holds at most `maxHitsPerKey` rows for
 * each band or term that was queried.
 */
export interface FingerprintLookupLimits {
  minBandSetBits: number;
  minTermSetBits: number;
  maxHitsPerKey: number;
}

/**
 * The derived data the duplicate check reads, per video and nowhere else: frame hashes behind a band
 * index and a subsample of audio terms behind a term index. A lookup returns candidates, rows that
 * share a band or a term; the exact distance and the vote on an offset are the caller's.
 */
export abstract class FingerprintRepository {
  /**
   * Replaces whatever the video had stored, so a re-run leaves one set. One statement per call: an hour
   * of video is 1 800 frames and a few thousand audio rows, far under the driver's parameter limit.
   */
  abstract storeFrames(
    videoId: string,
    frames: readonly FrameFingerprint[]
  ): Promise<Result<void, DatabaseUnavailable>>;
  abstract storeAudio(
    videoId: string,
    terms: readonly AudioTerm[]
  ): Promise<Result<void, DatabaseUnavailable>>;

  /** Stored frames of another video that agree with any of the hashes on at least one band. */
  abstract findFramesSharingBand(
    hashes: readonly bigint[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>>;
  /** Stored terms of another video equal to one of `terms`. */
  abstract findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>>;
  /** A video's stored terms, in position order. */
  abstract audioTermsOf(videoId: string): Promise<Result<AudioTerm[], DatabaseUnavailable>>;
  /** Removes everything stored for the video, as a purge of a deleted video does. */
  abstract deleteForVideo(videoId: string): Promise<Result<void, DatabaseUnavailable>>;
}
