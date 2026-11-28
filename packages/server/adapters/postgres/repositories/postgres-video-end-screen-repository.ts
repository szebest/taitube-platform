import { fromPromise, map, type Result } from '@kit/result';
import type { EndScreenDraft, VideoEndScreenRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { EndScreen } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoEndScreens: es } = schema;

function toEndScreen(row: typeof es.$inferSelect): EndScreen {
  return {
    videoId: row.videoId,
    layout: row.layout,
    startsAtMs: row.startsAtMs,
    items: row.items,
    showSubscribe: row.showSubscribe,
    version: row.version,
  };
}

export class PostgresVideoEndScreenRepository implements VideoEndScreenRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find(videoId: string): Promise<Result<EndScreen | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(es).where(eq(es.videoId, videoId)).limit(1),
      databaseUnavailable.during('findEndScreen')
    );
    return map(rows, ([row]) => (row ? toEndScreen(row) : null));
  }

  async replace(
    draft: EndScreenDraft,
    expectedVersion: number
  ): Promise<Result<EndScreen | null, DatabaseUnavailable>> {
    const fields = {
      layout: draft.layout,
      startsAtMs: draft.startsAtMs,
      items: draft.items,
      showSubscribe: draft.showSubscribe,
    };
    const rows = await fromPromise(
      () =>
        expectedVersion === 0
          ? this.db
              .insert(es)
              .values({ videoId: draft.videoId, ...fields, version: 1 })
              .onConflictDoNothing()
              .returning()
          : this.db
              .update(es)
              .set({ ...fields, version: expectedVersion + 1, updatedAt: sql`now()` })
              .where(and(eq(es.videoId, draft.videoId), eq(es.version, expectedVersion)))
              .returning(),
      databaseUnavailable.during('replaceEndScreen')
    );
    return map(rows, ([row]) => (row ? toEndScreen(row) : null));
  }
}
