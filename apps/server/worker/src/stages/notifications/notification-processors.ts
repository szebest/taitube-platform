import type { AnyFailure } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { Result } from '@kit/result';
import type { JobQueue, QueueJob, WebhookDispatcher } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  ANNOUNCE_COMMENT_HELD,
  ANNOUNCE_LIVE,
  AnnounceCommentHeldJob,
  AnnounceLiveJob,
  NOTIFY_COMMENT,
  NOTIFY_HEART,
  NOTIFY_MODERATION,
  NOTIFY_PARTY_INVITE,
  NOTIFY_POST_SUBSCRIBERS,
  NOTIFY_PROCESSING,
  NOTIFY_SUBSCRIBERS,
  NOTIFY_TEAM_INVITE,
  NotifyCommentJob,
  NotifyHeartJob,
  NotifyModerationJob,
  NotifyPartyInviteJob,
  NotifyPostSubscribersJob,
  NotifyProcessingJob,
  NotifySubscribersJob,
  NotifyTeamInviteJob,
} from '@vp/job-contracts';
import { consuming } from '../../consuming';
import { createAnnounceCommentHeldProcessor } from './announce-comment-held';
import { createAnnounceLiveProcessor } from './announce-live';
import { createNotifyCommentProcessor } from './notify-comment';
import { createNotifyHeartProcessor } from './notify-heart';
import { createNotifyModerationProcessor } from './notify-moderation';
import { createNotifyPartyInviteProcessor } from './notify-party-invite';
import { createNotifyPostSubscribersProcessor } from './notify-post-subscribers';
import { createNotifyProcessingProcessor } from './notify-processing';
import { createNotifySubscribersProcessor } from './notify-subscribers';
import { createNotifyTeamInviteProcessor } from './notify-team-invite';

export interface NotificationProcessorDeps {
  repositories: Repositories;
  logger: Logger;
  getQueue: (name: string) => JobQueue;
  now: () => number;
  webhookDispatcher: WebhookDispatcher;
}

type NamedProcessor = (job: QueueJob<unknown>) => Promise<Result<unknown, AnyFailure>>;

/** Every job on the notify queue that creates notification rows or announces one, by its job name. */
export function notificationProcessors(
  deps: NotificationProcessorDeps
): Record<string, NamedProcessor> {
  const { repositories, logger, getQueue, now, webhookDispatcher } = deps;
  const rowDeps = { repositories, logger };
  const fanOut = { repositories, getQueue, logger };

  return {
    [NOTIFY_SUBSCRIBERS]: consuming(NotifySubscribersJob, createNotifySubscribersProcessor(fanOut)),
    [NOTIFY_POST_SUBSCRIBERS]: consuming(
      NotifyPostSubscribersJob,
      createNotifyPostSubscribersProcessor(fanOut)
    ),
    [ANNOUNCE_LIVE]: consuming(AnnounceLiveJob, createAnnounceLiveProcessor(fanOut)),
    [ANNOUNCE_COMMENT_HELD]: consuming(
      AnnounceCommentHeldJob,
      createAnnounceCommentHeldProcessor({ ...rowDeps, webhookDispatcher })
    ),
    [NOTIFY_COMMENT]: consuming(NotifyCommentJob, createNotifyCommentProcessor(rowDeps)),
    [NOTIFY_HEART]: consuming(NotifyHeartJob, createNotifyHeartProcessor(rowDeps)),
    [NOTIFY_PARTY_INVITE]: consuming(
      NotifyPartyInviteJob,
      createNotifyPartyInviteProcessor({ ...rowDeps, now })
    ),
    [NOTIFY_MODERATION]: consuming(NotifyModerationJob, createNotifyModerationProcessor(rowDeps)),
    [NOTIFY_TEAM_INVITE]: consuming(NotifyTeamInviteJob, createNotifyTeamInviteProcessor(rowDeps)),
    [NOTIFY_PROCESSING]: consuming(NotifyProcessingJob, createNotifyProcessingProcessor(rowDeps)),
  };
}
