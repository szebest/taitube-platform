import { PRODUCTION_ENV } from '@vp/testing/env';
import { loadEnv } from '../load-env';

const LOCAL_ENV = { DATABASE_URL: 'postgres://localhost:5432/vp' };

function captureFailure(env: Record<string, string>): string {
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as unknown as typeof process.exit);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    expect(() => loadEnv(env)).toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
    return errorSpy.mock.calls[0]?.[0] as string;
  } finally {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

describe('packages/config: loadEnv', () => {
  it('reports every invalid key, redacts the sensitive ones and exits 1', () => {
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

  it('boots the same environment under development', () => {
    expect(loadEnv({ ...LOCAL_ENV, NODE_ENV: 'development' }).ADMIN_TOKEN).toBeUndefined();
  });
});
