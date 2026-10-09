import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '@vp/logger';
import { fromPromise, isOk, unwrapOr } from '@vp/result';

export interface TmpSweepOptions {
  tmpDir: string;
  thresholdMs: number;
  logger?: Logger;
}

export interface TmpSweepResult {
  sweptCount: number;
}

/**
 * Removes scratch directories older than the threshold that a worker left behind on the shared tmp
 * root (SDD §9.8); a worker removes its own on exit, so what is left here was orphaned by a crash.
 */
export async function runTmpSweep(options: TmpSweepOptions): Promise<TmpSweepResult> {
  const { tmpDir, thresholdMs, logger } = options;

  const entries = unwrapOr(
    await fromPromise(
      () => fs.readdir(tmpDir, { withFileTypes: true }),
      (cause) => cause
    ),
    []
  );
  const cutoff = Date.now() - thresholdMs;

  let sweptCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(tmpDir, entry.name);
    const stats = await fromPromise(
      () => fs.stat(fullPath),
      (cause) => cause
    );
    if (!isOk(stats) || stats.value.mtimeMs >= cutoff) continue;

    const removed = await fromPromise(
      () => fs.rm(fullPath, { recursive: true, force: true }),
      (cause) => cause
    );

    if (isOk(removed)) {
      sweptCount += 1;
      logger?.info({ path: fullPath }, 'swept stale temp directory/file');
    } else {
      logger?.warn({ path: fullPath }, 'failed to sweep temp path');
    }
  }

  return { sweptCount };
}
