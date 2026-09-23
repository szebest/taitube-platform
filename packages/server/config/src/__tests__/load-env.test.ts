import { loadEnv } from '../load-env';

const LOCAL_ENV = { DATABASE_URL: 'postgres://vp:vp@localhost:5432/vp' };

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

  it('refuses a production boot without an ADMIN_TOKEN', () => {
    expect(captureFailure({ ...LOCAL_ENV, NODE_ENV: 'production' })).toContain(
      'ADMIN_TOKEN: is required in production'
    );
  });

  it('boots the same environment under development', () => {
    expect(loadEnv({ ...LOCAL_ENV, NODE_ENV: 'development' }).ADMIN_TOKEN).toBeUndefined();
  });
});
