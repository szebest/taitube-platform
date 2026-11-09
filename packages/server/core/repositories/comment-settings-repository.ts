import type { CommentSettings, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface CommentSettingsRepositoryPort {
  /** A channel that never saved settings has the defaults. */
  get(channelId: string): Promise<Result<CommentSettings, DatabaseUnavailable>>;
  /** Replaces the whole document, creating the row on the first save, and records `audit` with it. */
  save(
    channelId: string,
    settings: CommentSettings,
    audit: NewChannelAuditEntry
  ): Promise<Result<CommentSettings, DatabaseUnavailable>>;
}
