import type { ChannelHandleHistoryRepositoryPort } from '@vp/core/repositories';
import { channelHandleHistory as history } from '@vp/db';
import type { ChannelHandleRetirement } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { eq, lt } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

export class PostgresChannelHandleHistoryRepository implements ChannelHandleHistoryRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async findByHandle(
    handle: string
  ): Promise<Result<ChannelHandleRetirement | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(history).where(eq(history.handle, handle.toLowerCase())).limit(1),
      databaseUnavailable.during('findRetiredHandle')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(history)
          .where(lt(history.retiredAt, cutoff))
          .returning({ handle: history.handle }),
      databaseUnavailable.during('purgeRetiredHandles')
    );
    return map(rows, (removed) => removed.length);
  }
}
