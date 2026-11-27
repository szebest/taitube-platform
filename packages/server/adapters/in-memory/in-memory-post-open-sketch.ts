import { ok, type Result } from '@kit/result';
import type { PostOpenSketchPort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';

export class InMemoryPostOpenSketch implements PostOpenSketchPort {
  private readonly seen = new Set<string>();

  async record(
    postId: string,
    viewerKey: string,
    day: string
  ): Promise<Result<boolean, CacheUnavailable>> {
    const key = `${postId}:${day}:${viewerKey}`;
    const fresh = !this.seen.has(key);
    this.seen.add(key);
    return ok(fresh);
  }

  clear(): void {
    this.seen.clear();
  }
}
