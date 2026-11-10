import { EnvironmentSpec, isKubernetes, WORKER_STAGES } from '../environment-spec';
import { COMPOSE, PRODUCTION, PREVIEW } from './fixtures';

function messages(value: unknown): string[] {
  const parsed = EnvironmentSpec.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('EnvironmentSpec', () => {
  it.each([
    { scenario: 'a protected production cluster', value: PRODUCTION },
    { scenario: 'a preview with a templated namespace', value: PREVIEW },
    { scenario: 'a compose host', value: COMPOSE },
  ])('accepts $scenario', ({ value }) => {
    expect(messages(value)).toEqual([]);
  });

  it.each([
    {
      scenario: 'an unknown kind',
      value: { ...PRODUCTION, kind: 'nomad' },
      expected: 'kind',
    },
    {
      scenario: 'a stage that does not exist',
      value: { ...PRODUCTION, scaling: { ...PRODUCTION.scaling, maxReplicas: { render: 1 } } },
      expected: 'scaling.maxReplicas.render: render is not a worker stage',
    },
    {
      scenario: 'a production environment nobody confirms',
      value: { ...PRODUCTION, protected: false },
      expected: 'protected: a production-mode environment must be protected',
    },
    {
      scenario: 'a templated namespace without a preview block',
      value: { ...PREVIEW, preview: undefined },
      expected: 'preview: a {slug} namespace needs a preview block with ttlHours',
    },
    {
      scenario: 'a preview block on a fixed namespace',
      value: { ...PRODUCTION, preview: { ttlHours: 4 } },
      expected: 'cluster.namespace: a preview environment names its namespace with {slug}',
    },
    {
      scenario: 'a key that is a secret and config at once',
      value: { ...PRODUCTION, config: { DATABASE_URL: 'x' } },
      expected: 'config.DATABASE_URL: DATABASE_URL is listed as a secret and as config',
    },
    {
      scenario: 'a secret named twice',
      value: { ...PRODUCTION, secrets: { source: 'env-file', keys: ['A_KEY', 'A_KEY'] } },
      expected: 'secrets.keys: a secret is listed twice',
    },
    {
      scenario: 'a host with a scheme',
      value: { ...PRODUCTION, hosts: { web: 'https://x.example.org' } },
      expected: 'hosts.web: a bare host name, no scheme or path',
    },
    {
      scenario: 'a key that is not UPPER_SNAKE_CASE',
      value: { ...PRODUCTION, config: { logLevel: 'info' } },
      expected: 'config.logLevel',
    },
  ])('refuses $scenario', ({ value, expected }) => {
    expect(messages(value).some((message) => message.startsWith(expected))).toBe(true);
  });

  it('lists every queue but the dead-letter queue as a worker stage', () => {
    expect(WORKER_STAGES).toContain('transcode-1080p');
    expect(WORKER_STAGES).not.toContain('dlq');
  });

  it.each([
    { env: PRODUCTION, kubernetes: true },
    { env: COMPOSE, kubernetes: false },
  ])('tells a cluster from compose for $env.kind', ({ env, kubernetes }) => {
    expect(isKubernetes(env)).toBe(kubernetes);
  });
});
