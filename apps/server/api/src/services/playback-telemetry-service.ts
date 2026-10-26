import type { PlaybackEvent } from '@vp/api-contracts';
import type { ViewBufferPort } from '@vp/core/ports';
import { retentionPercentOf } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, ignore, ok } from '@vp/result';

export interface PlaybackTelemetryServiceDeps {
  viewBuffer: ViewBufferPort;
  metrics: PipelineMetrics;
}

/**
 * Turns the player's beacons into QoS metrics and retention steps. Nothing here fails a beacon: one
 * the buffer cannot take is a gap in a statistic, and a player that retried it would only resend it.
 */
export class PlaybackTelemetryService {
  constructor(private readonly deps: PlaybackTelemetryServiceDeps) {}

  async record(event: PlaybackEvent): Promise<Result<undefined, never>> {
    const { metrics, viewBuffer } = this.deps;
    if (event.eventType === 'playback_start') metrics.playbackStarts.inc();

    metrics.playbackWatchSeconds.inc(event.watchedSeconds);
    const stalledMs = event.rebufferingMs;
    const segmentMs = event.watchedSeconds * MS_PER_SECOND + stalledMs;
    if (segmentMs > 0) metrics.playbackRebufferingRatio.observe(stalledMs / segmentMs);

    ignore(
      await viewBuffer.recordRetention({
        videoId: event.videoId,
        sessionId: event.sessionUuid,
        percent: retentionPercentOf(event.currentTime, event.duration),
      }),
      'a retention step the buffer could not take is a gap in a statistic, and the beacon is not retried'
    );
    return ok(undefined);
  }
}
