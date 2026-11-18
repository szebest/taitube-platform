import { fromPromise, map, type Result } from '@kit/result';
import { VideoCorrectionRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Correction } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoCorrections: vco } = schema;

export class PostgresVideoCorrectionRepository extends VideoCorrectionRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async list(videoId: string): Promise<Result<Correction[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(vco)
          .where(eq(vco.videoId, videoId))
          .orderBy(asc(vco.startMs), asc(vco.id)),
      databaseUnavailable.during('listVideoCorrections')
    );
  }

  async create(
    correction: Correction,
    limit: number
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`video_corrections:${correction.videoId}`}))`
          );
          const [stats] = await tx
            .select({ total: count() })
            .from(vco)
            .where(eq(vco.videoId, correction.videoId));
          if ((stats?.total ?? 0) >= limit) return false;
          await tx.insert(vco).values(correction);
          return true;
        }),
      databaseUnavailable.during('createVideoCorrection')
    );
  }

  async remove(
    videoId: string,
    correctionId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const removed = await fromPromise(
      () =>
        this.db
          .delete(vco)
          .where(and(eq(vco.id, correctionId), eq(vco.videoId, videoId)))
          .returning({ id: vco.id }),
      databaseUnavailable.during('removeVideoCorrection')
    );
    return map(removed, (rows) => rows.length > 0);
  }
}
