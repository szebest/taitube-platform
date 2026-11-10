import {
  type AudioTerm,
  type AudioTermHit,
  type FingerprintLookupLimits,
  FingerprintRepository,
  type FrameFingerprint,
  type FrameFingerprintHit,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

/** Answers a band lookup with every stored frame, which the matcher's exact check then narrows. */
export class FingerprintDouble extends FingerprintRepository {
  readonly frames = new Map<string, readonly FrameFingerprint[]>();
  readonly audio = new Map<string, readonly AudioTerm[]>();
  audioReads: string[] = [];
  lookups: FingerprintLookupLimits[] = [];

  async storeFrames(
    videoId: string,
    frames: readonly FrameFingerprint[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.frames.set(videoId, frames);
    return ok();
  }

  async storeAudio(
    videoId: string,
    terms: readonly AudioTerm[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.audio.set(videoId, terms);
    return ok();
  }

  async findFramesSharingBand(
    _hashes: readonly bigint[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>> {
    this.lookups.push(limits);
    return ok(
      [...this.frames]
        .filter(([videoId]) => videoId !== excludeVideoId)
        .flatMap(([videoId, frames]) => frames.map((frame) => ({ videoId, ...frame })))
    );
  }

  async findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>> {
    this.lookups.push(limits);
    const wanted = new Set(terms);
    return ok(
      [...this.audio]
        .filter(([videoId]) => videoId !== excludeVideoId)
        .flatMap(([videoId, stored]) =>
          stored.filter(({ term }) => wanted.has(term)).map((entry) => ({ videoId, ...entry }))
        )
    );
  }

  async audioTermsOf(videoId: string): Promise<Result<AudioTerm[], DatabaseUnavailable>> {
    this.audioReads.push(videoId);
    return ok([...(this.audio.get(videoId) ?? [])]);
  }

  async deleteForVideo(videoId: string): Promise<Result<void, DatabaseUnavailable>> {
    this.frames.delete(videoId);
    this.audio.delete(videoId);
    return ok();
  }
}
