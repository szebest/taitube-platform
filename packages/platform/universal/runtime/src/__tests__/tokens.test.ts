import { createRegistry, provide } from '@kit/di';
import { ok } from '@vp/result';
import { Clock, CookieJar, EnvSource, Fetch, Random } from '../tokens';

const clock = { now: () => 0 };
const random = { next: () => 0.5 };
const env = { get: () => undefined };
const fetch = async () => new Response();
const cookies = { get: async () => undefined };

describe('@kit/runtime: tokens', () => {
  it('declares five distinct tokens, so a registry never hands one value for another', () => {
    const registry = createRegistry().provide(
      provide(Clock, clock),
      provide(Random, random),
      provide(EnvSource, env),
      provide(Fetch, fetch),
      provide(CookieJar, cookies)
    );

    expect([
      registry.get(Clock),
      registry.get(Random),
      registry.get(EnvSource),
      registry.get(Fetch),
      registry.get(CookieJar),
    ]).toEqual([ok(clock), ok(random), ok(env), ok(fetch), ok(cookies)]);
  });
});
