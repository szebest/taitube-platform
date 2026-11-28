import { type Result, fromPromise, map } from '@kit/result';
import type {
  ChannelLayoutDraft,
  ChannelLayoutDraftSaved,
  ChannelLayoutRepositoryPort,
  PublishChannelLayout,
  PublishedChannelLayout,
  SaveChannelLayoutDraft,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, desc, eq } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import { publishLayoutRevision, toPublishedLayout } from './channel-layout-writes';
import type { PostgresDatabase } from './types';

const { channelLayoutDrafts: drafts, entityRevisions: er } = schema;

function toDraft(row: typeof drafts.$inferSelect): ChannelLayoutDraft {
  return {
    channelId: row.channelId,
    document: row.doc,
    version: row.version,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export class PostgresChannelLayoutRepository implements ChannelLayoutRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async getDraft(
    channelId: string
  ): Promise<Result<ChannelLayoutDraft | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(drafts).where(eq(drafts.channelId, channelId)).limit(1),
      databaseUnavailable.during('getChannelLayoutDraft')
    );
    return map(rows, ([row]) => (row ? toDraft(row) : null));
  }

  async saveDraft(
    input: SaveChannelLayoutDraft
  ): Promise<Result<ChannelLayoutDraftSaved, DatabaseUnavailable>> {
    const { channelId, document, expectedVersion, userId, audit } = input;
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<ChannelLayoutDraftSaved> => {
          const changes = { doc: document, updatedBy: userId, updatedAt: new Date() };
          const [row] =
            expectedVersion === 0
              ? await tx
                  .insert(drafts)
                  .values({ channelId, version: 1, ...changes })
                  .onConflictDoNothing()
                  .returning()
              : await tx
                  .update(drafts)
                  .set({ ...changes, version: expectedVersion + 1 })
                  .where(and(eq(drafts.channelId, channelId), eq(drafts.version, expectedVersion)))
                  .returning();
          if (!row) return { type: 'stale' };
          await appendChannelAudit(tx, audit);
          return { type: 'saved', draft: toDraft(row) };
        }),
      databaseUnavailable.during('saveChannelLayoutDraft')
    );
  }

  async getPublished(
    channelId: string
  ): Promise<Result<PublishedChannelLayout | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(er)
          .where(and(eq(er.entityType, 'channel_layout'), eq(er.entityId, channelId)))
          .orderBy(desc(er.version))
          .limit(1),
      databaseUnavailable.during('getPublishedChannelLayout')
    );
    return map(rows, ([row]) => (row ? toPublishedLayout(row) : null));
  }

  async publish(
    input: PublishChannelLayout
  ): Promise<Result<PublishedChannelLayout, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => publishLayoutRevision(tx, input)),
      databaseUnavailable.during('publishChannelLayout')
    );
  }
}
