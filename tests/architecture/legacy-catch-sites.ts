/**
 * Sources that `catch` outside the boundary that converts a throw into a `Result`. The list may
 * only shrink: `catch-confinement.test.ts` fails both on a new breach and on a listed entry that
 * no longer catches, so it can never be appended to.
 *
 * Every entry left is a boundary ticket 84 named out of its own scope: a spawned process, a CLI's
 * top-level exit-code handler, telemetry that must never fail what it instruments, a build or
 * migration entrypoint, and `apps/web` (tickets 53, 70 and 71 own the browser side). The half that
 * was waiting on a conversion is gone - the ports, the services and the stages all return now.
 */
export const LEGACY_CATCH_SITES: readonly string[] = [
  // Spawns FFmpeg and reads its exit code - a process boundary, not a port.
  'packages/server/ffmpeg/src/probe.ts',
  'packages/server/gen-video/src/generator.ts',
  'packages/server/gen-video/src/probe.ts',

  // CLI tools: the catch is the top-level handler that turns a failure into an exit code.
  'packages/server/dev-token/src/main.ts',
  'packages/server/upload-client/src/client.ts',
  'packages/server/compose-autoscaler/src/main.ts',
  'packages/server/compose-autoscaler/src/runner.ts',

  // Telemetry setup, which must never fail the process it is instrumenting.
  'apps/worker/src/with-telemetry.ts',

  // W9 is documentation only and the ticket forbids any apps/web change; tickets 53, 70 and 71 own
  // the browser side and build against the contract this ticket writes down.
  'apps/web/src/auth-token.ts',
  'apps/web/src/base-api.ts',
  'apps/web/src/modules/shared/providers/permissions-provider.tsx',

  // Build and migration entrypoints. Not domain code, and not reached by a request or a job.
  'apps/api/src/migrate.ts',
  'packages/server/db/src/migrate.ts',
  'packages/server/db/src/seed.ts',
  'scripts/check-boundaries.ts',
  'scripts/sync-claude-symlinks.ts',
].sort();
