import { parseEnvExample } from '../parse-example';

const EXAMPLE = `# 🔒 = secret.

# ---- Core -------------------------------------------------------------------
NODE_ENV=development                      # development | test | production
TRUST_PROXY=
# a prose comment: not=an entry
# PORT=3000

# ---- PostgreSQL -------------------------------------------------------------
DATABASE_URL=postgres://vp:vp@localhost:5432/vp   # 🔒
# 🔒 Authorization=Basic <base64>
GRAFANA_OTLP_HEADERS=
# S3_SECRET_ACCESS_KEY=<R2_SECRET>   # 🔒 only for R2
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=local
`;

describe('scripts: env-docs/parse-example', () => {
  it('reads live and commented entries with their section', () => {
    expect(
      parseEnvExample(EXAMPLE).map(({ key, commented, section }) => [key, commented, section])
    ).toEqual([
      ['NODE_ENV', false, 'Core'],
      ['TRUST_PROXY', false, 'Core'],
      ['PORT', true, 'Core'],
      ['DATABASE_URL', false, 'PostgreSQL'],
      ['GRAFANA_OTLP_HEADERS', false, 'PostgreSQL'],
      ['S3_SECRET_ACCESS_KEY', true, 'PostgreSQL'],
      ['OTEL_RESOURCE_ATTRIBUTES', false, 'PostgreSQL'],
    ]);
  });

  it.each([
    { key: 'NODE_ENV', value: 'development' },
    { key: 'TRUST_PROXY', value: '' },
    { key: 'DATABASE_URL', value: 'postgres://vp:vp@localhost:5432/vp' },
    { key: 'S3_SECRET_ACCESS_KEY', value: '<R2_SECRET>' },
    { key: 'OTEL_RESOURCE_ATTRIBUTES', value: 'deployment.environment=local' },
  ])('strips the trailing comment from $key', ({ key, value }) => {
    expect(parseEnvExample(EXAMPLE).find((entry) => entry.key === key)?.value).toBe(value);
  });

  it('marks a key secret by its trailing lock or by the lock comment above it', () => {
    const secret = parseEnvExample(EXAMPLE)
      .filter((entry) => entry.secret)
      .map((entry) => entry.key);

    expect(secret).toEqual(['DATABASE_URL', 'GRAFANA_OTLP_HEADERS', 'S3_SECRET_ACCESS_KEY']);
  });
});
