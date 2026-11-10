import type { ChannelHandleRetirement } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Handles channels gave up. A row is written by the channel update that changes the handle, in the
 * same write, and removed when the owner takes the handle back; this port only reads and purges.
 */
export interface ChannelHandleHistoryRepositoryPort {
  findByHandle(
    handle: string
  ): Promise<Result<ChannelHandleRetirement | null, DatabaseUnavailable>>;
  /** Housekeeping: frees every handle retired before `cutoff`; answers how many. */
  purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}
