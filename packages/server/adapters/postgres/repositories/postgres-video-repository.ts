import { trace } from '@opentelemetry/api';
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
import { type VideoStatus, publicFeedWalkInstant } from '@vp/domain';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  databaseUnavailable,
  versionConflict,
} from '@vp/errors';
import { type Result, assertNever, err, fromPromise, map, ok } from '@vp/result';
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
import type { VideoEventInsert, VideoInsert } from './types';

const { videos: v, videoEvents: ve, processingSteps: ps, renditions: rn } = schema;

export class PostgresVideoRepository extends VideoRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async findById(id: string): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(v).where(eq(v.id, id)).limit(1),
      databaseUnavailable.during('findById')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async findWithDetails(id: string): Promise<Result<VideoWithDetails | null, DatabaseUnavailable>> {
    const found = await this.findById(id);
    if (!found.ok) return found;
    if (!found.value) return ok(null);

    const [renditions, steps, events] = await Promise.all([
      fromPromise(
        () => this.db.select().from(rn).where(eq(rn.videoId, id)),
        databaseUnavailable.during('findWithDetails')
      ),
      fromPromise(
        () => this.db.select().from(ps).where(eq(ps.videoId, id)),
        databaseUnavailable.during('findWithDetails')
      ),
      fromPromise(
        () => this.db.select().from(ve).where(eq(ve.videoId, id)),
        databaseUnavailable.during('findWithDetails')
      ),
    ]);

    if (!renditions.ok) return renditions;
    if (!steps.ok) return steps;
    if (!events.ok) return events;

    return ok({
      video: found.value,
      renditions: renditions.value as RenditionRecord[],
      steps: steps.value as ProcessingStepRecord[],
      events: events.value as VideoEventRecord[],
    });
  }

  async create(data: NewVideoInput): Promise<Result<VideoRecord, DatabaseUnavailable>> {
    const vals = {
      ...data,
      visibility: data.visibility || 'private',
      status: data.status || 'UPLOADING',
      generation: data.generation ?? 1,
      ...(data.fps !== undefined ? { fps: data.fps !== null ? String(data.fps) : null } : {}),
    };

    const rows = await fromPromise(
      () =>
        this.db
          .insert(v)
          .values(vals as VideoInsert)
          .returning(),
      databaseUnavailable.during('create')
    );

    if (!rows.ok) return rows;
    const [created] = rows.value;
    return created ? ok(created) : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async listByOwner(
    options: ListVideosOptions
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { ownerId, viewer, cursor, limit, status } = options;
    const whereClause = drizzleWhere(
      ownerScope(v, ownerId),
      videoReadScope(viewer ?? null),
      status ? eq(v.status, status as VideoStatus) : notDeletedScope(v),
      keysetBefore(v.createdAt, v.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
    );

    return await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(whereClause)
          .orderBy(desc(v.createdAt), desc(v.id))
          .limit(limit + 1),
      databaseUnavailable.during('listByOwner')
    );
  }

  async listPublic(
    options: ListPublicVideosOptions
  ): Promise<Result<ListPublicVideosResult, DatabaseUnavailable>> {
    const scope = publicFeedScope(options.categoryId);
    const instantMs = publicFeedWalkInstant(options.cursor);
    const instant = new Date(instantMs);

    const counted = await fromPromise(
      () => this.db.select({ count: sql<number>`count(*)::int` }).from(v).where(scope),
      databaseUnavailable.during('listPublic')
    );
    if (!counted.ok) return counted;

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(drizzleWhere(scope, publicFeedCursorScope(options, instant)))
          .orderBy(...publicFeedOrderBy(options, instant))
          .limit(options.limit + 1),
      databaseUnavailable.during('listPublic')
    );

    return map(rows, (found) => ({
      items: found as VideoRecord[],
      total: counted.value[0]?.count ?? 0,
      instant: instantMs,
    }));
  }

  async updateMetadata(
    options: UpdateVideoMetadataOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable | VersionConflict>> {
    const { videoId, expectedVersion, patch, userId } = options;

    const committed = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<Result<VideoRecord | null, VersionConflict>> => {
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
            // A zero-row update is a stale version or a video that is not there; only the second is ok(null).
            const [present] = await tx
              .select({ id: v.id })
              .from(v)
              .where(eq(v.id, videoId))
              .limit(1);
            return present ? err(versionConflict(videoId, expectedVersion)) : ok(null);
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
          return ok(updated);
        }),
      databaseUnavailable.during('updateMetadata')
    );

    return committed.ok ? committed.value : committed;
  }

  async transition(options: TransitionVideoOptions): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;
    const effectiveEventType = eventType || `video.${to.toLowerCase()}`;
    const activeSpan = trace.getActiveSpan();
    const effectiveTraceId = traceId || (activeSpan ? activeSpan.spanContext().traceId : null);

    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
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
        }),
      databaseUnavailable.during('transition')
    );
  }

  private absenceScope(absence: VideoScanAbsence): SQL {
    switch (absence.type) {
      case 'step':
        return notExists(
          this.db
            .select({ present: sql`1` })
            .from(ps)
            .where(and(eq(ps.videoId, v.id), eq(ps.step, absence.step)))
        );
      case 'event':
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
      default:
        return assertNever(absence, 'VideoScanAbsence');
    }
  }

  async scan(filter: VideoScan): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { status, idleFor, minGeneration, without, limit = DEFAULT_VIDEO_SCAN_LIMIT } = filter;
    const whereClause = drizzleWhere(
      eq(v.status, status as VideoStatus),
      idleFor &&
        sql`COALESCE(${v[idleFor.since]}, ${v.updatedAt}) < ${new Date(Date.now() - idleFor.ms)}`,
      minGeneration !== undefined ? sql`${v.generation} >= ${minGeneration}` : undefined,
      without && this.absenceScope(without)
    );

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(whereClause)
          .for('update', { skipLocked: true })
          .limit(limit),
      databaseUnavailable.during('scan')
    );

    return map(rows, (found) => found as VideoRecord[]);
  }

  async hardDelete(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(v)
          .where(and(eq(v.id, id), eq(v.status, 'DELETED')))
          .returning({ id: v.id }),
      databaseUnavailable.during('hardDelete')
    );

    return map(rows, (found) => found.length > 0);
  }

  async countInFlightByOwner(ownerId: string): Promise<Result<number, DatabaseUnavailable>> {
    const whereClause = drizzleWhere(
      ownerScope(v, ownerId),
      inArray(v.status, ['PROBING', 'PROCESSING']),
      notDeletedScope(v)
    );

    const rows = await fromPromise(
      () => this.db.select({ count: sql<number>`count(*)::int` }).from(v).where(whereClause),
      databaseUnavailable.during('countInFlightByOwner')
    );

    return map(rows, ([row]) => row?.count ?? 0);
  }

  async countByStatus(): Promise<Result<Record<string, number>, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ status: v.status, count: sql<number>`count(*)::int` })
          .from(v)
          .groupBy(v.status),
      databaseUnavailable.during('countByStatus')
    );

    return map(rows, (found) => {
      const result: Record<string, number> = {};
      for (const row of found) {
        result[row.status] = row.count;
      }
      return result;
    });
  }

  async updateReactionCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>> {
    const updated = await fromPromise(
      () =>
        this.db
          .update(v)
          .set({ likesCount, dislikesCount, updatedAt: new Date() })
          .where(eq(v.id, videoId)),
      databaseUnavailable.during('updateReactionCounters')
    );

    return map(updated, () => undefined);
  }
}
