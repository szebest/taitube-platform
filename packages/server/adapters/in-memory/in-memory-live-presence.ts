import type { LivePresencePort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export class InMemoryLivePresence implements LivePresencePort {
  private readonly streams = new Map<string, Map<string, number>>();

  async touch(
    liveStreamId: string,
    viewerIds: readonly string[],
    atMs: number
  ): Promise<Result<void, CacheUnavailable>> {
    const viewers = new Map(this.streams.get(liveStreamId));
    for (const viewerId of viewerIds) viewers.set(viewerId, atMs);
    this.streams.set(liveStreamId, viewers);
    return ok();
  }

  async leave(liveStreamId: string, viewerId: string): Promise<Result<void, CacheUnavailable>> {
    this.streams.get(liveStreamId)?.delete(viewerId);
    return ok();
  }

  async count(liveStreamId: string, sinceMs: number): Promise<Result<number, CacheUnavailable>> {
    const viewers = [...(this.streams.get(liveStreamId)?.values() ?? [])];
    return ok(viewers.filter((touchedAt) => touchedAt >= sinceMs).length);
  }

  clear(): void {
    this.streams.clear();
  }
}
