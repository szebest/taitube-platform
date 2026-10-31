import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * The videos a creator pinned to the channel's Start here shelf. The store keeps what was saved,
 * whatever state each video is in since: which pins still show is the service's decision.
 */
export interface ChannelFeaturedRepositoryPort {
  /** The pinned video ids in display order. */
  listForChannel(channelId: string): Promise<Result<string[], DatabaseUnavailable>>;
  /**
   * Swaps the whole set for `videoIds`, in that order, all or nothing: a video that is gone fails
   * the write and leaves the previous set as it was.
   */
  replace(
    channelId: string,
    videoIds: readonly string[]
  ): Promise<Result<void, DatabaseUnavailable>>;
}
