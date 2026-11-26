import type { Token } from '@kit/di';
import { provide } from '@kit/di';
import { Clock, CookieJar, EnvSource, Fetch, Random } from '../../index';

expectTypeOf(Clock).toEqualTypeOf<Token<Clock>>();
expectTypeOf(Random).toEqualTypeOf<Token<Random>>();
expectTypeOf(EnvSource).toEqualTypeOf<Token<EnvSource>>();
expectTypeOf(Fetch).toEqualTypeOf<Token<Fetch>>();
expectTypeOf(CookieJar).toEqualTypeOf<Token<CookieJar>>();

provide(Clock, { now: () => 0 });
provide(EnvSource, { get: () => undefined });

// @ts-expect-error a clock reads a number, not a string
provide(Clock, { now: () => 'noon' });

// @ts-expect-error a token carries its own port, not another one's
provide(Random, { now: () => 0 });

// @ts-expect-error a token is not interchangeable with one of another type
const _wrong: Token<Random> = Clock;
