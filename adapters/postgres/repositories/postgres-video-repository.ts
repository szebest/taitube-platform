import { trace } from '@opentelemetry/api';
import {
  DatabaseError,
  type ListVideosOptions,
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
import { type SQL, type Table, and, desc, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type VideoEventInsert,
  type VideoInsert,
  type VideoStatus,
  toDbError as dbErr,
} from './types.js';

const { videos: v, videoEvents: ve, processingSteps: ps, renditions: rn } = schema;

export class PostgresVideoRepository extends VideoRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  private findLocked(where: SQL | undefined, limit: number): Promise<VideoRecord[]> {
    return this.db
      .select()
      .from(v)
      .where(where)
      .for('update', { skipLocked: true })
      .limit(limit) as Promise<VideoRecord[]>;
  }

  private async findJoinedLocked(
    where: SQL | undefined,
    joinTbl: Table,
    joinOn: SQL | undefined,
    limit: number
  ): Promise<VideoRecord[]> {
    const rows = await this.db
      .select({ video: v })
      .from(v)
      .leftJoin(joinTbl, joinOn)
      .where(where)
      .for('update', { skipLocked: true })
      .limit(limit);
    return rows.map((r) => r.video as VideoRecord);
  }

  async findById(id: string): Promise<VideoRecord | null> {
    try {
      const [r] = await this.db.select().from(v).where(eq(v.id, id)).limit(1);
      return (r as VideoRecord) || null;
    } catch (err) {
      throw dbErr(`Failed to get video ${id}`, err);
    }
  }

  async findWithDetails(id: string): Promise<VideoWithDetails | null> {
    try {
      const video = await this.findById(id);
      if (!video) return null;
      const [renditions, steps, events] = await Promise.all([
        this.db.select().from(rn).where(eq(rn.videoId, id)),
        this.db.select().from(ps).where(eq(ps.videoId, id)),
        this.db.select().from(ve).where(eq(ve.videoId, id)),
      ]);
      return {
        video,
        renditions: renditions as RenditionRecord[],
        steps: steps as ProcessingStepRecord[],
        events: events as VideoEventRecord[],
      };
    } catch (err) {
      throw dbErr(`Failed to get video details for ${id}`, err);
    }
  }

  async create(data: NewVideoInput): Promise<VideoRecord> {
    try {
      const vals = {
        ...data,
        visibility: data.visibility || 'private',
        status: data.status || 'UPLOADING',
        generation: data.generation ?? 1,
        ...(data.fps !== undefined ? { fps: data.fps !== null ? String(data.fps) : null } : {}),
      };
      const [created] = await this.db
        .insert(v)
        .values(vals as VideoInsert)
        .returning();
      if (!created) throw new DatabaseError('Failed to insert video record: empty return');
      return created as VideoRecord;
    } catch (err) {
      throw dbErr('Failed to create video', err);
    }
  }

  async listByOwner(options: ListVideosOptions): Promise<VideoRecord[]> {
    const { ownerId, cursor, limit, status } = options;
    try {
      const conditions = [eq(v.ownerId, ownerId)];
      if (status) conditions.push(eq(v.status, status as VideoStatus));
      else conditions.push(ne(v.status, 'DELETED'));
      if (cursor) {
        const cCond = or(
          lt(v.createdAt, cursor.createdAt),
          and(eq(v.createdAt, cursor.createdAt), lt(v.id, cursor.id))
        );
        if (cCond) conditions.push(cCond);
      }
      const rows = await this.db
        .select()
        .from(v)
        .where(and(...conditions))
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(limit + 1);
      return rows as VideoRecord[];
    } catch (err) {
      throw dbErr(`Failed to list videos for owner ${ownerId}`, err);
    }
  }

  async updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord> {
    const { videoId, expectedVersion, patch, userId } = options;
    try {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(v)
          .set({
            version: sql`${v.version} + 1`,
            updatedAt: new Date(),
            ...patch,
          } as unknown as VideoInsert)
          .where(and(eq(v.id, videoId), eq(v.version, expectedVersion)))
          .returning();
        if (!updated) {
          throw new DatabaseError(
            `Version conflict on video ${videoId}: expected version ${expectedVersion}`,
            {
              code: 'VERSION_CONFLICT',
            }
          );
        }
        await tx.insert(ve).values({
          videoId,
          type: 'video.metadata_updated',
          payload: {
            patch,
            expectedVersion,
            newVersion: updated.version,
            ...(userId ? { requestedBy: userId } : {}),
          },
          createdAt: new Date(),
        });
        return updated as VideoRecord;
      });
    } catch (err) {
      throw dbErr(`Failed to update video metadata for ${videoId}`, err);
    }
  }

  async transition(options: TransitionVideoOptions): Promise<boolean> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;
    const effectiveEventType = eventType || `video.${to.toLowerCase()}`;
    const activeSpan = trace.getActiveSpan();
    const effectiveTraceId = traceId || (activeSpan ? activeSpan.spanContext().traceId : null);
    try {
      return await this.db.transaction(async (tx) => {
        const statusCond = Array.isArray(from)
          ? inArray(v.status, from as VideoStatus[])
          : eq(v.status, from as VideoStatus);

        const rows = await tx
          .update(v)
          .set({
            ...patch,
            status: to,
            updatedAt: new Date(),
            ...(to === 'READY' ? { readyAt: new Date() } : {}),
          } as unknown as VideoInsert)
          .where(and(eq(v.id, videoId), statusCond))
          .returning({ id: v.id });

        if (rows.length === 0) return false;

        await tx.insert(ve).values({
          videoId,
          type: effectiveEventType,
          payload: eventPayload,
          traceId: effectiveTraceId,
          createdAt: new Date(),
        } as VideoEventInsert);
        return true;
      });
    } catch (err) {
      throw dbErr(`Failed to transition video ${videoId} to ${to}`, err);
    }
  }

  async findStaleUploading(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMs);
      return await this.findLocked(
        and(eq(v.status, 'UPLOADING'), sql`${v.updatedAt} < ${cutoff}`),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find stale uploading videos', err);
    }
  }

  async findStaleUploadedWithoutProbe(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMs);
      return await this.findJoinedLocked(
        and(eq(v.status, 'UPLOADED'), sql`${v.updatedAt} < ${cutoff}`, sql`${ps.id} IS NULL`),
        ps,
        and(eq(ps.videoId, v.id), eq(ps.step, 'probe')),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find stale uploaded videos', err);
    }
  }

  async findStaleProcessing(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMs);
      return await this.findLocked(
        and(eq(v.status, 'PROCESSING'), sql`${v.updatedAt} < ${cutoff}`),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find stale processing videos', err);
    }
  }

  async findSoftDeleted(thresholdMs: number, limit = 50): Promise<VideoRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMs);
      return await this.findLocked(
        and(eq(v.status, 'DELETED'), sql`COALESCE(${v.deletedAt}, ${v.updatedAt}) < ${cutoff}`),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find soft deleted videos', err);
    }
  }

  async findExpiredRaw(retentionDays: number, limit = 50): Promise<VideoRecord[]> {
    try {
      const cutoff = new Date(Date.now() - retentionDays * 86400000);
      return await this.findJoinedLocked(
        and(
          eq(v.status, 'READY'),
          sql`COALESCE(${v.readyAt}, ${v.updatedAt}) < ${cutoff}`,
          sql`${ve.id} IS NULL`
        ),
        ve,
        and(eq(ve.videoId, v.id), eq(ve.type, 'video.raw_expired')),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find expired raw videos', err);
    }
  }

  async findReadyWithOldGenerations(limit = 50): Promise<VideoRecord[]> {
    try {
      const gen = v.generation;
      return await this.findJoinedLocked(
        and(eq(v.status, 'READY'), sql`${gen} > 1`, sql`${ve.id} IS NULL`),
        ve,
        and(
          eq(ve.videoId, v.id),
          eq(ve.type, 'video.generation_purged'),
          sql`(${ve.payload}->>'generation')::int >= ${gen}`
        ),
        limit
      );
    } catch (err) {
      throw dbErr('Failed to find ready videos with old generations', err);
    }
  }

  async hardDelete(id: string): Promise<boolean> {
    try {
      const rows = await this.db
        .delete(v)
        .where(and(eq(v.id, id), eq(v.status, 'DELETED')))
        .returning({ id: v.id });
      return rows.length > 0;
    } catch (err) {
      throw dbErr(`Failed to hard delete video ${id}`, err);
    }
  }

  async countInFlightByOwner(ownerId: string): Promise<number> {
    try {
      const [res] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .where(
          and(
            eq(v.ownerId, ownerId),
            inArray(v.status, ['PROBING', 'PROCESSING']),
            sql`${v.deletedAt} IS NULL`
          )
        );
      return res?.count ?? 0;
    } catch (err) {
      throw dbErr(`Failed to count in-flight videos for owner ${ownerId}`, err);
    }
  }

  async countByStatus(): Promise<Record<string, number>> {
    try {
      const rows = await this.db
        .select({
          status: v.status,
          count: sql<number>`count(*)::int`,
        })
        .from(v)
        .groupBy(v.status);
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.status] = row.count;
      }
      return result;
    } catch (err) {
      throw dbErr('Failed to count videos by status', err);
    }
  }
}
