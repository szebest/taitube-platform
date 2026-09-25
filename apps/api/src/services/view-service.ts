import type { ViewTelemetryInput, ViewReceipt } from '@vp/api-contracts';
import type { ViewBufferPort, ViewRecordOutcome } from '@vp/core/ports';
import { viewDateOf } from '@vp/domain';
import type { PipelineMetrics } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';
import { type ViewLimits, qualifyView } from '@vp/validation';

export interface ViewServiceDeps {
  viewBuffer: ViewBufferPort;
  metrics: PipelineMetrics;
  limits: ViewLimits;
  now: () => number;
}

export interface RecordViewInput {
  videoId: string;
  viewer: UserContext | null;
  telemetry: ViewTelemetryInput;
}

type RecordOutcome = ViewRecordOutcome | 'discarded';

/**
 * Takes playback beacons without a database connection. Nothing here fails a beacon: a view that
 * does not qualify, repeats, or finds the buffer unreachable is still accepted, because a player
 * that retries on an error would only send it again.
 */
export class ViewService {
  constructor(private readonly deps: ViewServiceDeps) {}

  async record(input: RecordViewInput): Promise<Result<ViewReceipt, never>> {
    const outcome = await this.outcomeOf(input);
    this.deps.metrics.viewsRecorded.inc({ outcome });
    return ok({ videoId: input.videoId });
  }

  private async outcomeOf(input: RecordViewInput): Promise<RecordOutcome> {
    const qualified = qualifyView(input.telemetry, this.deps.limits);
    if (isErr(qualified)) return 'discarded';

    const recorded = await this.deps.viewBuffer.record({
      videoId: input.videoId,
      viewerId: input.viewer?.id ?? qualified.value.sessionId,
      viewDate: viewDateOf(new Date(this.deps.now())),
      watchSeconds: Math.round(qualified.value.watchSeconds),
    });
    return isErr(recorded) ? 'dropped' : recorded.value;
  }
}
