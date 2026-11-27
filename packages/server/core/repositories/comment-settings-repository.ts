import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { CommentSettings, NewChannelAuditEntry } from '@vp/domain';

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
