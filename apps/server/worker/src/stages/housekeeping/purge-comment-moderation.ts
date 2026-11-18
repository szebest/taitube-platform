import type { Logger } from '@kit/logger';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { COMMENT_REMOVAL_RETENTION_DAYS, RESTRICTION_RETENTION_DAYS } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface PurgeCommentModerationOptions {
  repositories: Repositories;
  now: () => number;
  logger?: Logger;
}

export interface PurgeCommentModerationResult {
  removals: number;
  restrictions: number;
}

/**
 * Removal reasons are kept for the author's list for 30 days, and a restriction that ended is
 * absent at once and purged after 30 more. Nothing reads either past that, so a purge changes no answer.
 */
export async function runPurgeCommentModeration(
  options: PurgeCommentModerationOptions
): Promise<Result<PurgeCommentModerationResult, DatabaseUnavailable>> {
  const { repositories, now, logger } = options;

  const removals = await repositories.commentModeration.purgeRemovalsBefore(
    new Date(now() - COMMENT_REMOVAL_RETENTION_DAYS * MS_PER_DAY)
  );
  if (isErr(removals)) return removals;
  const restrictions = await repositories.channelUserRestrictions.purgeEndedBefore(
    new Date(now() - RESTRICTION_RETENTION_DAYS * MS_PER_DAY)
  );
  if (isErr(restrictions)) return restrictions;

  logger?.info(
    { removals: removals.value, restrictions: restrictions.value },
    'purged comment removals and ended restrictions past their retention'
  );
  return ok({ removals: removals.value, restrictions: restrictions.value });
}
