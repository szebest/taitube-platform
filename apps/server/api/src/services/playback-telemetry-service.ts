import type { PlaybackEvent } from '@vp/api-contracts';
import type { ViewBufferPort } from '@vp/core/ports';
import { retentionPercentOf, viewDateOf } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, ignore, isErr, ok } from '@vp/result';
import { type ViewLimits, requiredWatchSeconds } from '@vp/validation';

export interface PlaybackTelemetryServiceDeps {
  viewBuffer: ViewBufferPort;
  metrics: PipelineMetrics;
  limits: ViewLimits;
  now: () => number;
}

/**
 * Turns the player's beacons into QoS metrics, retention steps, watch time and views: a session is a
 * view once its beacons add up to the minimum watch time, counted once per session and day, so the
 * player sends one beacon for all of it. Nothing here fails a beacon: one the buffer cannot take is
 * a gap in a statistic, and a player that retried it would only resend it.
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

    const watch = await viewBuffer.recordPlayback({
      videoId: event.videoId,
      sessionId: event.sessionUuid,
      viewDate: viewDateOf(new Date(this.deps.now())),
      watchedSeconds: event.watchedSeconds,
      requiredSeconds: requiredWatchSeconds(event.duration, this.deps.limits),
    });
    if (isErr(watch)) metrics.viewsRecorded.inc({ outcome: 'dropped' });
    else if (watch.value !== 'pending') metrics.viewsRecorded.inc({ outcome: watch.value });
    return ok(undefined);
  }
}
