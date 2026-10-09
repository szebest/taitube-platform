import type { Repositories } from '@vp/core/repositories';
import type { PipelineMetrics } from '@vp/observability';
import { isOk } from '@vp/result';

/**
 * Writes `videos_by_status{status}` and `processing_steps_running_stale`. `time_to_ready_seconds`
 * is observed by the package stage when a video reaches READY, not here.
 */
export async function pollSqlMetrics(
  repositories: Repositories,
  metrics: PipelineMetrics,
  staleStepMs: number
): Promise<void> {
  const counts = await repositories.videos.countByStatus();
  if (isOk(counts)) {
    for (const [status, count] of Object.entries(counts.value)) {
      metrics.videosByStatus.set({ status }, count);
    }
  }

  const staleSteps = await repositories.steps.countRunningStale(staleStepMs);
  if (isOk(staleSteps)) {
    metrics.processingStepsRunningStale.set(staleSteps.value);
  }
}
