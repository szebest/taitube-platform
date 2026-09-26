import {
  type CreatorLibraryQuery,
  type StudioMetadataOutcome,
  type TakeDownVideoOptions,
  type UpdateStudioMetadataOptions,
  type VideoRecord,
  VideoStudioRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { CREATOR_LIBRARY_COUNTERS, type CreatorLibrarySort } from '@vp/domain';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  databaseUnavailable,
  versionConflict,
} from '@vp/errors';
import { type Result, err, fromPromise, ok } from '@vp/result';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, notDeletedScope, ownerScope } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { videos: v, videoEvents: ve, categories: c } = schema;

function sortColumn(sort: CreatorLibrarySort) {
  return sort === 'newest' ? v.createdAt : v[CREATOR_LIBRARY_COUNTERS[sort]];
}

/** `FOR SHARE` holds the category until the edit commits, so a concurrent delete waits for it. */
async function isAssignable(tx: PostgresDatabase, categoryId: string): Promise<boolean> {
  const [found] = await tx
    .select({ id: c.id })
    .from(c)
    .where(and(eq(c.id, categoryId), eq(c.isActive, true)))
    .for('share')
    .limit(1);
  return found !== undefined;
}

export class PostgresVideoStudioRepository extends VideoStudioRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listLibrary(
    query: CreatorLibraryQuery
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { ownerId, sort, cursor, limit, status, visibility } = query;
    const column = sortColumn(sort);

    return fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(
            drizzleWhere(
              ownerScope(v, ownerId),
              notDeletedScope(v),
              status && eq(v.status, status),
              visibility && eq(v.visibility, visibility),
              keysetBefore(column, v.id, cursor && { sort: cursor.value, tie: cursor.id })
            )
          )
          .orderBy(desc(column), desc(v.id))
          .limit(limit + 1),
      databaseUnavailable.during('listLibrary')
    );
  }

  async updateMetadata(
    options: UpdateStudioMetadataOptions
  ): Promise<Result<StudioMetadataOutcome, DatabaseUnavailable | VersionConflict>> {
    const { videoId, expectedVersion, patch, userId } = options;

    const committed = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<Result<StudioMetadataOutcome, VersionConflict>> => {
          const { categoryId } = patch;
          if (categoryId && !(await isAssignable(tx, categoryId))) {
            return ok({ type: 'category-missing', categoryId });
          }

          const [updated] = await tx
            .update(v)
            .set({ ...patch, version: sql`${v.version} + 1`, updatedAt: new Date() })
            .where(and(eq(v.id, videoId), eq(v.version, expectedVersion)))
            .returning();

          if (!updated) {
            const [present] = await tx
              .select({ id: v.id })
              .from(v)
              .where(eq(v.id, videoId))
              .limit(1);
            return present
              ? err(versionConflict(videoId, expectedVersion))
              : ok({ type: 'video-missing' });
          }

          await tx.insert(ve).values({
            videoId,
            type: 'video.metadata_updated',
            payload: { patch, expectedVersion, newVersion: updated.version, requestedBy: userId },
          });
          return ok({ type: 'updated', video: updated });
        }),
      databaseUnavailable.during('updateMetadata')
    );

    return committed.ok ? committed.value : committed;
  }

  async takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    const { videoId, from, moderatorId, reason } = options;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [taken] = await tx
            .update(v)
            .set({
              status: 'REJECTED',
              visibility: 'private',
              version: sql`${v.version} + 1`,
              updatedAt: new Date(),
            })
            .where(and(eq(v.id, videoId), inArray(v.status, [...from])))
            .returning();
          if (!taken) return null;

          await tx.insert(ve).values({
            videoId,
            type: 'video.taken_down',
            payload: { requestedBy: moderatorId, ...(reason ? { reason } : {}) },
          });
          return taken;
        }),
      databaseUnavailable.during('takeDown')
    );
  }
}
