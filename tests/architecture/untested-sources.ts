/**
 * Production sources without the sibling `__tests__/<name>.test.ts` Rule 12 mandates,
 * as of the commit that made Rule 12 machine-enforced. The list may only shrink:
 * `test-correspondence.test.ts` fails both on an uncovered source that is not listed,
 * and on a listed source that has since gained its spec.
 */
export const UNTESTED_SOURCES: readonly string[] = [
  'packages/server/core/repositories/video-repository.ts',
  'packages/server/db/src/migrate.ts',
  'packages/server/db/src/seed.ts',
];
