import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { VideoRecord } from './video-repository';

export interface RisingVideosOptions {
  /** Videos created before this never come back. */
  since: Date;
  /** The caller's own uploads never come back. */
  excludeOwnerId: string | null;
  excludeVideoIds: readonly string[];
  limit: number;
}

/**
 * Public ready videos, readable as the public feed reads them, from channels small enough and with
 * enough viewing sessions to count (`RISING` in `@vp/domain`), best completion first, one for each
 * channel. Eligibility and order are `rankRising`, so both implementations agree.
 */
export interface RisingVideosRepositoryPort {
  find(options: RisingVideosOptions): Promise<Result<VideoRecord[], DatabaseUnavailable>>;
}
