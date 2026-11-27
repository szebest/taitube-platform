import type { Result } from '@kit/result';
import type { CacheUnavailable } from '@vp/errors';

/** Which viewers opened a post on a day, kept as a sketch so a post costs a few kilobytes however many open it. */
export interface PostOpenSketchPort {
  /** True when this viewer is new to the post that day; the sketch may rarely call a new viewer seen. */
  record(
    postId: string,
    viewerKey: string,
    day: string
  ): Promise<Result<boolean, CacheUnavailable>>;
}
