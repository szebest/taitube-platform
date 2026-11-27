import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { fromPromise, map, type Result } from '@kit/result';
import { VideoPasswordRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videos: v } = schema;

export class PostgresVideoPasswordRepository extends VideoPasswordRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async hashOf(videoId: string): Promise<Result<string | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db.select({ hash: v.accessPasswordHash }).from(v).where(eq(v.id, videoId)).limit(1),
      databaseUnavailable.during('videoPasswordHash')
    );
    return map(rows, ([row]) => row?.hash ?? null);
  }

  async setHash(
    videoId: string,
    hash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(v)
          .set({ accessPasswordHash: hash })
          .where(eq(v.id, videoId))
          .returning({ id: v.id }),
      databaseUnavailable.during('setVideoPasswordHash')
    );
    return map(rows, (found) => found.length > 0);
  }
}
