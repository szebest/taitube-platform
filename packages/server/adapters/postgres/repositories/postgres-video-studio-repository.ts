import { err, fromPromise, map, ok, type Result } from '@kit/result';
import {
  type StudioMetadataOutcome,
  type TakeDownVideoOptions,
  type UpdateStudioMetadataOptions,
  type VideoLibraryQuery,
  type VideoRecord,
  VideoStudioRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { CREATOR_LIBRARY_COUNTERS, type LibrarySort, videoEditAudit } from '@vp/domain';
import {
  type DatabaseUnavailable,
  databaseUnavailable,
  type VersionConflict,
  versionConflict,
} from '@vp/errors';
import { visibilityNotificationJobs } from '@vp/job-contracts';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { toVideoRecord } from '../mappers/video.mapper';
import {
  containsScope,
  drizzleWhere,
  keysetPast,
  msTimestamp,
  notDeletedScope,
} from '../scopes/index';
import { appendChannelAudit } from './channel-audit-writes';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';
import { appendVideoRevisions, replaceChapters, selectChapters } from './video-revision-writes';
import { commitVideoTransition } from './video-transition';

const { videos: v, videoEvents: ve, categories: c } = schema;

function sortKey(sort: LibrarySort) {
  if (sort === 'newest') return msTimestamp(v.createdAt);
  if (sort === 'title') return sql`${v.title} COLLATE "C"`;
  return v[CREATOR_LIBRARY_COUNTERS[sort]];
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

  async listLibrary(query: VideoLibraryQuery): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { channelId, sort, cursor, limit, status, visibility, categoryId, titleContains } = query;
    const order = query.order ?? 'desc';
    const key = sortKey(sort);
    const direction = order === 'asc' ? asc : desc;

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(
            drizzleWhere(
              channelId ? eq(v.channelId, channelId) : undefined,
              notDeletedScope(v),
              status && eq(v.status, status),
              visibility && eq(v.visibility, visibility),
              categoryId ? eq(v.categoryId, categoryId) : undefined,
              containsScope(v.title, titleContains),
              keysetPast(key, v.id, cursor && { sort: cursor.value, tie: cursor.id }, order)
            )
          )
          .orderBy(direction(key), direction(v.id))
          .limit(limit + 1),
      databaseUnavailable.during('listLibrary')
    );
    return map(rows, (found) => found.map(toVideoRecord));
  }

  async updateMetadata(
    options: UpdateStudioMetadataOptions
  ): Promise<Result<StudioMetadataOutcome, DatabaseUnavailable | VersionConflict>> {
    const { videoId, expectedVersion, userId, tokenId, auditFields, revision } = options;
    const { chapters, ...patch } = options.patch;

    const committed = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<Result<StudioMetadataOutcome, VersionConflict>> => {
          const { categoryId } = patch;
          if (categoryId && !(await isAssignable(tx, categoryId))) {
            return ok({ type: 'category-missing', categoryId });
          }

          const [before] = await tx.select().from(v).where(eq(v.id, videoId)).for('update');
          const beforeChapters = before ? await selectChapters(tx, videoId) : [];

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

          if (chapters !== undefined) await replaceChapters(tx, videoId, chapters);
          await appendVideoRevisions(tx, {
            before: before ?? updated,
            beforeChapters,
            after: updated,
            afterChapters: chapters ?? beforeChapters,
            authorUserId: userId,
            restoredFromVersion: revision?.restoredFromVersion,
          });
          await tx.insert(ve).values({
            videoId,
            type: 'video.metadata_updated',
            payload: { patch, expectedVersion, newVersion: updated.version, requestedBy: userId },
          });
          const edit = {
            videoId,
            fields: auditFields,
            commentsEnabled: patch.commentsEnabled,
            restoredFromVersion: revision?.restoredFromVersion,
          };
          for (const entry of videoEditAudit(edit)) {
            await appendChannelAudit(tx, {
              ...entry,
              channelId: updated.channelId,
              actorUserId: userId,
              actorTokenId: tokenId,
            });
          }
          await enqueueNotificationJobs(
            tx,
            visibilityNotificationJobs(
              videoId,
              updated.status,
              before?.visibility ?? updated.visibility,
              updated.visibility
            )
          );
          return ok({ type: 'updated', video: toVideoRecord(updated) });
        }),
      databaseUnavailable.during('updateMetadata')
    );

    return committed.ok ? committed.value : committed;
  }

  async takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    const { videoId, moderatorId, reason } = options;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const taken = await commitVideoTransition(tx, {
            videoId,
            edge: 'takedown',
            patch: { visibility: 'private' },
            eventPayload: { requestedBy: moderatorId, ...(reason ? { reason } : {}) },
          });
          if (!taken) return null;

          const [bumped] = await tx
            .update(v)
            .set({ version: sql`${v.version} + 1` })
            .where(eq(v.id, videoId))
            .returning();
          return bumped ? toVideoRecord(bumped) : null;
        }),
      databaseUnavailable.during('takeDown')
    );
  }
}
