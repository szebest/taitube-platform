/**
 * Domain sources that still throw instead of returning a failure, as of the commit that made
 * ADR-24 machine-enforced. The categories slice is converted; the rest follow, and the list may
 * only shrink: `no-domain-throw.test.ts` fails both on a new thrower and on a listed file that
 * has since stopped throwing.
 */

export const THROWING_DOMAIN_SOURCES: readonly string[] = [
  'apps/api/src/services/channel-service.ts',
  'apps/api/src/services/cursor.ts',
  'apps/api/src/services/dlq-service.ts',
  'apps/api/src/services/queue-service.ts',
  'apps/api/src/services/reaction-service.ts',
  'apps/api/src/services/sse-hub.ts',
  'apps/api/src/services/sse-service.ts',
  'apps/api/src/services/subscription-service.ts',
  'apps/api/src/services/upload-abort.ts',
  'apps/api/src/services/upload-complete.ts',
  'apps/api/src/services/upload-context.ts',
  'apps/api/src/services/upload-parts.ts',
  'apps/api/src/services/video-lifecycle.ts',
  'apps/api/src/services/video-service.ts',
  'apps/worker/src/stages/housekeeping/index.ts',
  'apps/worker/src/stages/housekeeping/outbox-relay.ts',
  'apps/worker/src/stages/notify.ts',
  'apps/worker/src/stages/package.ts',
  'apps/worker/src/stages/probe.ts',
  'apps/worker/src/stages/segment-uploader.ts',
  'apps/worker/src/stages/thumbnail.ts',
  'apps/worker/src/stages/transcode.ts',
];
