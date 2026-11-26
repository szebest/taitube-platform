import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Runs a TypeScript entrypoint in a child of the runtime the spec runs on: Bun reads TypeScript as
 * it is, Node needs tsx, an optional peer resolved from this package rather than from the caller's
 * working directory, so a CI job without Bun still runs the specs that start a CLI.
 */
export function runEntrypoint(
  entrypoint: string,
  argv: readonly string[],
  env: Record<string, string | undefined>
): SpawnSyncReturns<string> {
  const loader = process.versions.bun
    ? []
    : ['--import', pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href];
  return spawnSync(process.execPath, [...loader, entrypoint, ...argv], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
  });
}
