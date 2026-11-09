import type { CommentSettings } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface CommentSettingsRepositoryPort {
  /** A channel that never saved settings has the defaults. */
  get(channelId: string): Promise<Result<CommentSettings, DatabaseUnavailable>>;
  /** Replaces the whole document, creating the row on the first save. */
  save(
    channelId: string,
    settings: CommentSettings
  ): Promise<Result<CommentSettings, DatabaseUnavailable>>;
}
