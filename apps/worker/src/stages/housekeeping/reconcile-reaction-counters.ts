import type { ReactionCachePort, Repositories } from '@vp/core/ports';
import type { Logger } from '@vp/observability';

export interface ReconcileReactionCountersOptions {
  repositories: Repositories;
  reactionCache?: ReactionCachePort;
  logger?: Logger;
  limit?: number;
}

export interface ReconcileReactionCountersResult {
  checkedCount: number;
  repairedCount: number;
}

/**
 * Drift reconciler for video reaction counters (Ticket 40, SDD §9.8, AC 48-49).
 * Verifies that denormalized and cached reaction counters match ground-truth COUNT(*) from video_reactions,
 * repairing any detected drift automatically.
 */
export async function runReconcileReactionCounters(
  options: ReconcileReactionCountersOptions
): Promise<ReconcileReactionCountersResult> {
  const { repositories, reactionCache, logger, limit = 500 } = options;

  let checkedCount = 0;
  let repairedCount = 0;

  // 1. Gather distinct videos with reactions or active videos
  const videoIds = await repositories.videoReactions.listVideoIdsWithReactions(limit);

  for (const videoId of videoIds) {
    checkedCount++;

    // 2. Fetch ground-truth count from video_reactions
    const groundTruth = await repositories.videoReactions.countGroundTruth(videoId);

    // 3. Fetch denormalized counts on videos record
    const denormalized = await repositories.videoReactions.getReactionCounts(videoId);

    let hasDrift = false;

    if (
      denormalized.likesCount !== groundTruth.likesCount ||
      denormalized.dislikesCount !== groundTruth.dislikesCount
    ) {
      hasDrift = true;
      logger?.warn(
        {
          videoId,
          groundTruth,
          denormalized,
        },
        'Reaction counter drift detected in Postgres denormalized counters; repairing'
      );
      await repositories.videoReactions.updateVideoCounters(
        videoId,
        groundTruth.likesCount,
        groundTruth.dislikesCount
      );
    }

    // 4. Ensure Redis cache is consistent with ground-truth
    if (reactionCache) {
      await reactionCache.setCounts(videoId, groundTruth);
    }

    if (hasDrift) {
      repairedCount++;
    }
  }

  logger?.info(
    { checkedCount, repairedCount },
    'Completed video reaction counter reconciliation'
  );

  return {
    checkedCount,
    repairedCount,
  };
}
