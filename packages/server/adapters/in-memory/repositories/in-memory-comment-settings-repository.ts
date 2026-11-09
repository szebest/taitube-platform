import type { CommentSettingsRepositoryPort } from '@vp/core/repositories';
import { type CommentSettings, DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export class InMemoryCommentSettingsRepository implements CommentSettingsRepositoryPort {
  private readonly documents = new Map<string, CommentSettings>();

  async get(channelId: string): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    return ok(this.documents.get(channelId) ?? DEFAULT_COMMENT_SETTINGS);
  }

  async save(
    channelId: string,
    settings: CommentSettings
  ): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    const stored = { ...settings };
    this.documents.set(channelId, stored);
    return ok({ ...stored });
  }

  clear(): void {
    this.documents.clear();
  }
}
