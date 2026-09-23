/**
 * Sources that still `catch` outside the boundary that converts a throw into a `Result`. The list
 * may only shrink: `catch-confinement.test.ts` fails both on a new breach and on a listed entry
 * that no longer catches, so it can never be appended to.
 *
 * Two kinds of entry live here and they are not the same promise. **Out of scope** entries are
 * named in ticket 84's own "Out of scope" section - process spawning, CLI tools and `apps/web` -
 * and will not shrink through this ticket; they are listed so the sweep stays total, not because
 * anyone is waiting on them. **Pending** entries are waiting on a specific conversion, and each
 * says which. A reader could not previously tell the two apart, which made the ratchet's shape
 * misleading: a list that cannot reach zero reads as a list nobody is working on.
 */

/** Out of ticket scope. These do not shrink through 84; a later ticket has to claim them. */
const OUT_OF_SCOPE: readonly string[] = [
  // Spawns FFmpeg and reads its exit code - a process boundary, not a port.
  'packages/server/ffmpeg/src/probe.ts',
  'packages/server/ffmpeg/src/transcode.ts',
  'packages/server/gen-video/src/generator.ts',
  'packages/server/gen-video/src/probe.ts',

  // CLI tools: the catch is the top-level handler that turns a failure into an exit code.
  'packages/server/dev-token/src/index.ts',
  'packages/server/upload-client/src/client.ts',
  'packages/server/compose-autoscaler/src/cli.ts',
  'packages/server/compose-autoscaler/src/runner.ts',

  // Telemetry setup, which must never fail the process it is instrumenting.
  'packages/server/observability/src/server.ts',
  'packages/server/observability/src/tracing.ts',
  'apps/api/src/plugins/metrics.ts',
  'apps/worker/src/with-telemetry.ts',

  // W9 is documentation only and the ticket forbids any apps/web change; tickets 53, 70 and 71 own
  // the browser side and build against the contract this ticket writes down.
  'apps/web/src/auth-token.ts',
  'apps/web/src/base-api.ts',
  'apps/web/src/modules/shared/providers/permissions-provider.tsx',

  // Build and migration entrypoints. Not domain code, and not reached by a request or a job.
  'apps/api/src/migrate.ts',
  'apps/worker/src/main.ts',
  'packages/server/db/src/migrate.ts',
  'packages/server/db/src/seed.ts',
  'scripts/check-boundaries.ts',
  'scripts/sync-claude-symlinks.ts',

  // Pre-handlers and the queue failure path: no reply to render into and no Result to return, so
  // ADR-24's backstop table routes them here deliberately.
  'apps/api/src/plugins/auth.ts',
  'apps/api/src/plugins/jwks-verifier.ts',
  'apps/worker/src/failure-handler.ts',
];

/** Waiting on a named conversion. Each goes when the thing it names returns a `Result`. */
const PENDING: readonly string[] = [
  // Goes with the W5 conversion of the service that owns the file.
  'apps/api/src/services/channel-service.ts',
  'apps/api/src/services/cursor.ts',
  'apps/api/src/services/feed-service.ts',
  'apps/api/src/services/sse-connection.ts',
  'apps/api/src/services/sse-hub.ts',
  'apps/api/src/services/upload-complete.ts',

  // Poll loops around a port that still throws; go with that port's W4 conversion.
  'apps/api/src/services/queue-poller.ts',
  'apps/api/src/services/sql-poller.ts',

  // Catches `HealthCheckable.checkHealth`, still a bare `Promise<boolean>` on the port ratchet.
  'apps/api/src/routes/health.ts',

  // Catches `QueueService.assertAdmin`; goes when that service returns its verdict.
  'apps/api/src/routes/admin/queues.ts',

  // Stage not yet converted; the catch wraps a StorageClient, JobQueue or MultipartStorage call
  // that still throws, so it goes with that port's W4 conversion rather than with the stage.
  'apps/worker/src/stages/housekeeping/outbox-relay.ts',
  'apps/worker/src/stages/housekeeping/purge-deleted.ts',
  'apps/worker/src/stages/housekeeping/reconcile-processing.ts',
  'apps/worker/src/stages/housekeeping/reconcile-uploads.ts',
  'apps/worker/src/stages/housekeeping/tmp-sweep.ts',
  'apps/worker/src/stages/notify.ts',
  'apps/worker/src/stages/package.ts',
  'apps/worker/src/stages/probe.ts',
  'apps/worker/src/stages/progress-reporter.ts',
  'apps/worker/src/stages/segment-uploader.ts',
  'apps/worker/src/stages/thumbnail.ts',
  'apps/worker/src/stages/transcode.ts',

  // Decodes an opaque cursor, so the catch is a parse boundary. Goes with INVALID_CURSOR.
  'packages/universal/pagination/src/cursor-codec.ts',
  'packages/universal/api-contracts/src/videos.ts',
  'packages/server/storage/src/keys.ts',
];

export const LEGACY_CATCH_SITES: readonly string[] = [...OUT_OF_SCOPE, ...PENDING].sort();

/** What is left for this ticket to do, as opposed to what a later one has to claim. */
export const PENDING_CATCH_SITES: readonly string[] = PENDING;
