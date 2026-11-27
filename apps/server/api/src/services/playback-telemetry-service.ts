import { MS_PER_SECOND } from '@kit/primitives';
import { type Result, ignore, isErr, ok, unwrapOr } from '@kit/result';
import type { ImpressionBatch, PlaybackEvent } from '@vp/api-contracts';
import type { ExperimentShown, ViewBufferPort } from '@vp/core/ports';
import type { ShareLinkRepository, VideoExperimentRepository } from '@vp/core/repositories';
import {
  type Experiment,
  type ExperimentMeasure,
  retentionPercentOf,
  viewBucketsOf,
} from '@vp/domain';
import type { PipelineMetrics } from '@vp/pipeline-metrics';
import { type ViewLimits, requiredWatchSeconds } from '@vp/validation';

type ShownVariant = ExperimentShown & { readonly videoId: string };

export interface PlaybackTelemetryServiceDeps {
  viewBuffer: ViewBufferPort;
  experiments: VideoExperimentRepository;
  shareLinks: ShareLinkRepository;
  metrics: PipelineMetrics;
  limits: ViewLimits;
  now: () => number;
}

/**
 * Turns the player's beacons into QoS metrics, retention steps, watch time and views: a session is a
 * view once its beacons add up to the minimum watch time, counted once per session and day, so the
 * player sends one beacon for all of it. A test variant or a share link counts only for the video it
 * belongs to, so nobody can skew another video's numbers. Nothing here fails a beacon: one the buffer
 * or a lookup cannot take is a gap in a statistic, and a player that retried it would only resend it.
 */
export class PlaybackTelemetryService {
  constructor(private readonly deps: PlaybackTelemetryServiceDeps) {}

  async record(event: PlaybackEvent): Promise<Result<undefined, never>> {
    const { metrics, viewBuffer } = this.deps;
    const [shown] = event.experiment
      ? await this.ownExperiments([{ ...event.experiment, videoId: event.videoId }])
      : [];
    const experiment = shown ? event.experiment : undefined;
    if (event.eventType === 'playback_start') {
      metrics.playbackStarts.inc();
      if (shown) await this.recordExperiments([shown], 'starts');
      if (event.playlistId) await this.recordPlaylistPlay(event.playlistId, event.videoId);
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
      shareLinkId: await this.ownShareLink(event.videoId, event.shareLinkId),
      experiment: experiment ?? null,
    });
    if (isErr(watch)) metrics.viewsRecorded.inc({ outcome: 'dropped' });
    else if (watch.value !== 'pending') metrics.viewsRecorded.inc({ outcome: watch.value });
    return ok(undefined);
  }

  async recordImpressions(batch: ImpressionBatch): Promise<Result<undefined, never>> {
    await this.recordExperiments(await this.ownExperiments(batch.items), 'impressions');
    return ok(undefined);
  }

  private async ownExperiments(shown: readonly ShownVariant[]): Promise<ShownVariant[]> {
    if (shown.length === 0) return [];
    const running = unwrapOr(
      await this.deps.experiments.runningFor([...new Set(shown.map(({ videoId }) => videoId))]),
      new Map<string, Experiment>()
    );
    return shown.filter(({ videoId, experimentId, variantId }) => {
      const experiment = running.get(videoId);
      return (
        experiment?.id === experimentId && experiment.variants.some(({ id }) => id === variantId)
      );
    });
  }

  private async ownShareLink(
    videoId: string,
    shareLinkId: string | undefined
  ): Promise<string | null> {
    if (!shareLinkId) return null;
    const link = unwrapOr(await this.deps.shareLinks.findById(shareLinkId), null);
    return link?.targetType === 'video' && link.targetId === videoId ? link.id : null;
  }

  /** A start on a watch page opened from a playlist is one of its plays, the video's own too. */
  private async recordPlaylistPlay(playlistId: string, videoId: string): Promise<void> {
    const { viewDate } = viewBucketsOf(new Date(this.deps.now()));
    ignore(
      await this.deps.viewBuffer.recordPlaylistEvents([
        { measure: 'plays', playlistId, videoId, viewDate },
      ]),
      'a play the buffer could not take is a gap in a statistic, and the beacon is not retried'
    );
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
