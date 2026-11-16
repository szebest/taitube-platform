import { groupDocs } from './env-doc';

export const CORE_DOCS = groupDocs('core', {
  NODE_ENV: {
    description:
      'The runtime mode. production turns on the boot guards (secrets required, dev auth and wildcard CORS refused); test silences logs and tracing.',
    example: 'production',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  LOG_LEVEL: {
    description:
      'The pino log level of the API and the worker. A level above info hides the request and stage logs you debug with.',
    example: 'info',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  SERVICE_VERSION: {
    description:
      'The build identifier reported as the service version in telemetry. The Dockerfile sets it to the git sha; locally it stays dev.',
    example: 'a1b2c3d',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  ADAPTER_FAMILY: {
    description:
      'Which adapter family the container registers: external talks to Postgres, Redis and S3, in-memory is for in-process tests only. A deployed process on in-memory loses everything on restart.',
    example: 'external',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  CORS_ORIGINS: {
    description:
      'Comma list of browser origins the API allows. Production refuses an empty list or *; a missing origin makes the browser block every API call from that app.',
    example: 'https://taitube.local',
    visibility: 'public',
    readBy: ['api'],
  },
  TRUST_PROXY: {
    description:
      'Comma list of proxy addresses, CIDRs or names (loopback, uniquelocal) whose X-Forwarded-For the API trusts. Empty trusts none, so every client appears to come from the proxy.',
    example: 'uniquelocal',
    visibility: 'public',
    readBy: ['api'],
  },
  HTTP_BODY_LIMIT_BYTES: {
    description:
      'The cap on a JSON request body. Uploads go straight to object storage, so this only bounds API payloads; larger bodies are rejected with 413.',
    example: '1048576',
    visibility: 'public',
    readBy: ['api'],
  },
  PORT: {
    description:
      'The port the API listens on. Another process on it fails the boot with EADDRINUSE.',
    example: '3000',
    visibility: 'public',
    readBy: ['api'],
  },
  METRICS_PORT: {
    description:
      'The port the Prometheus metrics endpoint listens on, for the API and each worker. Two processes on one host need different values.',
    example: '9464',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  PAGE_SIZE_DEFAULT: {
    description:
      'The keyset page size when a request omits ?limit. Keep it at or below PAGE_SIZE_MAX.',
    example: '20',
    visibility: 'public',
    readBy: ['api'],
  },
  PAGE_SIZE_MAX: {
    description:
      'The largest page a request can ask for. A larger ?limit is clamped to it, never rejected.',
    example: '100',
    visibility: 'public',
    readBy: ['api'],
  },
  FEATURE_FLAGS: {
    description:
      'Comma list of flags GET /v1/bootstrap reports as enabled to the client apps. Empty means none.',
    example: 'live,watch-party',
    visibility: 'public',
    readBy: ['api'],
  },
  WEB_URL: {
    description:
      "The web app's public origin: oEmbed answers and webhook payloads link to it. Keep it equal to VITE_WEB_URL or shared links point at the wrong host.",
    example: 'https://taitube.local',
    visibility: 'public',
    readBy: ['api'],
  },
  WEBHOOK_ALLOW_PRIVATE_HOSTS: {
    description:
      'Lets a webhook URL be plain http or name a private host, for local receivers. Production refuses true because a webhook could then reach the internal network.',
    example: 'false',
    visibility: 'public',
    readBy: ['api'],
  },
});

export const POSTGRES_DOCS = groupDocs('postgres', {
  DATABASE_URL: {
    description:
      'The Postgres connection string the API and workers query through. Use the pooled host when the provider has one; a wrong value fails the boot at the first query.',
    example: '<postgres connection string>',
    visibility: 'secret',
    readBy: ['api', 'worker'],
    requiredIn: ['always', 'production'],
  },
  DATABASE_URL_MIGRATIONS: {
    description:
      'A direct, non-pooled connection that pnpm db:migrate uses. Empty falls back to DATABASE_URL, which fails on a pooler that cannot run DDL.',
    example: '<postgres connection string>',
    visibility: 'public',
    readBy: ['api', 'tooling'],
  },
  DATABASE_POOL_MAX: {
    description:
      'The most connections one process holds open. Pods multiplied by this must stay under the database limit or new connections are refused.',
    example: '10',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
});

export const REDIS_DOCS = groupDocs('redis', {
  REDIS_URL: {
    description:
      'The Redis connection for BullMQ queues and caches (db 0). Unreachable Redis stops job intake and every cached read falls back to Postgres.',
    example: 'redis://localhost:6379/0',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  REDIS_PUBSUB_URL: {
    description:
      'The Redis connection for Pub/Sub (db 1), shared by every API and worker process for cross-process messages. A wrong value cuts the processes off from each other.',
    example: 'redis://localhost:6379/1',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  BULLMQ_PREFIX: {
    description:
      'The Redis key prefix of every BullMQ queue. Processes sharing a Redis with different prefixes never see each other jobs.',
    example: 'bull',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  REDIS_PASSWORD: {
    description:
      'The Redis password. Optional outside production, required in it; a production boot refuses the local compose value.',
    example: '<redis password>',
    visibility: 'secret',
    readBy: ['api', 'worker'],
    requiredIn: ['production'],
  },
});
