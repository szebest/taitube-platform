import type {
  ChannelImageCommit,
  ChannelImageCompletion,
  ChannelImageRepositoryPort,
  NewChannelImageUpload,
} from '@vp/core/repositories';
import { channelImageUploads as up, channels } from '@vp/db';
import type { ChannelImageUpload } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  commitUpload,
  failUpload,
  lockUpload,
  nextVersion,
  toChannelImageUpload,
} from './channel-image-writes';
import type { PostgresDatabase } from './types';

export class PostgresChannelImageRepository implements ChannelImageRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    input: NewChannelImageUpload
  ): Promise<Result<ChannelImageUpload, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(up).values(input).returning(),
      databaseUnavailable.during('createChannelImageUpload')
    );
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row
      ? ok(toChannelImageUpload(row))
      : err(databaseUnavailable('createChannelImageUpload', 'insert returned no row'));
  }

  async findById(id: string): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(up).where(eq(up.id, id)).limit(1),
      databaseUnavailable.during('findChannelImageUpload')
    );
    return map(rows, ([row]) => (row ? toChannelImageUpload(row) : null));
  }

  queue(
    id: string,
    completion: ChannelImageCompletion
  ): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    return this.write('queueChannelImageUpload', async (tx) => {
      const row = await lockUpload(tx, id);
      if (!row || (row.status !== 'issued' && row.status !== 'queued')) return null;
      if (row.status === 'queued') return toChannelImageUpload(row);

      const [queued] = await tx
        .update(up)
        .set({
          ...completion,
          status: 'queued',
          version: await nextVersion(tx, row),
          updatedAt: new Date(),
        })
        .where(eq(up.id, id))
        .returning();
      return queued ? toChannelImageUpload(queued) : null;
    });
  }

  commit(id: string, defaultUrl: string): Promise<Result<ChannelImageCommit | null, DatabaseUnavailable>> {
    return this.write('commitChannelImageUpload', async (tx) => {
      const row = await lockUpload(tx, id);
      if (!row) return null;
      if (row.status === 'ready' || row.status === 'superseded') {
        return { upload: toChannelImageUpload(row), applied: row.status === 'ready' };
      }
      return row.status === 'queued' ? commitUpload(tx, row, defaultUrl) : null;
    });
  }

  fail(
    id: string,
    reason: string
  ): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    return this.write('failChannelImageUpload', async (tx) => {
      const row = await lockUpload(tx, id);
      if (!row) return null;
      const settled = ['ready', 'superseded', 'failed', 'purged'].includes(row.status);
      return settled ? toChannelImageUpload(row) : failUpload(tx, row, reason);
    });
  }

  async listPurgeable(
    olderThan: Date,
    limit: number
  ): Promise<Result<ChannelImageUpload[], DatabaseUnavailable>> {
    const currentVersion = sql`case ${up.kind} when 'avatar' then ${channels.avatarVersion} else ${channels.bannerVersion} end`;
    const rows = await fromPromise(
      () =>
        this.db
          .select({ upload: up })
          .from(up)
          .innerJoin(channels, eq(channels.id, up.channelId))
          .where(
            and(
              lt(up.updatedAt, olderThan),
              or(
                inArray(up.status, ['issued', 'failed', 'superseded']),
                and(eq(up.status, 'ready'), sql`${up.version} < ${currentVersion}`)
              )
            )
          )
          .orderBy(asc(up.updatedAt), asc(up.id))
          .limit(limit),
      databaseUnavailable.during('listPurgeableChannelImages')
    );
    return map(rows, (found) => found.map(({ upload }) => toChannelImageUpload(upload)));
  }

  async markPurged(ids: readonly string[]): Promise<Result<void, DatabaseUnavailable>> {
    if (ids.length === 0) return ok();
    const written = await fromPromise(
      () =>
        this.db
          .update(up)
          .set({ status: 'purged', updatedAt: new Date() })
          .where(inArray(up.id, [...ids])),
      databaseUnavailable.during('markChannelImagesPurged')
    );
    return map(written, () => undefined);
  }

  private write<T>(
    operation: string,
    body: (tx: PostgresDatabase) => Promise<T>
  ): Promise<Result<T, DatabaseUnavailable>> {
    return fromPromise(() => this.db.transaction(body), databaseUnavailable.during(operation));
  }
}
