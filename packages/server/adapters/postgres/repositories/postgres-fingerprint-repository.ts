import {
  type AudioTerm,
  type AudioTermHit,
  type FrameFingerprint,
  type FingerprintLookupLimits,
  type FrameFingerprintHit,
  FingerprintRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { frameBands, isLowEntropyTerm, lookupBands } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, ok } from '@vp/result';
import { and, asc, eq, inArray, ne, or } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoFrameHashes: vf, videoAudioFingerprints: va } = schema;

export class PostgresFingerprintRepository extends FingerprintRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async storeFrames(
    videoId: string,
    frames: readonly FrameFingerprint[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.delete(vf).where(eq(vf.videoId, videoId));
          if (frames.length === 0) return;
          await tx.insert(vf).values(
            frames.map(({ idx, hash }) => {
              const [b0, b1, b2, b3] = frameBands(hash);
              return { videoId, idx, hash: BigInt.asIntN(64, hash), b0, b1, b2, b3 };
            })
          );
        }),
      databaseUnavailable.during('storeFrames')
    );
  }

  async storeAudio(
    videoId: string,
    terms: readonly AudioTerm[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.delete(va).where(eq(va.videoId, videoId));
          if (terms.length === 0) return;
          await tx.insert(va).values(terms.map(({ idx, term }) => ({ videoId, idx, term })));
        }),
      databaseUnavailable.during('storeAudio')
    );
  }

  async findFramesSharingBand(
    hashes: readonly bigint[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>> {
    const wanted = lookupBands(hashes, limits.minBandSetBits);
    const keys = wanted.reduce((total, bands) => total + bands.size, 0);
    if (keys === 0) return ok([]);
    const [b0, b1, b2, b3] = wanted.map((bands) => [...bands]);
    const sharing = or(
      b0?.length ? inArray(vf.b0, b0) : undefined,
      b1?.length ? inArray(vf.b1, b1) : undefined,
      b2?.length ? inArray(vf.b2, b2) : undefined,
      b3?.length ? inArray(vf.b3, b3) : undefined
    );
    return fromPromise(async () => {
      const rows = await this.db
        .select({ videoId: vf.videoId, idx: vf.idx, hash: vf.hash })
        .from(vf)
        .where(and(ne(vf.videoId, excludeVideoId), sharing))
        .limit(keys * limits.maxHitsPerKey);
      return rows.map((row) => ({ ...row, hash: BigInt.asUintN(64, row.hash) }));
    }, databaseUnavailable.during('findFramesSharingBand'));
  }

  async findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string,
    limits: FingerprintLookupLimits
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>> {
    const wanted = [
      ...new Set(terms.filter((term) => !isLowEntropyTerm(term, limits.minTermSetBits))),
    ];
    if (wanted.length === 0) return ok([]);
    return fromPromise(
      () =>
        this.db
          .select({ videoId: va.videoId, idx: va.idx, term: va.term })
          .from(va)
          .where(and(ne(va.videoId, excludeVideoId), inArray(va.term, wanted)))
          .limit(wanted.length * limits.maxHitsPerKey),
      databaseUnavailable.during('findAudioTerms')
    );
  }

  async audioTermsOf(videoId: string): Promise<Result<AudioTerm[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({ idx: va.idx, term: va.term })
          .from(va)
          .where(eq(va.videoId, videoId))
          .orderBy(asc(va.idx)),
      databaseUnavailable.during('audioTermsOf')
    );
  }

  async deleteForVideo(videoId: string): Promise<Result<void, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.delete(vf).where(eq(vf.videoId, videoId));
          await tx.delete(va).where(eq(va.videoId, videoId));
        }),
      databaseUnavailable.during('deleteForVideo')
    );
  }
}
