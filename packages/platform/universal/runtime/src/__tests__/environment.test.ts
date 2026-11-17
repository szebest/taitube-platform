import { createRegistry } from '@kit/di';
import { ok } from '@kit/result';
import { environmentProviders } from '../environment';
import { Clock, EnvSource, Fetch, Random } from '../tokens';

const registryWith = (env: Record<string, string | undefined> = {}) =>
  createRegistry().provide(...environmentProviders(env));

describe('@kit/runtime: environment providers', () => {
  it.each([
    { key: 'API_URL', value: 'http://localhost:3000' },
    { key: 'UNSET', value: undefined },
  ])('reads $key from the env record it was handed', ({ key, value }) => {
    const env = registryWith({ API_URL: 'http://localhost:3000' }).get(EnvSource);

    expect(env.ok && env.value.get(key)).toBe(value);
  });

  it('reads the clock and randomness of the platform', () => {
    const registry = registryWith();
    const clock = registry.get(Clock);
    const random = registry.get(Random);
    const before = Date.now();

    const now = clock.ok ? clock.value.now() : Number.NaN;
    const roll = random.ok ? random.value.next() : Number.NaN;

    expect(now).toBeGreaterThanOrEqual(before);
    expect(roll).toBeGreaterThanOrEqual(0);
    expect(roll).toBeLessThan(1);
  });

  it('calls the global fetch at call time, so a fetch installed later is the one used', async () => {
    const fetch = registryWith().get(Fetch);
    const global = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('pong'));

    const response = fetch.ok ? await fetch.value('https://example.test/ping') : undefined;

    expect(global).toHaveBeenCalledWith('https://example.test/ping', undefined);
    expect(await response?.text()).toBe('pong');
    expect(fetch).toEqual(ok(expect.any(Function)));
  });
});
