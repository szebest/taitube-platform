import {
  DatabaseError,
  EventRepository,
  type NewVideoEventInput,
  type VideoEventRecord,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresEventRepository extends EventRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(data: NewVideoEventInput): Promise<VideoEventRecord> {
    try {
      const [row] = await this.db
        .insert(schema.videoEvents)
        .values({
          videoId: data.videoId,
          type: data.type,
          payload: data.payload ?? {},
          traceId: data.traceId ?? null,
          createdAt: new Date(),
        })
        .returning();
      return row as unknown as VideoEventRecord;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to create video event for ${data.videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findByVideoId(videoId: string): Promise<VideoEventRecord[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.videoEvents)
        .where(eq(schema.videoEvents.videoId, videoId))
        .orderBy(asc(schema.videoEvents.id));
      return rows as unknown as VideoEventRecord[];
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get video events for ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findAfterId(videoId: string, afterId: number): Promise<VideoEventRecord[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.videoEvents)
        .where(and(eq(schema.videoEvents.videoId, videoId), gt(schema.videoEvents.id, afterId)))
        .orderBy(asc(schema.videoEvents.id));
      return rows as unknown as VideoEventRecord[];
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get video events after id ${afterId} for video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findAfterIdForUser(userId: string, afterId: number): Promise<VideoEventRecord[]> {
    try {
      const rows = await this.db
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
        .orderBy(asc(schema.videoEvents.id));
      return rows as unknown as VideoEventRecord[];
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get user video events after id ${afterId} for user ${userId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async getLatestEventId(videoId: string): Promise<number> {
    try {
      const rows = await this.db
        .select({ id: schema.videoEvents.id })
        .from(schema.videoEvents)
        .where(eq(schema.videoEvents.videoId, videoId))
        .orderBy(desc(schema.videoEvents.id))
        .limit(1);
      return rows[0]?.id ?? 0;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get latest video event id for ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
