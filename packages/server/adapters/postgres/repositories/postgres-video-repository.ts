import { trace } from '@opentelemetry/api';
import {
  DEFAULT_VIDEO_SCAN_LIMIT,
  type ListPublicVideosOptions,
  type ListPublicVideosResult,
  type ListVideosOptions,
  type NewVideoInput,
  type TransitionVideoOptions,
  type UpdateVideoMetadataOptions,
  type VideoRecord,
  VideoRepository,
  type VideoScan,
  type VideoWithDetails,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { publicFeedWalkInstant } from '@vp/domain';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  databaseUnavailable,
  versionConflict,
} from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { type SQL, and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  drizzleWhere,
  keysetBefore,
  notDeletedScope,
  ownerScope,
  videoReadScope,
} from '../scopes/index';
import { publicFeedCursorScope, publicFeedOrderBy, publicFeedScope } from './public-feed-query';
import type { PostgresDatabase, VideoInsert } from './types';
import { videoScanScope } from './video-scan-query';

const { videos: v, videoEvents: ve, processingSteps: ps, renditions: rn } = schema;

export class PostgresVideoRepository extends VideoRepository {
  constructor(private readonly db: PostgresDatabase) {
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

    const video = found.value;
    const details = await fromPromise(
      () =>
        Promise.all([
          this.db.select().from(rn).where(eq(rn.videoId, id)),
          this.db.select().from(ps).where(eq(ps.videoId, id)),
          this.db.select().from(ve).where(eq(ve.videoId, id)),
        ]),
      databaseUnavailable.during('findWithDetails')
    );

    return map(details, ([renditions, steps, events]) => ({ video, renditions, steps, events }));
  }

  async create(data: NewVideoInput): Promise<Result<VideoRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(v).values(data).returning(),
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
      status ? eq(v.status, status) : notDeletedScope(v),
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

    const total = await this.count('listPublic', scope);
    if (!total.ok) return total;

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
      items: found,
      total: total.value,
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
    const effectiveTraceId = traceId || trace.getActiveSpan()?.spanContext().traceId || null;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const statusCond = Array.isArray(from) ? inArray(v.status, from) : eq(v.status, from);

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
            type: eventType || `video.${to.toLowerCase()}`,
            payload: eventPayload,
            traceId: effectiveTraceId,
            createdAt: new Date(),
          });

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

  async scan(filter: VideoScan): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(videoScanScope(filter, new Date()))
          .for('update', { skipLocked: true })
          .limit(filter.limit ?? DEFAULT_VIDEO_SCAN_LIMIT),
      databaseUnavailable.during('scan')
    );

    return rows;
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
    return this.count(
      'countInFlightByOwner',
      drizzleWhere(
        ownerScope(v, ownerId),
        inArray(v.status, ['PROBING', 'PROCESSING']),
        notDeletedScope(v)
      )
    );
  }

  private async count(
    operation: string,
    where: SQL | undefined
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select({ count: sql<number>`count(*)::int` }).from(v).where(where),
      databaseUnavailable.during(operation)
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

    return map(rows, (found) => Object.fromEntries(found.map((row) => [row.status, row.count])));
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
