import type { SavedReplyDraft, SavedReplyRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { SavedReply } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, type Result } from '@vp/result';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { PostgresDatabase } from './types';

const { channelSavedReplies: r } = schema;

export class PostgresSavedReplyRepository implements SavedReplyRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(channelId: string): Promise<Result<SavedReply[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(r)
          .where(eq(r.channelId, channelId))
          .orderBy(asc(r.position), asc(r.id)),
      databaseUnavailable.during('listSavedReplies')
    );
  }

  async create(
    channelId: string,
    draft: SavedReplyDraft,
    limit: number
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`saved_replies:${channelId}`}))`
          );
          const [stats] = await tx
            .select({ total: count(), next: sql<number>`coalesce(max(${r.position}) + 1, 0)` })
            .from(r)
            .where(eq(r.channelId, channelId));
          if ((stats?.total ?? 0) >= limit) return null;
          const [created] = await tx
            .insert(r)
            .values({ id: uuidv7(), channelId, ...draft, position: stats?.next ?? 0 })
            .returning();
          return created ?? null;
        }),
      databaseUnavailable.during('createSavedReply')
    );
  }

  async update(
    channelId: string,
    id: string,
    patch: Partial<SavedReplyDraft & { position: number }>
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>> {
    return fromPromise(async () => {
      const [updated] = await this.db
        .update(r)
        .set(patch)
        .where(and(eq(r.id, id), eq(r.channelId, channelId)))
        .returning();
      return updated ?? null;
    }, databaseUnavailable.during('updateSavedReply'));
  }

  async remove(channelId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(async () => {
      const removed = await this.db
        .delete(r)
        .where(and(eq(r.id, id), eq(r.channelId, channelId)))
        .returning({ id: r.id });
      return removed.length > 0;
    }, databaseUnavailable.during('removeSavedReply'));
  }
}
