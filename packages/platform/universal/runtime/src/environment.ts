import { type AnyProvider, provide } from '@kit/di';
import { Clock, EnvSource, Fetch, Random } from './tokens';

export type EnvRecord = Readonly<Record<string, string | undefined>>;

/** What Node, Bun and a browser share: the clock, randomness, an env record and `fetch`. */
export function environmentProviders(env: EnvRecord): AnyProvider[] {
  return [
    provide(Clock, { now: () => Date.now() }),
    provide(Random, { next: () => Math.random() }),
    provide(EnvSource, { get: (key) => env[key] }),
    provide(Fetch, (input, init) => globalThis.fetch(input, init)),
  ];
}
