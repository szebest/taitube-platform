import {
  DatabaseError,
  type NewRenditionInput,
  type RenditionRecord,
  RenditionRepository,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';

export class PostgresRenditionRepository extends RenditionRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(data: NewRenditionInput): Promise<RenditionRecord> {
    try {
      const [created] = await this.db
        .insert(schema.renditions)
        .values({
          id: data.id ?? uuidv7(),
          videoId: data.videoId,
          name: data.name,
          width: data.width,
          height: data.height,
          videoBitrateKbps: data.videoBitrateKbps ?? 0,
          audioBitrateKbps: data.audioBitrateKbps ?? 0,
          status: (data.status as any) || 'PENDING',
          playlistKey: data.playlistKey ?? null,
          segmentCount: data.segmentCount ?? null,
          bytes: data.bytes ?? null,
        } as any)
        .returning();

      if (!created) {
        throw new DatabaseError('Failed to create rendition: empty return');
      }
      return created as unknown as RenditionRecord;
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
      return rows as unknown as RenditionRecord[];
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get renditions for video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<RenditionRecord | null> {
    try {
      const setPayload: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (patch.status !== undefined) setPayload['status'] = patch.status as any;
      if (patch.playlistKey !== undefined) setPayload['playlistKey'] = patch.playlistKey;
      if (patch.segmentCount !== undefined) setPayload['segmentCount'] = patch.segmentCount;
      if (patch.bytes !== undefined) setPayload['bytes'] = patch.bytes;
      if (patch.processingMs !== undefined) setPayload['processingMs'] = patch.processingMs;

      const [updated] = await this.db
        .update(schema.renditions)
        .set(setPayload)
        .where(and(eq(schema.renditions.videoId, videoId), eq(schema.renditions.name, name)))
        .returning();
      return (updated as unknown as RenditionRecord) || null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to update rendition ${name}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
