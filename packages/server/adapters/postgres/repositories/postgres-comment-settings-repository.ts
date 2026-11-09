import type { CommentSettingsRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type CommentSettings,
  DEFAULT_COMMENT_SETTINGS,
  type NewChannelAuditEntry,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { eq } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import type { PostgresDatabase } from './types';

const { channelCommentSettings: s } = schema;

const toSettings = ({
  reviewMode,
  blockedWords,
  linkAllowlist,
  slowModeSeconds,
  subscribersOnly,
  minAccountAgeDays,
  disclosure,
}: typeof s.$inferSelect): CommentSettings => ({
  reviewMode,
  blockedWords,
  linkAllowlist,
  slowModeSeconds,
  subscribersOnly,
  minAccountAgeDays,
  disclosure,
});

export class PostgresCommentSettingsRepository implements CommentSettingsRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async get(channelId: string): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(s).where(eq(s.channelId, channelId)).limit(1),
      databaseUnavailable.during('getCommentSettings')
    );
    return map(rows, ([row]) => (row ? toSettings(row) : DEFAULT_COMMENT_SETTINGS));
  }

  async save(
    channelId: string,
    settings: CommentSettings,
    audit: NewChannelAuditEntry
  ): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    const values = {
      ...settings,
      blockedWords: [...settings.blockedWords],
      linkAllowlist: [...settings.linkAllowlist],
      updatedAt: new Date(),
    };
    const rows = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const saved = await tx
            .insert(s)
            .values({ channelId, ...values })
            .onConflictDoUpdate({ target: s.channelId, set: values })
            .returning();
          await appendChannelAudit(tx, audit);
          return saved;
        }),
      databaseUnavailable.during('saveCommentSettings')
    );
    return map(rows, ([row]) => (row ? toSettings(row) : settings));
  }
}
