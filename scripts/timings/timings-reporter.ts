import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import type { Reporter, TestModule, Vitest } from 'vitest/node';

/** Everything a spec file costs its worker: the environment, the harness, the import and the tests. */
export function moduleCost(module: Pick<TestModule, 'diagnostic'>): number {
  const { environmentSetupDuration, prepareDuration, collectDuration, setupDuration, duration } =
    module.diagnostic();
  return Math.round(
    environmentSetupDuration + prepareDuration + collectDuration + setupDuration + duration
  );
}

/**
 * Writes each spec file's cost, by its path from the root, to `--outputFile.timings=<file>`;
 * `pnpm timings:update` sums the shards' files into `tests/timings/unit.json`.
 */
export default class TimingsReporter implements Reporter {
  private vitest: Vitest | undefined;

  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  onTestRunEnd(modules: readonly TestModule[]): void {
    const config = this.vitest?.config;
    const file = typeof config?.outputFile === 'object' ? config.outputFile.timings : undefined;
    if (!(config && file)) return;
    const costs = modules.map((module) => [
      relative(config.root, module.moduleId),
      moduleCost(module),
    ]);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(costs)}\n`);
  }
}
