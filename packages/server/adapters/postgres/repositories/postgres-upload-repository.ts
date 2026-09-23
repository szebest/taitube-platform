import {
  type NewUploadInput,
  type UploadRecord,
  UploadRepository,
  type UploadWithVideo,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { UploadStatus } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, andThen, err, fromPromise, map, ok } from '@vp/result';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toUploadInsert, toUploadStatusUpdate } from '../mappers/index';

export class PostgresUploadRepository extends UploadRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  async findById(id: string): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(schema.uploads).where(eq(schema.uploads.id, id)).limit(1),
      this.unavailable('findById')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async findByVideoId(videoId: string): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db.select().from(schema.uploads).where(eq(schema.uploads.videoId, videoId)).limit(1),
      this.unavailable('findByVideoId')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async findWithVideo(
    uploadId: string
  ): Promise<Result<UploadWithVideo | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ upload: schema.uploads, video: schema.videos })
          .from(schema.uploads)
          .innerJoin(schema.videos, eq(schema.uploads.videoId, schema.videos.id))
          .where(eq(schema.uploads.id, uploadId))
          .limit(1),
      this.unavailable('findWithVideo')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async create(data: NewUploadInput): Promise<Result<UploadRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(schema.uploads).values(toUploadInsert(data)).returning(),
      this.unavailable('create')
    );

    /**
     * An insert that returns no row is the database refusing the write without raising, so it is a
     * failure of the same kind rather than an absent upload the caller could act on.
     */
    return andThen(rows, ([row]) =>
      row ? ok(row) : err(databaseUnavailable('create', 'insert returned no row'))
    );
  }

  async updateStatus(
    uploadId: string,
    status: UploadStatus
  ): Promise<Result<UploadRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(schema.uploads)
          .set(toUploadStatusUpdate(status))
          .where(eq(schema.uploads.id, uploadId))
          .returning(),
      this.unavailable('updateStatus')
    );

    return map(rows, ([row]) => row ?? null);
  }
}
