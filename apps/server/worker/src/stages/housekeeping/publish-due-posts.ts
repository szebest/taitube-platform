import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';

export interface PublishDuePostsOptions {
  repositories: Repositories;
  now: () => number;
  scanLimit: number;
  logger?: Logger;
}

export interface PublishDuePostsResult {
  publishedCount: number;
}

/**
 * Publishes the scheduled posts whose time has come. Each goes through the compare-and-set on its
 * status that also writes the subscriber job, so two runs at once, or a retry, publish a post once.
 */
export async function runPublishDuePosts(
  options: PublishDuePostsOptions
): Promise<Result<PublishDuePostsResult, DatabaseUnavailable>> {
  const { repositories, now, scanLimit, logger } = options;

  const promoted = await repositories.channelPosts.promoteDue(new Date(now()), scanLimit);
  if (isErr(promoted)) return promoted;

  if (promoted.value.length > 0) {
    logger?.info({ postIds: promoted.value }, 'published scheduled posts that came due');
  }
  return ok({ publishedCount: promoted.value.length });
}
