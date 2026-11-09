import {
  type AudioTerm,
  type AudioTermHit,
  type FrameFingerprint,
  type FrameFingerprintHit,
  FingerprintRepository,
} from '@vp/core/repositories';
import { frameBands } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

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
    excludeVideoId: string
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>> {
    const wanted = Array.from({ length: 4 }, () => new Set<number>());
    for (const hash of hashes) {
      for (const [position, band] of frameBands(hash).entries()) wanted[position]?.add(band);
    }
    const hits = [...this.frames]
      .filter(([videoId]) => videoId !== excludeVideoId)
      .flatMap(([videoId, frames]) =>
        frames
          .filter((frame) =>
            frameBands(frame.hash).some((band, position) => wanted[position]?.has(band))
          )
          .map((frame) => ({ videoId, ...frame }))
      );
    return ok(hits);
  }

  async findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>> {
    const wanted = new Set(terms);
    const hits = [...this.audio]
      .filter(([videoId]) => videoId !== excludeVideoId)
      .flatMap(([videoId, stored]) =>
        stored.filter((term) => wanted.has(term.term)).map((term) => ({ videoId, ...term }))
      );
    return ok(hits);
  }

  async audioTermsOf(videoId: string): Promise<Result<AudioTerm[], DatabaseUnavailable>> {
    return ok([...(this.audio.get(videoId) ?? [])].sort((a, b) => a.idx - b.idx));
  }

  clear(): void {
    this.frames.clear();
    this.audio.clear();
  }
}
