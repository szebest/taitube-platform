import { load, YAML11_SCHEMA } from 'js-yaml';
import { WORKER_STAGES } from '../../packages/server/deploy/src/environment-spec';
import { AppEnvSchema } from '../../packages/server/env-schema/src/index';
import { read } from './repo-files';

describe('architecture: the compose environment runs every stage the platform has', () => {
  const compose = load(read('infra/environments/compose-vm/docker-compose.yml'), {
    schema: YAML11_SCHEMA,
  }) as {
    services: Record<string, { image?: string; environment?: Record<string, string> }>;
  };
  const NOT_IN_COMPOSE_VM = ['live'];

  it('has a worker service for every stage but the one that needs a media gateway', () => {
    const missing = WORKER_STAGES.filter(
      (stage) => !NOT_IN_COMPOSE_VM.includes(stage) && !(`worker-${stage}` in compose.services)
    );

    expect(missing).toEqual([]);
  });

  it('sets only keys the environment schema declares, and pulls images from the environment registry', () => {
    const keys = Object.values(compose.services).flatMap((service) =>
      Object.keys(service.environment ?? {})
    );
    const known = new Set([...Object.keys(AppEnvSchema.shape), 'WORKER_STAGE', 'TUNNEL_TOKEN']);

    expect([...new Set(keys)].filter((key) => !known.has(key))).toEqual([]);
    expect(compose.services['api']?.image).toContain('/vp-api:');
    expect(compose.services['worker-probe']?.image).toContain('/vp-worker:');
  });
});

describe('architecture: the Helm chart pins the deploy script installs match the Makefile', () => {
  it('uses the same version for Postgres, Redis and MinIO', () => {
    const pins = Object.fromEntries(
      read('infra/k8s/charts.env')
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => line.split('='))
    );
    const makefile = read('Makefile');
    const versionOf = (release: string) =>
      new RegExp(`helm upgrade --install ${release} \\S+ --version (\\S+)`).exec(makefile)?.[1];

    expect({
      POSTGRES_VERSION: versionOf('vp-postgres'),
      REDIS_VERSION: versionOf('vp-redis'),
      MINIO_VERSION: versionOf('vp-minio'),
    }).toEqual({
      POSTGRES_VERSION: pins['POSTGRES_VERSION'],
      REDIS_VERSION: pins['REDIS_VERSION'],
      MINIO_VERSION: pins['MINIO_VERSION'],
    });
  });
});
