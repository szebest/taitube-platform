import {
  type AudioTerm,
  type AudioTermHit,
  type FrameFingerprint,
  type FrameFingerprintHit,
  FingerprintRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { frameBands } from '@vp/domain';
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
    excludeVideoId: string
  ): Promise<Result<FrameFingerprintHit[], DatabaseUnavailable>> {
    if (hashes.length === 0) return ok([]);
    const bands = hashes.map(frameBands);
    const sharing = or(
      inArray(vf.b0, [...new Set(bands.map((band) => band[0]))]),
      inArray(vf.b1, [...new Set(bands.map((band) => band[1]))]),
      inArray(vf.b2, [...new Set(bands.map((band) => band[2]))]),
      inArray(vf.b3, [...new Set(bands.map((band) => band[3]))])
    );
    return fromPromise(async () => {
      const rows = await this.db
        .select({ videoId: vf.videoId, idx: vf.idx, hash: vf.hash })
        .from(vf)
        .where(and(ne(vf.videoId, excludeVideoId), sharing));
      return rows.map((row) => ({ ...row, hash: BigInt.asUintN(64, row.hash) }));
    }, databaseUnavailable.during('findFramesSharingBand'));
  }

  async findAudioTerms(
    terms: readonly number[],
    excludeVideoId: string
  ): Promise<Result<AudioTermHit[], DatabaseUnavailable>> {
    if (terms.length === 0) return ok([]);
    return fromPromise(
      () =>
        this.db
          .select({ videoId: va.videoId, idx: va.idx, term: va.term })
          .from(va)
          .where(and(ne(va.videoId, excludeVideoId), inArray(va.term, [...new Set(terms)]))),
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
}
