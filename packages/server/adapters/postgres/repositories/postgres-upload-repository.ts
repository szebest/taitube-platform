import { DatabaseError } from '@vp/core/ports';
import {
  type NewUploadInput,
  type UploadRecord,
  UploadRepository,
  type UploadWithVideo,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { UploadStatus } from '@vp/domain';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toUploadInsert, toUploadStatusUpdate } from '../mappers/index';

export class PostgresUploadRepository extends UploadRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async findById(id: string): Promise<UploadRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(schema.uploads)
        .where(eq(schema.uploads.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get upload ${id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findByVideoId(videoId: string): Promise<UploadRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(schema.uploads)
        .where(eq(schema.uploads.videoId, videoId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get upload for video ${videoId}: ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async findWithVideo(uploadId: string): Promise<UploadWithVideo | null> {
    try {
      const rows = await this.db
        .select({
          upload: schema.uploads,
          video: schema.videos,
        })
        .from(schema.uploads)
        .innerJoin(schema.videos, eq(schema.uploads.videoId, schema.videos.id))
        .where(eq(schema.uploads.id, uploadId))
        .limit(1);

      const res = rows[0];
      if (!res) return null;
      return {
        upload: res.upload,
        video: res.video,
      };
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get upload with video for ${uploadId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async create(data: NewUploadInput): Promise<UploadRecord> {
    try {
      const [created] = await this.db
        .insert(schema.uploads)
        .values(toUploadInsert(data))
        .returning();

      if (!created) {
        throw new DatabaseError('Failed to create upload record: empty return');
      }
      return created;
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(`Failed to create upload: ${(err as Error).message}`, { cause: err });
    }
  }

  async updateStatus(uploadId: string, status: UploadStatus): Promise<UploadRecord | null> {
    try {
      const [updated] = await this.db
        .update(schema.uploads)
        .set(toUploadStatusUpdate(status))
        .where(eq(schema.uploads.id, uploadId))
        .returning();
      return updated ?? null;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to update upload status for ${uploadId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
