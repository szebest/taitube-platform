import type { Container } from '@kit/composition';
import { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import { InMemoryCommentModerationRepository } from './in-memory-comment-moderation-repository';
import { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import { InMemoryCommentRepository } from './in-memory-comment-repository';
import { InMemoryCommentSettingsRepository } from './in-memory-comment-settings-repository';
import { InMemoryPostEngagementRepository } from './in-memory-post-engagement-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryTrustedCommenterRepository } from './in-memory-trusted-commenter-repository';

/**
 * The comment repositories, what moderates them and the posts they sit under, which need one
 * another and the shared audit log.
 */
export function provideCommentRepositories(c: Container): Container {
  return c
    .provide(
      Repo.channelPosts,
      (c) =>
        new InMemoryChannelPostRepository({
          auditRepo: c.get(Repo.channelAudit),
          outboxRepo: c.get(Repo.outbox),
          subscriptionsRepo: c.get(Repo.subscriptions),
          removeComments: (target) => c.get(Repo.comments).removeTarget(target),
        })
    )
    .provide(
      Repo.postEngagement,
      (c) => new InMemoryPostEngagementRepository({ posts: c.get(Repo.channelPosts) })
    )
    .provide(
      Repo.commentSettings,
      (c) => new InMemoryCommentSettingsRepository({ audit: c.get(Repo.channelAudit) })
    )
    .provide(
      Repo.channelUserRestrictions,
      (c) =>
        new InMemoryChannelUserRestrictionRepository({
          auditRepo: c.get(Repo.channelAudit),
          outboxRepo: c.get(Repo.outbox),
          recount: (channelId, userId) => c.get(Repo.commentModeration).recount(channelId, userId),
        })
    )
    .provide(
      Repo.trustedCommenters,
      (c) => new InMemoryTrustedCommenterRepository({ auditRepo: c.get(Repo.channelAudit) })
    )
    .provide(
      Repo.comments,
      (c) =>
        new InMemoryCommentRepository({
          channelsRepo: c.get(Repo.channels),
          videosRepo: c.get(Repo.videos),
          postsRepo: c.get(Repo.channelPosts),
          outboxRepo: c.get(Repo.outbox),
          auditRepo: c.get(Repo.channelAudit),
          reportsRepo: c.get(Repo.commentReports),
          userEventsRepo: c.get(Repo.userEvents),
          restrictionsRepo: c.get(Repo.channelUserRestrictions),
        })
    )
    .provide(
      Repo.commentModeration,
      (c) =>
        new InMemoryCommentModerationRepository({
          commentsRepo: c.get(Repo.comments),
          videosRepo: c.get(Repo.videos),
          postsRepo: c.get(Repo.channelPosts),
          channelsRepo: c.get(Repo.channels),
          restrictionsRepo: c.get(Repo.channelUserRestrictions),
          auditRepo: c.get(Repo.channelAudit),
          outboxRepo: c.get(Repo.outbox),
          userEventsRepo: c.get(Repo.userEvents),
        })
    )
    .provide(
      Repo.commentReports,
      (c) =>
        new InMemoryCommentReportRepository({
          commentsRepo: { peek: (id) => c.get(Repo.comments).peek(id) },
        })
    );
}
