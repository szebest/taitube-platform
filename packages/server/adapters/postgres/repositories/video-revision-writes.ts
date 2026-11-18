import type { NewEntityRevision } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type Chapter, type EntityRevision, videoMetadataSnapshot } from '@vp/domain';
import { asc, eq, and } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { PostgresDatabase } from './types';

const { entityRevisions: er, videoChapters: vc } = schema;

type RevisionRow = typeof er.$inferSelect;

export function toEntityRevision(row: RevisionRow): EntityRevision {
  return row as EntityRevision;
}

/** Written on the caller's transaction; a version already recorded for the entity stays as it was. */
export async function appendEntityRevision(
  tx: PostgresDatabase,
  revision: NewEntityRevision
): Promise<void> {
  await tx
    .insert(er)
    .values({ id: uuidv7(), createdAt: new Date(), ...revision })
    .onConflictDoNothing();
}

export async function selectChapters(tx: PostgresDatabase, videoId: string): Promise<Chapter[]> {
  return tx
    .select({ startMs: vc.startMs, title: vc.title })
    .from(vc)
    .where(eq(vc.videoId, videoId))
    .orderBy(asc(vc.position));
}

export async function replaceChapters(
  tx: PostgresDatabase,
  videoId: string,
  chapters: readonly Chapter[]
): Promise<void> {
  await tx.delete(vc).where(eq(vc.videoId, videoId));
  if (chapters.length === 0) return;
  await tx
    .insert(vc)
    .values(
      chapters.map(({ startMs, title }, position) => ({ videoId, position, startMs, title }))
    );
}

type VideoRow = typeof schema.videos.$inferSelect;

/**
 * The state after an edit, preceded by the state before it when the video has no history yet, so the
 * first edit can be undone too.
 */
export async function appendVideoRevisions(
  tx: PostgresDatabase,
  edit: {
    before: VideoRow;
    beforeChapters: readonly Chapter[];
    after: VideoRow;
    afterChapters: readonly Chapter[];
    authorUserId: string;
    restoredFromVersion?: number;
  }
): Promise<void> {
  const { before, beforeChapters, after, afterChapters, authorUserId, restoredFromVersion } = edit;
  const [recorded] = await tx
    .select({ id: er.id })
    .from(er)
    .where(and(eq(er.entityType, 'video_metadata'), eq(er.entityId, after.id)))
    .limit(1);
  if (!recorded) {
    await appendEntityRevision(tx, {
      entityType: 'video_metadata',
      entityId: before.id,
      version: before.version,
      snapshot: videoMetadataSnapshot(before, beforeChapters),
      authorUserId: null,
      restoredFromVersion: null,
    });
  }
  await appendEntityRevision(tx, {
    entityType: 'video_metadata',
    entityId: after.id,
    version: after.version,
    snapshot: videoMetadataSnapshot(after, afterChapters),
    authorUserId,
    restoredFromVersion: restoredFromVersion ?? null,
  });
}
