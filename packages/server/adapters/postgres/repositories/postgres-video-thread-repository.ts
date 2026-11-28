import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, fromPromise, map } from '@kit/result';
import type {
  ListHeldThreadsOptions,
  ListVideoThreadsOptions,
  ThreadModerated,
  ThreadModerationWrite,
  ThreadRemovalRecord,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  NewChannelAuditEntry,
  NewVideoThreadInput,
  ThreadCreated,
  ThreadPinOutcome,
  VideoThread,
  VideoThreadEntry,
} from '@vp/domain';
import { and, count, eq, isNull } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { heldThreads, threadEntry, threadsOfVideo, toVideoThread } from './video-thread-queries';
import {
  createThreadWithinLimit,
  moderateThreadRow,
  removeThreadRow,
  setThreadPinned,
} from './video-thread-writes';

const { videoThreads: t } = schema;

export class PostgresVideoThreadRepository implements VideoThreadRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Result<VideoThread | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(t)
          .where(and(eq(t.id, id), isNull(t.deletedAt))),
      databaseUnavailable.during('findVideoThread')
    );
    return map(rows, ([row]) => (row ? toVideoThread(row) : null));
  }

  async findEntry(id: string): Promise<Result<VideoThreadEntry | null, DatabaseUnavailable>> {
    return fromPromise(
      () => threadEntry(this.db, id),
      databaseUnavailable.during('findVideoThreadEntry')
    );
  }

  async listByVideo(
    videoId: string,
    options: ListVideoThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>> {
    return fromPromise(
      () => threadsOfVideo(this.db, videoId, options),
      databaseUnavailable.during('listVideoThreads')
    );
  }

  async listHeld(
    options: ListHeldThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>> {
    return fromPromise(
      () => heldThreads(this.db, options),
      databaseUnavailable.during('listHeldVideoThreads')
    );
  }

  async moderate(
    write: ThreadModerationWrite
  ): Promise<Result<ThreadModerated, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => moderateThreadRow(tx, write)),
      databaseUnavailable.during('moderateVideoThread')
    );
  }

  async countOpen(videoId: string, authorId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ total: count() })
          .from(t)
          .where(and(eq(t.videoId, videoId), eq(t.authorId, authorId), isNull(t.deletedAt))),
      databaseUnavailable.during('countOpenVideoThreads')
    );
    return map(rows, ([row]) => row?.total ?? 0);
  }

  async create(
    input: NewVideoThreadInput,
    openLimit: number
  ): Promise<Result<ThreadCreated, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => createThreadWithinLimit(tx, input, openLimit)),
      databaseUnavailable.during('createVideoThread')
    );
  }

  async setPinned(
    id: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<ThreadPinOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => setThreadPinned(tx, { id, pinned, limit }, audit)),
      databaseUnavailable.during('pinVideoThread')
    );
  }

  async remove(
    id: string,
    record: ThreadRemovalRecord
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => removeThreadRow(tx, id, record)),
      databaseUnavailable.during('removeVideoThread')
    );
  }
}
