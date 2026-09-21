import { trace } from '@opentelemetry/api';
import { publicFeedInstant } from '@vp/domain';
import { DatabaseError } from '@vp/core/ports';
import {
  DEFAULT_VIDEO_SCAN_LIMIT,
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
  type VideoScan,
  type VideoScanAbsence,
  type VideoWithDetails,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type SQL, and, desc, eq, inArray, notExists, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  drizzleWhere,
  keysetBefore,
  notDeletedScope,
  ownerScope,
  videoReadScope,
} from '../scopes/index';
import { publicFeedCursorScope, publicFeedOrderBy, publicFeedScope } from './public-feed-query';
import {
  type VideoEventInsert,
  type VideoInsert,
  type VideoStatus,
  toDbError as dbErr,
} from './types';

const { videos: v, videoEvents: ve, processingSteps: ps, renditions: rn } = schema;

export class PostgresVideoRepository extends VideoRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async findById(id: string): Promise<VideoRecord | null> {
    try {
      const [r] = await this.db.select().from(v).where(eq(v.id, id)).limit(1);
      return r ?? null;
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
      return created;
    } catch (err) {
      throw dbErr('Failed to create video', err);
    }
  }

  async listByOwner(options: ListVideosOptions): Promise<VideoRecord[]> {
    const { ownerId, viewer, cursor, limit, status } = options;
    try {
      const whereClause = drizzleWhere(
        ownerScope(v, ownerId),
        videoReadScope(viewer ?? null),
        status ? eq(v.status, status as VideoStatus) : notDeletedScope(v),
        keysetBefore(v.createdAt, v.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
      );

      const rows = await this.db
        .select()
        .from(v)
        .where(whereClause)
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(limit + 1);
      return rows;
    } catch (err) {
      throw dbErr(`Failed to list videos for owner ${ownerId}`, err);
    }
  }

  async listPublic(options: ListPublicVideosOptions): Promise<ListPublicVideosResult> {
    try {
      const scope = publicFeedScope(options.categoryId);
      const instant = new Date(publicFeedInstant());

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .where(scope);

      const rows = await this.db
        .select()
        .from(v)
        .where(drizzleWhere(scope, publicFeedCursorScope(options, instant)))
        .orderBy(...publicFeedOrderBy(options, instant))
        .limit(options.limit + 1);

      return {
        items: rows as VideoRecord[],
        total: countResult?.count ?? 0,
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
          })
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
        return updated;
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
          } as VideoInsert)
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

  private absenceScope(absence: VideoScanAbsence): SQL {
    if ('step' in absence) {
      return notExists(
        this.db
          .select({ present: sql`1` })
          .from(ps)
          .where(and(eq(ps.videoId, v.id), eq(ps.step, absence.step)))
      );
    }
    return notExists(
      this.db
        .select({ present: sql`1` })
        .from(ve)
        .where(
          drizzleWhere(
            eq(ve.videoId, v.id),
            eq(ve.type, absence.event),
            absence.forCurrentGeneration
              ? sql`(${ve.payload}->>'generation')::int >= ${v.generation}`
              : undefined
          )
        )
    );
  }

  async scan(filter: VideoScan): Promise<VideoRecord[]> {
    const { status, idleFor, minGeneration, without, limit = DEFAULT_VIDEO_SCAN_LIMIT } = filter;
    try {
      const whereClause = drizzleWhere(
        eq(v.status, status as VideoStatus),
        idleFor &&
          sql`COALESCE(${v[idleFor.since]}, ${v.updatedAt}) < ${new Date(Date.now() - idleFor.ms)}`,
        minGeneration !== undefined ? sql`${v.generation} >= ${minGeneration}` : undefined,
        without && this.absenceScope(without)
      );

      const rows = await this.db
        .select()
        .from(v)
        .where(whereClause)
        .for('update', { skipLocked: true })
        .limit(limit);
      return rows as VideoRecord[];
    } catch (err) {
      throw dbErr(`Failed to scan ${status} videos`, err);
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
        ownerScope(v, ownerId),
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
