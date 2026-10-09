import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            'fastify',
            '@fastify/cors',
            '@fastify/helmet',
            '@fastify/rate-limit',
            '@fastify/swagger',
            '@scalar/fastify-api-reference',
            'fastify-type-provider-zod',
            '@bull-board/api',
            '@bull-board/fastify',
            'pino',
            'prom-client',
            'zod',
            '@aws-sdk/client-s3',
            '@aws-sdk/s3-request-presigner',
            'bullmq',
            'ioredis',
            'drizzle-orm',
            'postgres',
            '@casl/ability',
          ],
        },
      },
    },
  },
});
