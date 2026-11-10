import type { AppEnv } from './app-env';

/** Every key `AppEnvSchema` declares; `ENV_DOCS` has an entry for each one and for no other. */
export type AppEnvKey = keyof AppEnv;

/** The sections of `.env.example` and of `docs/ENVIRONMENT.md`, in the order both list them. */
export const ENV_GROUPS = [
  { id: 'core', title: 'Core', summary: 'What every process reads: mode, logging, HTTP and CORS.' },
  { id: 'postgres', title: 'PostgreSQL', summary: 'The system of record.' },
  { id: 'redis', title: 'Redis', summary: 'BullMQ queues, Pub/Sub and caches.' },
  {
    id: 'storage',
    title: 'Object storage',
    summary: 'S3-compatible storage: MinIO locally, Cloudflare R2 in the cloud.',
  },
  { id: 'auth', title: 'Auth', summary: 'How the API verifies who is calling.' },
  {
    id: 'pipeline',
    title: 'Pipeline tuning',
    summary: 'Worker stages, FFmpeg, upload limits, SSE, captions and screening.',
  },
  { id: 'live', title: 'Live streaming', summary: 'The MediaMTX gateway and the live worker.' },
  { id: 'watch-party', title: 'Watch parties', summary: 'Room limits and guest hashing.' },
  {
    id: 'observability',
    title: 'Observability',
    summary: 'OpenTelemetry export from the apps.',
  },
] as const;

export type EnvGroup = (typeof ENV_GROUPS)[number]['id'];

export const ENV_READERS = ['api', 'worker', 'web', 'studio', 'tooling', 'infra'] as const;

export type EnvReader = (typeof ENV_READERS)[number];

/**
 * When a key must be set: `always` means the schema fails without it, `production` that a production
 * boot refuses to start without it, `jwks-auth` that `AUTH_MODE=jwks` needs it.
 */
export type EnvRequirement = 'always' | 'production' | 'jwks-auth';

export interface EnvKeyDocBody {
  /** What the key does and what breaks when it is wrong, in one or two sentences. */
  description: string;
  /** A realistic value; a placeholder such as `<password>` for a secret, never a real one. */
  example: string;
  visibility: 'secret' | 'public';
  readBy: readonly [EnvReader, ...EnvReader[]];
  requiredIn?: readonly EnvRequirement[];
}

export interface EnvKeyDoc extends EnvKeyDocBody {
  group: EnvGroup;
}

/** One group's entries, each stamped with the group, so a group file never repeats it per key. */
export function groupDocs<K extends AppEnvKey>(
  group: EnvGroup,
  bodies: Record<K, EnvKeyDocBody>
): Record<K, EnvKeyDoc> {
  const stamped = Object.entries<EnvKeyDocBody>(bodies).map(([key, body]) => [
    key,
    { ...body, group },
  ]);
  return Object.fromEntries(stamped) as Record<K, EnvKeyDoc>;
}
