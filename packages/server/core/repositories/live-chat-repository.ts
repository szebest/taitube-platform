import type { LiveChatMessage, NewLiveChatMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface LiveChatOffsetRange {
  /** Inclusive. */
  fromMs: number;
  /** Exclusive. */
  toMs: number;
  limit: number;
}

/** A stream's chat, removed lines left out of every read. */
export interface LiveChatRepositoryPort {
  append(message: NewLiveChatMessage): Promise<Result<LiveChatMessage, DatabaseUnavailable>>;
  /**
   * Oldest first. After `afterId`, the first `limit` lines; with no cursor, the newest `limit`,
   * which is what a viewer joining mid-broadcast scrolls back through.
   */
  listAfter(
    liveStreamId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>>;
  /** Ordered by offset, then id: the order a replay shows them in. */
  listByOffset(
    liveStreamId: string,
    range: LiveChatOffsetRange
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>>;
  /** Whether a line of this stream was there to remove. */
  remove(
    liveStreamId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
