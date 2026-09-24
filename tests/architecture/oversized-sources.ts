/**
 * Production sources that stood over the 400-line / 10 KB ceiling when the ceiling
 * became machine-enforced. The list may only shrink: `file-ceiling.test.ts` fails both
 * on a file that is over and unlisted, and on a listed file that now fits.
 */
export const OVERSIZED_SOURCES: readonly string[] = [
  'packages/server/adapters/postgres/repositories/postgres-video-repository.ts',
  'packages/server/db/src/schema.ts',
];
