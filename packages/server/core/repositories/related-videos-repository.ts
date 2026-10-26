import type { RelatedSignals } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { VideoRecord } from './video-repository';

export interface RelatedVideosOptions {
  videoId: string;
  ownerId: string;
  categoryId: string | null;
  tags: readonly string[];
  /** The caller's own uploads never come back. */
  excludeOwnerId: string | null;
  limit: number;
}

export interface RelatedVideo {
  video: VideoRecord;
  signals: RelatedSignals;
}

/**
 * Public ready videos that share at least one signal with the anchor, best first: co-watch, shared
 * tags, same channel, same category, then views. The anchor itself is never in the answer.
 */
export interface RelatedVideosRepositoryPort {
  find(options: RelatedVideosOptions): Promise<Result<RelatedVideo[], DatabaseUnavailable>>;
}
