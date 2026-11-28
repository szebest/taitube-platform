import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';

export interface PromoteLayoutSchedulesOptions {
  repositories: Repositories;
  now: () => number;
  scanLimit: number;
  logger?: Logger;
}

export interface PromoteLayoutSchedulesResult {
  appliedCount: number;
}

export async function runPromoteLayoutSchedules(
  options: PromoteLayoutSchedulesOptions
): Promise<Result<PromoteLayoutSchedulesResult, DatabaseUnavailable>> {
  const { repositories, now, scanLimit, logger } = options;

  const applied = await repositories.channelLayoutSchedules.promoteDue(new Date(now()), scanLimit);
  if (isErr(applied)) return applied;

  if (applied.value.length > 0) {
    logger?.info({ scheduleIds: applied.value }, 'applied channel page schedules that came due');
  }
  return ok({ appliedCount: applied.value.length });
}
