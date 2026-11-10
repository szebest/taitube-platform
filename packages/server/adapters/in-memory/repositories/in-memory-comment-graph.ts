import type { Container } from '@vp/composition';
import { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import { InMemoryCommentModerationRepository } from './in-memory-comment-moderation-repository';
import { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import { InMemoryCommentRepository } from './in-memory-comment-repository';
import { InMemoryCommentSettingsRepository } from './in-memory-comment-settings-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryTrustedCommenterRepository } from './in-memory-trusted-commenter-repository';

/** The comment repositories and what moderates them, which need one another and the shared audit log. */
export function provideCommentRepositories(c: Container): Container {
  return c
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
    .provide(Repo.trustedCommenters, () => new InMemoryTrustedCommenterRepository())
    .provide(
      Repo.comments,
      (c) =>
        new InMemoryCommentRepository({
          channelsRepo: c.get(Repo.channels),
          videosRepo: c.get(Repo.videos),
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
