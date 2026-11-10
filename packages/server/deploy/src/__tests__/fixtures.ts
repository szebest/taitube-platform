import type { Environment, KubernetesEnvironment } from '../environment-spec';

export const PRODUCTION: KubernetesEnvironment = {
  kind: 'k3s',
  name: 'production',
  description: 'The environment real users reach.',
  production: true,
  protected: true,
  images: { source: 'registry', registry: 'ghcr.io/acme', tag: 'latest' },
  hosts: { web: 'taitube.example.org', cdn: 'cdn.example.org' },
  features: { captions: true, screening: false },
  config: { AUTH_JWKS_URL: 'https://auth.example.org/jwks.json' },
  secrets: {
    source: 'external-secrets',
    keys: ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
  },
  health: { readyzTimeoutSec: 300, smoke: false },
  cluster: { context: 'k3s-prod', namespace: 'video-pipeline', backing: 'managed' },
  scaling: {
    maxReplicas: { probe: 2, 'transcode-480p': 3 },
    budget: { cpu: '8', memory: '16Gi', pods: 40 },
  },
};

export const PREVIEW: KubernetesEnvironment = {
  ...PRODUCTION,
  name: 'preview',
  production: false,
  protected: false,
  images: { source: 'registry', registry: 'ghcr.io/acme', tag: '{sha}' },
  hosts: {},
  config: {},
  secrets: { source: 'env-file', keys: [] },
  cluster: { context: 'k3s-staging', namespace: 'preview-{slug}', backing: 'helm' },
  preview: { ttlHours: 24 },
};

export const COMPOSE: Environment = {
  kind: 'compose',
  name: 'compose-vm',
  description: 'One VM running the compose file.',
  production: true,
  protected: true,
  images: { source: 'registry', registry: 'ghcr.io/acme', tag: 'latest' },
  hosts: {},
  features: { captions: true, screening: true },
  config: { AUTH_JWKS_URL: 'https://auth.example.org/jwks.json' },
  secrets: {
    source: 'env-file',
    keys: ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
  },
  health: { readyzTimeoutSec: 120, smoke: false },
  compose: {
    file: 'infra/environments/compose-vm/docker-compose.yml',
    project: 'vp',
    context: 'vm',
  },
};

export const DOCS = {
  DATABASE_URL: { visibility: 'secret', requiredIn: ['always', 'production'] },
  REDIS_PASSWORD: { visibility: 'secret', requiredIn: ['production'] },
  S3_ACCESS_KEY_ID: { visibility: 'secret', requiredIn: ['production'] },
  S3_SECRET_ACCESS_KEY: { visibility: 'secret', requiredIn: ['production'] },
  AUTH_JWKS_URL: { visibility: 'public', requiredIn: ['jwks-auth'] },
  AUTH_MODE: { visibility: 'public' },
  LOG_LEVEL: { visibility: 'public' },
  CAPTIONS_ENABLED: { visibility: 'public' },
} as const;
