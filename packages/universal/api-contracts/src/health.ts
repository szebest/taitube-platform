import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';

export const LivenessSchema = z.object({
  status: z.literal('ok'),
});

export const ReadinessSchema = z.object({
  status: z.literal('ok'),
  checks: z.record(z.enum(['ok', 'failed'])),
});

export const DegradedSchema = z.object({
  status: z.literal('degraded'),
  checks: z.record(z.enum(['ok', 'failed'])),
});

export const liveness = defineEndpoint({
  method: 'GET',
  path: '/healthz',
  tag: 'Ops',
  summary: 'Liveness probe',
  description: 'Returns 200 if API server process is alive.',
  anonymous: true,
  status: 200,
  result: LivenessSchema,
  errors: {},
});

export const livenessAlias = defineEndpoint({
  method: 'GET',
  path: '/livez',
  tag: 'Ops',
  summary: 'Liveness probe (K8s alias)',
  description: 'Returns 200 if API server process is alive.',
  anonymous: true,
  status: 200,
  result: LivenessSchema,
  errors: {},
});

export const readiness = defineEndpoint({
  method: 'GET',
  path: '/readyz',
  tag: 'Ops',
  summary: 'Readiness probe',
  description:
    'Checks Postgres, Redis, and S3 connectivity. Returns 200 when all healthy, 503 if degraded.',
  anonymous: true,
  status: 200,
  result: ReadinessSchema,
  errors: {},
});

export const jwks = defineEndpoint({
  method: 'GET',
  path: '/.well-known/jwks.json',
  tag: 'Ops',
  summary: 'Development JWKS document',
  description: 'Serves the local development JSON Web Key Set used to verify dev tokens.',
  anonymous: true,
  status: 200,
  result: z.object({ keys: z.array(z.record(z.unknown())) }),
  errors: {},
});

export type Liveness = z.infer<typeof LivenessSchema>;
export type Readiness = z.infer<typeof ReadinessSchema>;
