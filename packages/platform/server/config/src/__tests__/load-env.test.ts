import { expectErr } from '@kit/testing/result';
import { loadEnv, parseEnv } from '../load-env';

const PRODUCTION_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'production',
  AUTH_MODE: 'jwks',
  AUTH_JWKS_URL: 'https://idp.vp.local/.well-known/jwks.json',
  AUTH_ISSUER: 'https://idp.vp.local/',
  AUTH_AUDIENCE: 'taitube',
  CORS_ORIGINS: 'https://taitube.vp.local',
  DATABASE_URL: 'postgres://db.internal:5432/vp',
  S3_ACCESS_KEY_ID: 'rotated-access-key',
  S3_SECRET_ACCESS_KEY: 'rotated-secret-key',
  REDIS_PASSWORD: 'rotated-redis-password',
};

const LOCAL_ENV = { DATABASE_URL: 'postgres://localhost:5432/vp' };

function captureFailure(env: Record<string, string>): string {
  return expectErr(parseEnv(env)).issues.join('\n');
}

describe('packages/config: loadEnv', () => {
  it('reports every invalid key and redacts the sensitive ones', () => {
    const message = captureFailure({ ADMIN_TOKEN: 'super-secret-token' });

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('details redacted');
    expect(message).not.toContain('super-secret-token');
  });

  it('boots production with real secrets and a jwks issuer', () => {
    expect(loadEnv(PRODUCTION_ENV).AUTH_MODE).toBe('jwks');
  });

  it.each([
    {
      scenario: 'any ADMIN_TOKEN',
      env: { ...PRODUCTION_ENV, ADMIN_TOKEN: 'a-long-random-operator-token' },
      refusal: 'ADMIN_TOKEN: is refused in production',
    },
    {
      scenario: 'a missing secret',
      env: { ...PRODUCTION_ENV, S3_ACCESS_KEY_ID: '' },
      refusal: 'S3_ACCESS_KEY_ID: is required in production',
    },
    {
      scenario: 'dev auth',
      env: { ...PRODUCTION_ENV, AUTH_MODE: 'dev' },
      refusal: 'AUTH_MODE: dev verifies the public dev key',
    },
  ])('refuses a production boot with $scenario', ({ env, refusal }) => {
    expect(captureFailure(env)).toContain(refusal);
  });

  it('throws the same report, one key a line, for an entrypoint to log', () => {
    expect(() => loadEnv({})).toThrow(
      /^\[FATAL\] Invalid environment configuration:\n {2}- DATABASE_URL: .*details redacted/
    );
  });

  it('boots the same environment under development', () => {
    expect(loadEnv({ ...LOCAL_ENV, NODE_ENV: 'development' }).ADMIN_TOKEN).toBeUndefined();
  });
});
