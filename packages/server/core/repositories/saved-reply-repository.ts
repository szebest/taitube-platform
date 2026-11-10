import type { SavedReply } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface SavedReplyDraft {
  title: string;
  body: string;
}

export interface SavedReplyRepositoryPort {
  /** By position, then creation order. */
  list(channelId: string): Promise<Result<SavedReply[], DatabaseUnavailable>>;
  /** Appends after the last position; `null` when the channel already holds `limit` replies. */
  create(
    channelId: string,
    draft: SavedReplyDraft,
    limit: number
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>>;
  /** `null` when the channel has no such reply. */
  update(
    channelId: string,
    id: string,
    patch: Partial<SavedReplyDraft & { position: number }>
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>>;
  /** `false` when the channel has no such reply. */
  remove(channelId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>>;
}
