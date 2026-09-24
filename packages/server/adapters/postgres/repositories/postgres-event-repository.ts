import {
  EventRepository,
  type NewVideoEventInput,
  type VideoEventRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

export class PostgresEventRepository extends EventRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async create(data: NewVideoEventInput): Promise<Result<VideoEventRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .insert(schema.videoEvents)
          .values({
            videoId: data.videoId,
            type: data.type,
            payload: data.payload ?? {},
            traceId: data.traceId ?? null,
            createdAt: new Date(),
          })
          .returning(),
      databaseUnavailable.during('create')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row ? ok(row) : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async findByVideoId(videoId: string): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(schema.videoEvents)
          .where(eq(schema.videoEvents.videoId, videoId))
          .orderBy(asc(schema.videoEvents.id)),
      databaseUnavailable.during('findByVideoId')
    );
  }

  async findAfterId(
    videoId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(schema.videoEvents)
          .where(and(eq(schema.videoEvents.videoId, videoId), gt(schema.videoEvents.id, afterId)))
          .orderBy(asc(schema.videoEvents.id)),
      databaseUnavailable.during('findAfterId')
    );
  }

  async findAfterIdForUser(
    userId: string,
    afterId: number
  ): Promise<Result<VideoEventRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({
            id: schema.videoEvents.id,
            videoId: schema.videoEvents.videoId,
            type: schema.videoEvents.type,
            payload: schema.videoEvents.payload,
            createdAt: schema.videoEvents.createdAt,
          })
          .from(schema.videoEvents)
          .innerJoin(schema.videos, eq(schema.videoEvents.videoId, schema.videos.id))
          .where(and(eq(schema.videos.ownerId, userId), gt(schema.videoEvents.id, afterId)))
          .orderBy(asc(schema.videoEvents.id)),
      databaseUnavailable.during('findAfterIdForUser')
    );
  }

  async getLatestEventId(videoId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: schema.videoEvents.id })
          .from(schema.videoEvents)
          .where(eq(schema.videoEvents.videoId, videoId))
          .orderBy(desc(schema.videoEvents.id))
          .limit(1),
      databaseUnavailable.during('getLatestEventId')
    );

    return map(rows, ([row]) => row?.id ?? 0);
  }
}
