/**
 * Routes that still convert a `Result` somewhere other than `sendResult`. Shrink-only:
 * `routes-unwrap-at-send-result.test.ts` fails on a new one and on a listed file that has stopped.
 * Each entry says what has to happen before it can go.
 */

export const ROUTES_OUTSIDE_SEND_RESULT: readonly string[] = [
  // `queueService.assertAdmin` throws, and this is an `onRequest` hook with no Result to return.
  // Goes when QueueService converts and the gate becomes `decideAdminAccess` in the route body.
  'apps/api/src/routes/admin/queues.ts',

  // Catches `HealthCheckable.checkHealth`, which is still a bare `Promise<boolean>` on the port
  // ratchet. Goes when that method returns a Result; the catch is the port's, not the route's.
  'apps/api/src/routes/health.ts',
];
