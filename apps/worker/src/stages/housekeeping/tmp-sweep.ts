import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '@vp/observability';

export interface TmpSweepOptions {
  tmpDir?: string;
  thresholdMs?: number;
  logger?: Logger;
}

export interface TmpSweepResult {
  sweptCount: number;
}

/**
 * Sweeps orphaned temp directories on the housekeeping pod (SDD §9.8):
 * Remove orphaned /tmp/vp/* dirs older than 2 h (worker pods clean their own on exit).
 */
export async function runTmpSweep(options: TmpSweepOptions = {}): Promise<TmpSweepResult> {
  const {
    tmpDir = process.env['TMP_DIR'] ?? '/tmp/vp',
    thresholdMs = process.env['TMP_SWEEP_THRESHOLD_MS']
      ? Number.parseInt(process.env['TMP_SWEEP_THRESHOLD_MS'], 10)
      : 2 * 60 * 60 * 1000,
    logger,
  } = options;

  let sweptCount = 0;

  try {
    const entries = await fs.readdir(tmpDir, { withFileTypes: true }).catch(() => []);
    const cutoff = Date.now() - thresholdMs;

    for (const entry of entries) {
      const fullPath = path.join(tmpDir, entry.name);
      try {
        const stats = await fs.stat(fullPath);
        const mtime = stats.mtimeMs;
        if (mtime < cutoff) {
          await fs.rm(fullPath, { recursive: true, force: true });
          sweptCount += 1;
          logger?.info({ path: fullPath }, 'Swept stale temp directory/file');
        }
      } catch (err: unknown) {
        logger?.warn({ path: fullPath, err: (err as Error).message }, 'Failed to sweep temp path');
      }
    }
  } catch (err: unknown) {
    logger?.warn({ tmpDir, err: (err as Error).message }, 'Failed to read tmpDir for sweep');
  }

  return { sweptCount };
}
