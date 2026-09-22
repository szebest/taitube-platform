/**
 * Production sources that stood over the 400-line / 10 KB ceiling when the ceiling
 * became machine-enforced. The list may only shrink: `file-ceiling.test.ts` fails both
 * on a file that is over and unlisted, and on a listed file that now fits.
 */
export const OVERSIZED_SOURCES: readonly string[] = [
  'apps/worker/src/stages/transcode.ts',
  'packages/server/adapters/bullmq/bullmq-job-queue.ts',
  'packages/server/adapters/in-memory/repositories/in-memory-video-repository.ts',
  'packages/server/adapters/postgres/repositories/postgres-video-repository.ts',
  'packages/server/adapters/s3/s3-storage-client.ts',
  'packages/server/db/src/schema.ts',
  'packages/server/gen-video/src/generator.ts',
  'packages/server/upload-client/src/client.ts',
];
