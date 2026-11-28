import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { ENTITY_REVISION_KEEP } from '@vp/domain';

export interface PruneRevisionsOptions {
  repositories: Repositories;
  logger?: Logger;
}

export interface PruneRevisionsResult {
  purgedCount: number;
}

/** History is truncated here, never rewritten: the newest revisions of every entity stay. */
export async function runPruneRevisions(
  options: PruneRevisionsOptions
): Promise<Result<PruneRevisionsResult, DatabaseUnavailable>> {
  const { repositories, logger } = options;

  const pruned = await repositories.entityRevisions.prune(ENTITY_REVISION_KEEP);
  if (isErr(pruned)) return pruned;

  logger?.info({ purgedCount: pruned.value }, 'pruned revisions past the newest 50 of each entity');
  return ok({ purgedCount: pruned.value });
}
