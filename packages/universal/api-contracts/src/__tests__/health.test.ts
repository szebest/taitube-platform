import { ReadinessSchema, jwks, liveness, livenessAlias, readiness } from '../health';

describe('packages/api-contracts: health', () => {
  it.each([
    [liveness, '/healthz'],
    [livenessAlias, '/livez'],
    [readiness, '/readyz'],
    [jwks, '/.well-known/jwks.json'],
  ])('serves %#: $path anonymously', (contract, path) => {
    expect(contract.path).toBe(path);
    expect(contract.method).toBe('GET');
    expect(contract.anonymous).toBe(true);
  });

  it('reports a per-dependency check map on readiness', () => {
    expect(
      ReadinessSchema.parse({ status: 'ok', checks: { postgres: 'ok', redis: 'failed' } })
    ).toMatchObject({ checks: { redis: 'failed' } });
    expect(ReadinessSchema.safeParse({ status: 'ok', checks: { redis: 'unknown' } }).success).toBe(
      false
    );
  });
});
