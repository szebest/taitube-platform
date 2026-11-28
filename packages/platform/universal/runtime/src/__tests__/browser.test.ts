import { createRegistry } from '@kit/di';
import { browserRuntime } from '../browser';
import { CookieJar, EnvSource } from '../tokens';

const registryWith = (cookies: Record<string, string>) =>
  createRegistry().provide(
    ...browserRuntime({
      env: { MODE: 'production' },
      cookies: {
        get: async (name) => {
          if (typeof name !== 'string') return null;
          const value = cookies[name];
          return value === undefined ? null : { name, value };
        },
      },
    })
  );

describe('@kit/runtime/browser', () => {
  it.each([
    { name: 'theme', value: 'sand' },
    { name: 'missing', value: undefined },
  ])('reads the cookie $name through the cookie store it was handed', async ({ name, value }) => {
    const jar = registryWith({ theme: 'sand' }).get(CookieJar);

    expect(jar.ok && (await jar.value.get(name))).toBe(value);
  });

  it('provides the shared environment set beside the cookie jar', () => {
    const env = registryWith({}).get(EnvSource);

    expect(env.ok && env.value.get('MODE')).toBe('production');
  });
});
