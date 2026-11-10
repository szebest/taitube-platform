import { QUEUES } from '@vp/job-contracts';
import { z } from 'zod';

/** @internal Exported for its spec. */
export const WORKER_STAGES: readonly string[] = QUEUES.filter((queue) => queue !== 'dlq');

export const FEATURE_KEYS = {
  captions: 'CAPTIONS_ENABLED',
  screening: 'SCREENING_ENABLED',
} as const;

const EnvKey = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'an environment key is UPPER_SNAKE_CASE');
const Quantity = z
  .string()
  .regex(/^\d+(\.\d+)?(m|Mi|Gi)?$/, 'a Kubernetes quantity such as 4, 500m or 8Gi');
const Host = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, 'a bare host name, no scheme or path');

const Images = z.object({
  source: z.enum(['build', 'registry']),
  registry: z.string().min(1),
  tag: z.string().min(1),
});

const Secrets = z.object({
  source: z.enum(['env-file', 'external-secrets']),
  keys: z.array(EnvKey),
});

const Health = z.object({
  readyzTimeoutSec: z.number().int().min(10).max(1800),
  smoke: z.boolean(),
});

const Budget = z.object({
  cpu: Quantity,
  memory: Quantity,
  pods: z.number().int().min(1),
});

const Common = {
  name: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  description: z.string().min(10),
  production: z.boolean(),
  protected: z.boolean(),
  typedConfirmation: z.boolean().optional(),
  images: Images,
  hosts: z.object({
    web: Host.optional(),
    studio: Host.optional(),
    api: Host.optional(),
    cdn: Host.optional(),
  }),
  features: z.object({ captions: z.boolean(), screening: z.boolean() }),
  config: z.record(EnvKey, z.string()),
  secrets: Secrets,
  health: Health,
};

const Cluster = z.object({
  context: z.string().min(1),
  namespace: z.string().min(1),
  backing: z.enum(['helm', 'managed']),
});

const Scaling = z.object({
  maxReplicas: z.record(z.string(), z.number().int().min(0)),
  budget: Budget.optional(),
});

const Preview = z.object({
  ttlHours: z.number().int().min(1).max(168),
});

const Kubernetes = {
  ...Common,
  cluster: Cluster,
  scaling: Scaling,
  preview: Preview.optional(),
};

const K3d = z.object({ kind: z.literal('k3d'), ...Kubernetes });
const K3s = z.object({ kind: z.literal('k3s'), ...Kubernetes });
const Compose = z.object({
  kind: z.literal('compose'),
  ...Common,
  compose: z.object({
    file: z.string().min(1),
    project: z.string().min(1),
    context: z.string().min(1),
  }),
});

export const EnvironmentSpec = z
  .discriminatedUnion('kind', [K3d, K3s, Compose])
  .superRefine((env, ctx) => {
    const problem = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    if (env.kind !== 'compose') {
      for (const stage of Object.keys(env.scaling.maxReplicas)) {
        if (!WORKER_STAGES.includes(stage)) {
          problem(['scaling', 'maxReplicas', stage], `${stage} is not a worker stage`);
        }
      }
      const templated = env.cluster.namespace.includes('{slug}');
      if (templated && env.preview === undefined) {
        problem(['preview'], 'a {slug} namespace needs a preview block with ttlHours');
      }
      if (!templated && env.preview !== undefined) {
        problem(['cluster', 'namespace'], 'a preview environment names its namespace with {slug}');
      }
    }
    if (env.production && !env.protected) {
      problem(['protected'], 'a production-mode environment must be protected');
    }
    if (env.typedConfirmation === true && !env.protected) {
      problem(['typedConfirmation'], 'only a protected environment asks for its name typed back');
    }
    if (env.production && env.health.smoke) {
      problem(
        ['health', 'smoke'],
        'the smoke upload mints a dev token and uploads a clip: a production-mode environment gates on /readyz alone'
      );
    }
    const secretNames = new Set(env.secrets.keys);
    for (const key of Object.keys(env.config)) {
      if (secretNames.has(key))
        problem(['config', key], `${key} is listed as a secret and as config`);
    }
    if (new Set(env.secrets.keys).size !== env.secrets.keys.length) {
      problem(['secrets', 'keys'], 'a secret is listed twice');
    }
  });

export type Environment = z.infer<typeof EnvironmentSpec>;
export type KubernetesEnvironment = Extract<Environment, { kind: 'k3d' | 'k3s' }>;

export function isKubernetes(env: Environment): env is KubernetesEnvironment {
  return env.kind !== 'compose';
}
