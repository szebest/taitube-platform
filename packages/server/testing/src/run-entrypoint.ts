import { type SpawnSyncReturns, spawnSync } from 'node:child_process';

/**
 * Runs a TypeScript entrypoint in a child of the runtime the spec runs on: Bun reads TypeScript as
 * it is, Node needs tsx, so a CI job without Bun still runs the specs that start a CLI.
 */
export function runEntrypoint(
  entrypoint: string,
  argv: readonly string[],
  env: Record<string, string | undefined>
): SpawnSyncReturns<string> {
  const loader = process.versions.bun ? [] : ['--import', 'tsx'];
  return spawnSync(process.execPath, [...loader, entrypoint, ...argv], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
  });
}
