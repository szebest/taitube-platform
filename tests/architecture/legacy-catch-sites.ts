/**
 * Sources that `catch` outside the boundary that converts a throw into a `Result`. The list may
 * only shrink: `catch-confinement.test.ts` fails both on a new breach and on a listed entry that
 * no longer catches, so it can never be appended to.
 *
 * Every entry left is a spawned process or telemetry that must never fail what it instruments.
 * The CLIs, the browser, and the build and migration entrypoints convert through `tryCatch` /
 * `fromPromise` now; a CLI's `main().catch(...)` exit-code handler is a method call, not a block.
 */
export const LEGACY_CATCH_SITES: readonly string[] = [
  // Spawns FFmpeg and reads its exit code - a process boundary, not a port.
  'packages/server/ffmpeg/src/probe.ts',

  // Telemetry setup, which must never fail the process it is instrumenting.
  'apps/worker/src/with-telemetry.ts',
].sort();
