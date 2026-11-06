import { randomUUID } from 'node:crypto';
import type { CacheClient, LivePresencePort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { publishVideoEvent } from '@vp/events';
import type { Logger } from '@vp/logger';
import { isErr, type Result } from '@vp/result';

export interface LiveViewerTrackerDeps {
  presence: LivePresencePort;
  cache: Pick<CacheClient, 'publish'>;
  /** How long a viewer stays counted after its pod last touched it. */
  windowMs: number;
  now: () => number;
  logger: Logger;
}

interface Watched {
  videoId: string;
  viewers: Set<string>;
}

/**
 * Counts who has a broadcast's event stream open, across pods, and tells every viewer the count on
 * `live.viewers`. Each pod touches its own viewers on a heartbeat and publishes the count it reads.
 */
export class LiveViewerTracker {
  private readonly streams = new Map<string, Watched>();

  constructor(private readonly deps: LiveViewerTrackerDeps) {}

  /** Counts one viewer until `leave()`; the count reaches every viewer before this returns. */
  async watch(liveStreamId: string, videoId: string): Promise<{ leave(): Promise<void> }> {
    const viewerId = randomUUID();
    const watched = this.streams.get(liveStreamId) ?? { videoId, viewers: new Set<string>() };
    watched.viewers.add(viewerId);
    this.streams.set(liveStreamId, watched);

    await this.report(
      liveStreamId,
      videoId,
      'join',
      this.deps.presence.touch(liveStreamId, [viewerId], this.deps.now())
    );
    return {
      leave: async () => {
        watched.viewers.delete(viewerId);
        if (watched.viewers.size === 0) this.streams.delete(liveStreamId);
        await this.report(
          liveStreamId,
          videoId,
          'leave',
          this.deps.presence.leave(liveStreamId, viewerId)
        );
      },
    };
  }

  viewers(liveStreamId: string): Promise<Result<number, CacheUnavailable>> {
    return this.deps.presence.count(liveStreamId, this.deps.now() - this.deps.windowMs);
  }

  async beat(): Promise<void> {
    const at = this.deps.now();
    for (const [liveStreamId, { videoId, viewers }] of this.streams) {
      await this.report(
        liveStreamId,
        videoId,
        'beat',
        this.deps.presence.touch(liveStreamId, [...viewers], at)
      );
    }
  }

  private async report(
    liveStreamId: string,
    videoId: string,
    operation: string,
    changed: Promise<Result<void, CacheUnavailable>>
  ): Promise<void> {
    const done = await changed;
    const counted = isErr(done) ? done : await this.viewers(liveStreamId);
    const published = isErr(counted)
      ? counted
      : await publishVideoEvent({
          cache: this.deps.cache,
          videoId,
          event: 'live.viewers',
          data: { liveStreamId, viewers: counted.value },
          ts: this.deps.now(),
        });
    if (isErr(published)) {
      this.deps.logger.warn(
        { err: published.error, liveStreamId, operation },
        'viewer count not sent'
      );
    }
  }
}
