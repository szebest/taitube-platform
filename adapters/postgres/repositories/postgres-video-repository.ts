import {
  DatabaseError,
  type NewVideoInput,
  type ProcessingStepRecord,
  type RenditionRecord,
  type TransitionVideoOptions,
  type UpdateVideoMetadataOptions,
  type VideoEventRecord,
  type VideoRecord,
  VideoRepository,
  type VideoWithDetails,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresVideoRepository extends VideoRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async findById(id: string): Promise<VideoRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, id))
        .limit(1);
      return (rows[0] as unknown as VideoRecord) || null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get video ${id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findWithDetails(id: string): Promise<VideoWithDetails | null> {
    try {
      const video = await this.findById(id);
      if (!video) return null;

      const renditions = await this.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, id));

      const steps = await this.db
        .select()
        .from(schema.processingSteps)
        .where(eq(schema.processingSteps.videoId, id));

      const events = await this.db
        .select()
        .from(schema.videoEvents)
        .where(eq(schema.videoEvents.videoId, id));

      return {
        video,
        renditions: renditions as unknown as RenditionRecord[],
        steps: steps as unknown as ProcessingStepRecord[],
        events: events as unknown as VideoEventRecord[],
      };
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get video details for ${id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async create(data: NewVideoInput): Promise<VideoRecord> {
    try {
      const [created] = await this.db
        .insert(schema.videos)
        .values({
          id: data.id,
          ownerId: data.ownerId,
          title: data.title ?? null,
          description: data.description ?? null,
          visibility: data.visibility || 'private',
          status: data.status || 'UPLOADING',
          sourceKey: data.sourceKey,
          sourceSizeBytes: data.sourceSizeBytes ?? null,
          durationMs: data.durationMs ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          ladder: data.ladder ?? null,
          masterPlaylistKey: data.masterPlaylistKey ?? null,
          posterKey: data.posterKey ?? null,
          spriteKey: data.spriteKey ?? null,
          playbackUrl: data.playbackUrl ?? null,
          posterUrl: data.posterUrl ?? null,
          spriteUrl: data.spriteUrl ?? null,
          spriteVttUrl: data.spriteVttUrl ?? null,
          errorCode: data.errorCode ?? null,
          errorMessage: data.errorMessage ?? null,
        } as any)
        .returning();

      if (!created) {
        throw new DatabaseError('Failed to insert video record: empty return');
      }
      return created as unknown as VideoRecord;
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(`Failed to create video: ${(err as Error).message}`, { cause: err });
    }
  }

  async updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord> {
    const { videoId, expectedVersion, patch } = options;
    try {
      const setPayload: Record<string, unknown> = {
        version: sql`${schema.videos.version} + 1`,
        updatedAt: new Date(),
      };
      if (patch.title !== undefined) setPayload['title'] = patch.title;
      if (patch.description !== undefined) setPayload['description'] = patch.description;
      if (patch.visibility !== undefined) setPayload['visibility'] = patch.visibility;

      const updatedRows = await this.db
        .update(schema.videos)
        .set(setPayload)
        .where(and(eq(schema.videos.id, videoId), eq(schema.videos.version, expectedVersion)))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new DatabaseError(
          `Version conflict on video ${videoId}: expected version ${expectedVersion}`,
          { code: 'VERSION_CONFLICT' }
        );
      }
      return updated as unknown as VideoRecord;
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(
        `Failed to update video metadata for ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async transition(options: TransitionVideoOptions): Promise<boolean> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {} } = options;
    const effectiveEventType = eventType || `video.${to.toLowerCase()}`;

    try {
      return await this.db.transaction(async (tx) => {
        const statusCondition = Array.isArray(from)
          ? inArray(schema.videos.status, from as any)
          : eq(schema.videos.status, from as any);

        const updatedRows = await tx
          .update(schema.videos)
          .set({
            ...patch,
            status: to,
            updatedAt: new Date(),
            ...(to === 'READY' ? { readyAt: new Date() } : {}),
          } as any)
          .where(and(eq(schema.videos.id, videoId), statusCondition))
          .returning({ id: schema.videos.id });

        if (updatedRows.length === 0) {
          return false;
        }

        await tx.insert(schema.videoEvents).values({
          videoId,
          type: effectiveEventType,
          payload: eventPayload,
          createdAt: new Date(),
        } as any);

        return true;
      });
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to transition video ${videoId} to ${to}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
