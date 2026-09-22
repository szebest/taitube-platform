import { DatabaseError } from '@vp/core/ports';
import {
  type NewRenditionInput,
  type RenditionRecord,
  RenditionRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toRenditionInsert, toRenditionUpdate } from '../mappers/index';

export class PostgresRenditionRepository extends RenditionRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(data: NewRenditionInput): Promise<RenditionRecord> {
    try {
      const [created] = await this.db
        .insert(schema.renditions)
        .values(toRenditionInsert(data))
        .returning();

      if (!created) {
        throw new DatabaseError('Failed to create rendition: empty return');
      }
      return created;
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(`Failed to create rendition: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findByVideoId(videoId: string): Promise<RenditionRecord[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, videoId));
      return rows;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get renditions for video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findByVideoIds(videoIds: string[]): Promise<RenditionRecord[]> {
    if (videoIds.length === 0) return [];
    try {
      const rows = await this.db
        .select()
        .from(schema.renditions)
        .where(inArray(schema.renditions.videoId, videoIds));
      return rows;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get renditions for videos: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<RenditionRecord | null> {
    try {
      const [updated] = await this.db
        .update(schema.renditions)
        .set(toRenditionUpdate(patch))
        .where(and(eq(schema.renditions.videoId, videoId), eq(schema.renditions.name, name)))
        .returning();
      return updated ?? null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to update rendition ${name}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
