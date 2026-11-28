import type { Result } from '@kit/result';
import type { ContentRef, VideoFormat } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/** What the link graph needs to know about one end of a link. */
export interface ResolvedContent {
  ref: ContentRef;
  channelId: string;
  ownerId: string;
  title: string;
  /** Anyone can see it: public, ready or published, not deleted, not held. */
  public: boolean;
  /** The video a card or chip plays: the video itself, a clip's, an episode's, a live stream's or a thread's. */
  mediaVideoId: string | null;
  durationMs: number | null;
  format: VideoFormat | null;
}

/**
 * Resolves content references to what they are, one lookup per kind however many refs of that
 * kind are asked for. A ref whose content is gone is absent from the answer.
 */
export interface ContentRefDirectoryPort {
  resolve(
    refs: readonly ContentRef[]
  ): Promise<Result<Map<string, ResolvedContent>, DatabaseUnavailable>>;
}
