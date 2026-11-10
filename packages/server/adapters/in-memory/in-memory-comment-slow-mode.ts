import type { CommentSlowModeClaim, CommentSlowModePort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export class InMemoryCommentSlowMode implements CommentSlowModePort {
  private readonly windowEnds = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  async claim(
    channelId: string,
    authorId: string,
    windowSeconds: number
  ): Promise<Result<CommentSlowModeClaim, CacheUnavailable>> {
    const key = `${channelId}:${authorId}`;
    const nowMs = this.now();
    const endsAtMs = this.windowEnds.get(key) ?? 0;
    if (endsAtMs > nowMs) {
      return ok({
        type: 'refused',
        retryAfterSeconds: Math.max(1, Math.ceil((endsAtMs - nowMs) / 1000)),
      });
    }
    this.windowEnds.set(key, nowMs + windowSeconds * 1000);
    return ok({ type: 'claimed' });
  }

  async release(channelId: string, authorId: string): Promise<Result<void, CacheUnavailable>> {
    this.windowEnds.delete(`${channelId}:${authorId}`);
    return ok();
  }

  clear(): void {
    this.windowEnds.clear();
  }
}
