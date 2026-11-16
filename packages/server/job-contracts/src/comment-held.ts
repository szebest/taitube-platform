import { z } from 'zod';
import { notificationOutbox } from './notifications';

/** Not a notification row: tells the webhooks of the people told a comment was held. */
export const ANNOUNCE_COMMENT_HELD = 'announce-comment-held';

export const AnnounceCommentHeldJob = z.object({
  /** One per hold, so a comment held again after an edit is announced again. */
  holdId: z.uuid(),
  commentId: z.uuid(),
  videoId: z.uuid(),
  recipients: z.array(z.uuid()).min(1),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type AnnounceCommentHeldJob = z.infer<typeof AnnounceCommentHeldJob>;

export const commentHeldOutbox = (job: AnnounceCommentHeldJob) =>
  notificationOutbox({
    name: ANNOUNCE_COMMENT_HELD,
    data: job,
    jobId: `${job.holdId}--${ANNOUNCE_COMMENT_HELD}`,
  });
