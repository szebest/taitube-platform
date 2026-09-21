import { trace } from '@opentelemetry/api';
import {
  DatabaseError,
  type ListPublicVideosOptions,
  type ListPublicVideosResult,
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
import { type SQL, type Table, and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type VideoEventInsert,
  type VideoInsert,
  type VideoStatus,
  toDbError as dbErr,
} from './types';
import { drizzleWhere, notDeletedScope, videoOwnerScope } from '../scopes/index';

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
      const cursorCond = cursor
        ? or(
            lt(v.createdAt, cursor.createdAt),
            and(eq(v.createdAt, cursor.createdAt), lt(v.id, cursor.id))
          )
        : undefined;

      const whereClause = drizzleWhere(
        videoOwnerScope(ownerId),
        status ? eq(v.status, status as VideoStatus) : notDeletedScope(v),
        cursorCond
      );

      const rows = await this.db
        .select()
        .from(v)
        .where(whereClause)
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(limit + 1);
      return rows as VideoRecord[];
    } catch (err) {
      throw dbErr(`Failed to list videos for owner ${ownerId}`, err);
    }
  }

  async listPublic(options: ListPublicVideosOptions): Promise<ListPublicVideosResult> {
    const { cursor, limit } = options;
    try {
      const baseWhere = drizzleWhere(
        eq(v.visibility, 'public'),
        eq(v.status, 'READY'),
        notDeletedScope(v)
      );

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .where(baseWhere);
      const total = countResult?.count ?? 0;

      const cursorCond = cursor?.createdAt
        ? or(
            lt(v.createdAt, cursor.createdAt),
            and(eq(v.createdAt, cursor.createdAt), lt(v.id, cursor.id))
          )
        : undefined;

      const queryWhere = drizzleWhere(baseWhere, cursorCond);

      const rows = await this.db
        .select()
        .from(v)
        .where(queryWhere)
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(limit + 1);

      return {
        items: rows as VideoRecord[],
        total,
      };
    } catch (err) {
      throw dbErr('Failed to list public videos', err);
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

        if (options.outbox) {
          await tx.insert(schema.outbox).values({
            id: options.outbox.id || sql`gen_random_uuid()`,
            kind: options.outbox.kind,
            payload: options.outbox.payload,
            createdAt: new Date(),
            attempts: 0,
          });
        }

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
      const whereClause = drizzleWhere(
        videoOwnerScope(ownerId),
        inArray(v.status, ['PROBING', 'PROCESSING']),
        notDeletedScope(v)
      );
      const [res] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .where(whereClause);
      return res?.count ?? 0;
    } catch (err) {
      throw dbErr(`Failed to count in-flight videos for owner ${ownerId}`, err);
    }
  }

  async countByStatus(): Promise<Record<string, number>> {
    try {
      const rows = await this.db
        .select({ status: v.status, count: sql<number>`count(*)::int` })
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

  async updateReactionCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<void> {
    try {
      await this.db
        .update(v)
        .set({ likesCount, dislikesCount, updatedAt: new Date() })
        .where(eq(v.id, videoId));
    } catch (err) {
      throw dbErr(`Failed to update reaction counters for video ${videoId}`, err);
    }
  }
}
