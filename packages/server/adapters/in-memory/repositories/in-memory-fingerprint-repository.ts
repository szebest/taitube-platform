import {
  type AudioTerm,
  type AudioTermHit,
  type FrameFingerprint,
  type FingerprintLookupLimits,
  type FrameFingerprintHit,
  FingerprintRepository,
} from '@vp/core/repositories';
import { frameBands, isLowEntropy, lookupBands } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

const TERM_BITS = 32;

export class InMemoryFingerprintRepository extends FingerprintRepository {
  private readonly frames = new Map<string, readonly FrameFingerprint[]>();
  private readonly audio = new Map<string, readonly AudioTerm[]>();

  async storeFrames(
    videoId: string,
    frames: readonly FrameFingerprint[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.frames.set(videoId, [...frames]);
    return ok(undefined);
  }

  async storeAudio(
    videoId: string,
    terms: readonly AudioTerm[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.audio.set(videoId, [...terms]);
    return ok(undefined);
  }

  async findFramesSharingBand(
    hashes: readonly bigint[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>> {
    const wanted = lookupBands(hashes, limits.minBandSetBits);
    const keys = wanted.reduce((total, bands) => total + bands.size, 0);
    const hits = [...this.frames]
      .filter(([videoId]) => videoId !== excludeVideoId)
      .flatMap(([videoId, frames]) =>
        frames
          .filter((frame) =>
            frameBands(frame.hash).some((band, position) => wanted[position]?.has(band))
          )
          .map((frame) => ({ videoId, ...frame }))
      );
    return ok(hits.slice(0, keys * limits.maxHitsPerKey));
  }

  async findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>> {
    const wanted = new Set(
      terms.filter((term) => !isLowEntropy(term, TERM_BITS, limits.minTermSetBits))
    );
    const hits = [...this.audio]
      .filter(([videoId]) => videoId !== excludeVideoId)
      .flatMap(([videoId, stored]) =>
        stored.filter((term) => wanted.has(term.term)).map((term) => ({ videoId, ...term }))
      );
    return ok(hits.slice(0, wanted.size * limits.maxHitsPerKey));
  }

  async audioTermsOf(videoId: string): Promise<Result<AudioTerm[], DatabaseUnavailable>> {
    return ok([...(this.audio.get(videoId) ?? [])].sort((a, b) => a.idx - b.idx));
  }

  async deleteForVideo(videoId: string): Promise<Result<void, DatabaseUnavailable>> {
    this.frames.delete(videoId);
    this.audio.delete(videoId);
    return ok(undefined);
  }

  clear(): void {
    this.frames.clear();
    this.audio.clear();
  }
}
