import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const ADAPTERS = 'packages/server/adapters';

/**
 * The adapter specs that run a port contract, against the Postgres, Redis and MinIO the
 * environment names instead of the PGlite and doubles `unit` gives them. One file at a time,
 * because every Postgres contract truncates the same database between its tests.
 */
export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  test: {
    name: 'integration',
    globals: true,
    environment: 'node',
    restoreMocks: true,
    unstubEnvs: true,
    include: [
      `${ADAPTERS}/postgres/repositories/__tests__/postgres-*-repository.test.ts`,
      `${ADAPTERS}/redis/__tests__/redis-cache-client.test.ts`,
      `${ADAPTERS}/redis/__tests__/redis-category-cache.adapter.test.ts`,
      `${ADAPTERS}/redis/__tests__/redis-subscription-cache.adapter.test.ts`,
      `${ADAPTERS}/redis/__tests__/redis-view-buffer.adapter.test.ts`,
      `${ADAPTERS}/s3/__tests__/s3-storage-client.test.ts`,
      `${ADAPTERS}/s3/__tests__/s3-multipart-storage.test.ts`,
      `${ADAPTERS}/bullmq/__tests__/bullmq-job-queue.test.ts`,
      `${ADAPTERS}/bullmq/__tests__/bullmq-flow-producer.test.ts`,
    ],
    testNamePattern: /^\w+ contract /,
    setupFiles: ['tests/integration/use-real-services.ts'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    bail: 1,
  },
});
