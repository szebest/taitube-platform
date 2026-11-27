import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { QueueJob } from '@kit/ports';
import { isErr, ok, type Result } from '@kit/result';
import type { WebhookDispatcher } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AnnounceCommentHeldJob } from '@vp/job-contracts';
import { createWebhookFanout } from '../webhook-fanout';

export interface AnnounceCommentHeldDeps {
  repositories: Repositories;
  webhookDispatcher: WebhookDispatcher;
  logger: Logger;
}

export interface AnnounceCommentHeldResult {
  commentId: string;
  /** `null` when the video or its channel is gone and nobody was told. */
  channelId: string | null;
}

/**
 * Tells the `comment.held` webhooks of everyone the hold reached. The payload is ids and the
 * channel, never the text: a webhook target is outside the platform, and the comment is a viewer's.
 */
export function createAnnounceCommentHeldProcessor(deps: AnnounceCommentHeldDeps) {
  const { repositories, webhookDispatcher, logger } = deps;
  const announce = createWebhookFanout({
    webhooks: repositories.webhooks,
    dispatcher: webhookDispatcher,
    logger,
  });

  return async function processAnnounceCommentHeld(
    job: QueueJob<AnnounceCommentHeldJob>
  ): Promise<Result<AnnounceCommentHeldResult, DatabaseUnavailable>> {
    const { commentId, videoId, recipients } = job.data;

    const video = await repositories.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!video.value) return ok({ commentId, channelId: null });
    const { channelId } = video.value;

    const payload = { commentId, videoId, channelId };
    for (const userId of recipients) await announce(userId, 'comment.held', payload);
    return ok({ commentId, channelId });
  };
}
