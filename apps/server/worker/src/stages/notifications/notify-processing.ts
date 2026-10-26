import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { mayHearAbout } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyProcessingJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';
import { usersSwitchedOn } from './notification-switches';

export interface NotifyProcessingDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyProcessingResult {
  videoId: string;
  recorded: boolean;
}

/** Tells an uploader that the video finished processing, or failed to. */
export function createNotifyProcessingProcessor(deps: NotifyProcessingDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyProcessing(
    job: QueueJob<NotifyProcessingJob>
  ): Promise<Result<NotifyProcessingResult, DatabaseUnavailable>> {
    const { videoId, outcome } = job.data;

    const video = await repositories.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!(video.value && mayHearAbout(video.value, video.value.ownerId))) {
      return ok({ videoId, recorded: false });
    }

    const { ownerId, title } = video.value;
    const switchedOn = await usersSwitchedOn(repositories, [ownerId], 'processing');
    if (isErr(switchedOn)) return switchedOn;
    if (!switchedOn.value.has(ownerId)) return ok({ videoId, recorded: false });

    const saved = await repositories.notifications.record({
      userId: ownerId,
      kind: 'processing',
      actorChannelId: null,
      videoId,
      commentId: null,
      groupKey: `processing:${videoId}`,
      payload: { actor: null, videoTitle: title, excerpt: null, outcome },
    });
    if (isErr(saved)) return saved;

    logger.info({ videoId, outcome }, 'told the uploader how processing ended');
    return ok({ videoId, recorded: saved.value !== null });
  };
}
