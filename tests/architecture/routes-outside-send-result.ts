/**
 * Routes that still convert a `Result` somewhere other than `sendResult`. Shrink-only:
 * `routes-unwrap-at-send-result.test.ts` fails on a new one and on a listed file that has stopped.
 * The list is empty: every route now hands its failures to the one seam.
 */

export const ROUTES_OUTSIDE_SEND_RESULT: readonly string[] = [];
