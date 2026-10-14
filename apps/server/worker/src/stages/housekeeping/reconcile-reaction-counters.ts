import type { ReactionCachePort } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, ignore, isErr, isOk, ok } from '@vp/result';

export interface ReconcileReactionCountersOptions {
  repositories: Repositories;
  reactionCache: ReactionCachePort;
  logger?: Logger;
  limit: number;
}

export interface ReconcileReactionCountersResult {
  checkedCount: number;
  repairedCount: number;
}

interface Counts {
  likesCount: number;
  dislikesCount: number;
}

function drifted(left: Counts, right: Counts): boolean {
  return left.likesCount !== right.likesCount || left.dislikesCount !== right.dislikesCount;
}

/**
 * Repairs denormalized and cached reaction counters that drift from COUNT(*) over
 * video_reactions (SDD §9.8).
 *
 * `CacheUnavailable` is narrowed away: a cache that cannot answer reports no drift and a cache that
 * cannot be written is repaired by the next run, so only the database's failures reach the queue.
 */
export async function runReconcileReactionCounters(
  options: ReconcileReactionCountersOptions
): Promise<Result<ReconcileReactionCountersResult, DatabaseUnavailable>> {
  const { repositories, reactionCache, logger, limit } = options;

  let checkedCount = 0;
  let repairedCount = 0;

  const videoIds = await repositories.videoReactions.listVideoIdsWithReactions(limit);
  if (isErr(videoIds)) return videoIds;

  for (const videoId of videoIds.value) {
    checkedCount++;

    const truth = await repositories.videoReactions.countGroundTruth(videoId);
    if (isErr(truth)) return truth;
    const groundTruth = truth.value;

    const stored = await repositories.videoReactions.getReactionCounts(videoId);
    if (isErr(stored)) return stored;
    const denormalized = stored.value;

    let hasDrift = false;
    const cached = await reactionCache.getCounts(videoId, async () => stored);
    if (isOk(cached) && drifted(cached.value, groundTruth)) {
      hasDrift = true;
      logger?.warn(
        { videoId, groundTruth, cached: cached.value },
        'reaction counter drift detected in Redis cache; repairing'
      );
    }

    if (drifted(denormalized, groundTruth)) {
      hasDrift = true;
      logger?.warn(
        { videoId, groundTruth, denormalized },
        'reaction counter drift detected in Postgres denormalized counters; repairing'
      );
      const repaired = await repositories.videoReactions.updateVideoCounters(
        videoId,
        groundTruth.likesCount,
        groundTruth.dislikesCount
      );
      if (isErr(repaired)) return repaired;
    }

    if (hasDrift) {
      ignore(
        await reactionCache.setCounts(videoId, groundTruth),
        'the counters are repaired in Postgres; the cache heals on its TTL'
      );
      repairedCount++;
    }
  }

  logger?.info({ checkedCount, repairedCount }, 'completed video reaction counter reconciliation');

  return ok({ checkedCount, repairedCount });
}
