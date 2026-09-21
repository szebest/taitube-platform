import { loadEnv } from '../load-env';

describe('packages/config: loadEnv', () => {
  it('reports every invalid key, redacts the sensitive ones and exits 1', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as typeof process.exit);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadEnv({ ADMIN_TOKEN: 'super-secret-token' })).toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = errorSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('details redacted');
    expect(message).not.toContain('super-secret-token');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
