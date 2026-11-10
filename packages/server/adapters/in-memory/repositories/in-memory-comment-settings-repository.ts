import type { CommentSettingsRepositoryPort } from '@vp/core/repositories';
import {
  type CommentSettings,
  DEFAULT_COMMENT_SETTINGS,
  type NewChannelAuditEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { andThenAsync, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';

export interface InMemoryCommentSettingsRepositoryOptions {
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
}

export class InMemoryCommentSettingsRepository implements CommentSettingsRepositoryPort {
  private readonly documents = new Map<string, CommentSettings>();

  constructor(private readonly deps: InMemoryCommentSettingsRepositoryOptions) {}

  async get(channelId: string): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    return ok(this.documents.get(channelId) ?? DEFAULT_COMMENT_SETTINGS);
  }

  async save(
    channelId: string,
    settings: CommentSettings,
    audit: NewChannelAuditEntry
  ): Promise<Result<CommentSettings, DatabaseUnavailable>> {
    return andThenAsync(await this.deps.audit.append(audit), async () => {
      const stored = { ...settings };
      this.documents.set(channelId, stored);
      return ok({ ...stored });
    });
  }

  clear(): void {
    this.documents.clear();
  }
}
