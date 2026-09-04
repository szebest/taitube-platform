import {
  DatabaseError,
  EventRepository,
  type NewVideoEventInput,
  type VideoEventRecord,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresEventRepository extends EventRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(data: NewVideoEventInput): Promise<void> {
    try {
      await this.db.insert(schema.videoEvents).values({
        videoId: data.videoId,
        type: data.type,
        payload: data.payload,
        createdAt: new Date(),
      } as any);
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
        .where(eq(schema.videoEvents.videoId, videoId));
      return rows as unknown as VideoEventRecord[];
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get video events for ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
