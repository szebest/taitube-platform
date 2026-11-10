import { PostgresChannelUserRestrictionRepository } from './postgres-channel-user-restriction-repository';
import { PostgresCommentModerationRepository } from './postgres-comment-moderation-repository';
import { PostgresCommentReportRepository } from './postgres-comment-report-repository';
import { PostgresCommentRepository } from './postgres-comment-repository';
import { PostgresCommentSettingsRepository } from './postgres-comment-settings-repository';
import { PostgresSavedReplyRepository } from './postgres-saved-reply-repository';
import { PostgresTrustedCommenterRepository } from './postgres-trusted-commenter-repository';
import type { PostgresDatabase } from './types';

export function createCommentRepositories(db: PostgresDatabase) {
  return {
    commentSettings: new PostgresCommentSettingsRepository(db),
    channelUserRestrictions: new PostgresChannelUserRestrictionRepository(db),
    trustedCommenters: new PostgresTrustedCommenterRepository(db),
    savedReplies: new PostgresSavedReplyRepository(db),
    comments: new PostgresCommentRepository(db),
    commentModeration: new PostgresCommentModerationRepository(db),
    commentReports: new PostgresCommentReportRepository(db),
  };
}

export type CommentRepositories = ReturnType<typeof createCommentRepositories>;
