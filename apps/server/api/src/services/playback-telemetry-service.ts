import { MS_PER_SECOND } from '@kit/primitives';
import { type Result, ignore, isErr, ok } from '@kit/result';
import type { ImpressionBatch, PlaybackEvent } from '@vp/api-contracts';
import type { ExperimentShown, ViewBufferPort } from '@vp/core/ports';
import { type ExperimentMeasure, retentionPercentOf, viewBucketsOf } from '@vp/domain';
import type { PipelineMetrics } from '@vp/pipeline-metrics';
import { type ViewLimits, requiredWatchSeconds } from '@vp/validation';

type ShownVariant = ExperimentShown & { readonly videoId: string };

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
    if (event.eventType === 'playback_start') {
      metrics.playbackStarts.inc();
      if (event.experiment) {
        await this.recordExperiments([{ ...event.experiment, videoId: event.videoId }], 'starts');
      }
    }

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
      ...viewBucketsOf(new Date(this.deps.now())),
      device: event.device ?? 'unknown',
      watchedSeconds: event.watchedSeconds,
      requiredSeconds: requiredWatchSeconds(event.duration, this.deps.limits),
      shareLinkId: event.shareLinkId ?? null,
      experiment: event.experiment ?? null,
    });
    if (isErr(watch)) metrics.viewsRecorded.inc({ outcome: 'dropped' });
    else if (watch.value !== 'pending') metrics.viewsRecorded.inc({ outcome: watch.value });
    return ok(undefined);
  }

  async recordImpressions(batch: ImpressionBatch): Promise<Result<undefined, never>> {
    await this.recordExperiments(batch.items, 'impressions');
    return ok(undefined);
  }

  private async recordExperiments(
    shown: readonly ShownVariant[],
    measure: ExperimentMeasure
  ): Promise<void> {
    const { viewDate } = viewBucketsOf(new Date(this.deps.now()));
    ignore(
      await this.deps.viewBuffer.recordExperimentEvents(
        shown.map(({ videoId, experimentId, variantId }) => ({
          videoId,
          experimentId,
          variantId,
          viewDate,
          measure,
        }))
      ),
      'a test event the buffer could not take is a gap in a statistic, and the beacon is not retried'
    );
  }
}
